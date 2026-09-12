/**
 * Production logic — pure functions, tested without a database.
 *
 * The subtle parts, and why each is here rather than inline in a query:
 *
 *   - Free stock is on-hand MINUS what other work orders have committed.
 *     Showing on-hand as available is how two work orders end up promised the
 *     same timber.
 *   - Issuing picks batches FIFO, but shade-critical materials must come from
 *     ONE dye lot even if that means skipping an older batch. Splitting a sofa
 *     set across lots is a guaranteed rejection.
 *   - WIP at a stage is the previous stage's output minus this stage's, which
 *     is what shows that 40 frames were built but only 22 upholstered.
 */

import { Material, MaterialBatch } from "./erp-types";
import {
  AllocationResult,
  BatchAllocation,
  ConsumptionVarianceLine,
  KarigarWage,
  MaterialRequirement,
  Operation,
  ProductionEntry,
  StageWip,
  StockReservation,
} from "./production-types";
import { ExplodedRequirement } from "./erp-types";
import { round2, round4 } from "./tax-regime";

/** Days a stage may sit untouched before it is called stalled. */
export const STALL_THRESHOLD_DAYS = 5;

/**
 * Convert a BOM requirement (expressed in the consumption uom) into the stock
 * uom, which is what reservations and issues are held in.
 */
export function requirementToStockQty(material: Material, qty: number, uom: string): number {
  if (uom === material.stock_uom) return qty;
  if (uom === material.consumption_uom) return qty / (material.stock_to_consumption_factor || 1);
  if (uom === material.purchase_uom) return qty * (material.purchase_to_stock_factor || 1);
  return qty;
}

/**
 * Check a work order's exploded BOM against free stock and report shortfalls,
 * with the shortfall restated in purchase units so an indent can be raised.
 */
export function checkMaterialAvailability(
  requirements: ExplodedRequirement[],
  materialsById: Map<number, Material>,
  batches: MaterialBatch[],
  reservations: StockReservation[],
  excludeWorkOrderId?: number
): MaterialRequirement[] {
  return requirements.map((req) => {
    const material = materialsById.get(req.material_id);
    const stockUom = material?.stock_uom ?? req.uom;

    const requiredStockQty = material
      ? round4(requirementToStockQty(material, req.gross_quantity, req.uom))
      : req.gross_quantity;

    const onHand = round4(
      batches
        .filter((b) => b.material_id === req.material_id)
        .reduce((s, b) => s + Number(b.quantity), 0)
    );

    const reservedElsewhere = round4(
      reservations
        .filter(
          (r) =>
            r.material_id === req.material_id &&
            r.status === "reserved" &&
            r.work_order_id !== excludeWorkOrderId
        )
        .reduce((s, r) => s + (r.quantity - r.issued_quantity), 0)
    );

    const free = round4(onHand - reservedElsewhere);
    const shortfall = round4(Math.max(0, requiredStockQty - free));

    return {
      material_id: req.material_id,
      material_code: req.code,
      material_name: req.name,
      required_qty: requiredStockQty,
      stock_uom: stockUom,
      on_hand: onHand,
      reserved_elsewhere: reservedElsewhere,
      free,
      shortfall,
      purchase_uom: material?.purchase_uom ?? stockUom,
      shortfall_purchase_qty: material
        ? round4(shortfall / (material.purchase_to_stock_factor || 1))
        : shortfall,
    };
  });
}

/**
 * Pick batches to satisfy an issue.
 *
 * FIFO by receipt date, with two overrides:
 *   - expired batches are never issued;
 *   - for dye-lot tracked material, a single lot that can cover the whole
 *     requirement is preferred over strict FIFO across lots.
 */
export function allocateBatches(
  material: Material,
  batches: MaterialBatch[],
  requiredQty: number,
  today: string
): AllocationResult {
  const warnings: string[] = [];

  const usable = batches
    .filter((b) => b.material_id === material.id && Number(b.quantity) > 0)
    .filter((b) => {
      if (b.expiry_date && b.expiry_date < today) {
        warnings.push(`Batch ${b.batch_no} skipped — expired on ${b.expiry_date}`);
        return false;
      }
      return true;
    })
    .sort((a, b) => a.received_date.localeCompare(b.received_date));

  let ordered = usable;

  if (material.tracks_dye_lot) {
    // Group by lot and prefer the oldest lot that can cover the whole quantity.
    const byLot = new Map<string, MaterialBatch[]>();
    for (const b of usable) {
      const lot = b.dye_lot ?? "__nolot__";
      if (!byLot.has(lot)) byLot.set(lot, []);
      byLot.get(lot)!.push(b);
    }

    const sufficientLot = [...byLot.entries()]
      .filter(([lot]) => lot !== "__nolot__")
      .find(([, bs]) => bs.reduce((s, b) => s + Number(b.quantity), 0) >= requiredQty);

    if (sufficientLot) {
      ordered = sufficientLot[1];
      if (byLot.size > 1) {
        warnings.push(
          `Issued entirely from dye lot ${sufficientLot[0]} to avoid shade mismatch`
        );
      }
    } else if (byLot.size > 1) {
      warnings.push(
        `No single dye lot can cover ${requiredQty} ${material.stock_uom}. ` +
          `This issue will span multiple lots and shade mismatch is likely — ` +
          `consider reducing the batch size or ordering more of one lot.`
      );
    }
  }

  const allocations: BatchAllocation[] = [];
  let remaining = requiredQty;

  for (const batch of ordered) {
    if (remaining <= 0.00001) break;
    const take = Math.min(remaining, Number(batch.quantity));
    allocations.push({
      batch_id: batch.id,
      batch_no: batch.batch_no,
      dye_lot: batch.dye_lot ?? null,
      quantity: round4(take),
      rate: Number(batch.rate),
      value: round2(take * Number(batch.rate)),
      expiry_date: batch.expiry_date ?? null,
    });
    remaining = round4(remaining - take);
  }

  const allocatedQty = round4(allocations.reduce((s, a) => s + a.quantity, 0));

  return {
    allocations,
    allocated_qty: allocatedQty,
    shortfall: round4(Math.max(0, requiredQty - allocatedQty)),
    total_value: round2(allocations.reduce((s, a) => s + a.value, 0)),
    warnings,
  };
}

/**
 * WIP per stage for one work order.
 *
 * Units available to work at a stage = good output of the previous stage
 * (the first stage draws on the work order quantity). WIP is what has arrived
 * but not yet been completed here.
 */
export function computeStageWip(
  operations: Operation[],
  entries: ProductionEntry[],
  workOrderQuantity: number,
  today: string
): StageWip[] {
  const ordered = [...operations].sort((a, b) => a.sequence - b.sequence);
  const result: StageWip[] = [];
  let upstreamOutput = workOrderQuantity;

  for (const op of ordered) {
    const opEntries = entries.filter((e) => e.operation_id === op.id);
    const completed = round4(opEntries.reduce((s, e) => s + e.completed_quantity, 0));
    const rejected = round4(opEntries.reduce((s, e) => s + e.rejected_quantity, 0));
    const rework = round4(opEntries.reduce((s, e) => s + e.rework_quantity, 0));

    const lastEntryDate = opEntries
      .map((e) => e.entry_date)
      .sort()
      .slice(-1)[0];

    const daysSince = lastEntryDate ? daysBetween(lastEntryDate, today) : null;
    const wip = round4(Math.max(0, upstreamOutput - completed - rejected));

    result.push({
      operation_id: op.id,
      operation_code: op.code,
      operation_name: op.name,
      sequence: op.sequence,
      available_to_work: upstreamOutput,
      completed,
      rejected,
      rework,
      wip,
      days_since_last_entry: daysSince,
      // Work is waiting here and nothing has moved for a while.
      is_stalled: wip > 0 && daysSince !== null && daysSince >= STALL_THRESHOLD_DAYS,
    });

    // Only good output flows downstream.
    upstreamOutput = completed;
  }

  return result;
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Piece-rate wages and quality per karigar over a set of entries. */
export function computeKarigarWages(
  entries: ProductionEntry[],
  operationsById: Map<number, Operation>,
  karigarNames: Map<number, string>
): KarigarWage[] {
  const byKarigar = new Map<number, KarigarWage>();

  for (const entry of entries) {
    if (entry.karigar_id === null) continue;
    const op = operationsById.get(entry.operation_id);
    const rate = op?.piece_rate ?? 0;

    let row = byKarigar.get(entry.karigar_id);
    if (!row) {
      row = {
        karigar_id: entry.karigar_id,
        karigar_name: karigarNames.get(entry.karigar_id) ?? `#${entry.karigar_id}`,
        units_completed: 0,
        units_rejected: 0,
        piece_wage: 0,
        hours_worked: 0,
        rejection_rate: 0,
        output_per_hour: null,
      };
      byKarigar.set(entry.karigar_id, row);
    }

    row.units_completed += entry.completed_quantity;
    row.units_rejected += entry.rejected_quantity;
    // Rejected units are not paid for.
    row.piece_wage += entry.completed_quantity * rate;
    row.hours_worked += entry.hours_worked ?? 0;
  }

  return [...byKarigar.values()]
    .map((r) => {
      const produced = r.units_completed + r.units_rejected;
      return {
        ...r,
        piece_wage: round2(r.piece_wage),
        hours_worked: round2(r.hours_worked),
        rejection_rate: produced > 0 ? round2((r.units_rejected / produced) * 100) : 0,
        output_per_hour: r.hours_worked > 0 ? round2(r.units_completed / r.hours_worked) : null,
      };
    })
    .sort((a, b) => b.piece_wage - a.piece_wage);
}

/**
 * Standard vs actual consumption. Persistent overconsumption against standard
 * is the clearest signal of either waste or leakage, so it is reported per
 * material with a value attached.
 */
export function computeConsumptionVariance(
  standard: { material_id: number; code: string; name: string; qty: number; uom: string; rate: number }[],
  actual: Map<number, number>
): ConsumptionVarianceLine[] {
  const materialIds = new Set<number>([...standard.map((s) => s.material_id), ...actual.keys()]);

  return [...materialIds]
    .map((id) => {
      const std = standard.find((s) => s.material_id === id);
      const standardQty = round4(std?.qty ?? 0);
      const actualQty = round4(actual.get(id) ?? 0);
      const varianceQty = round4(actualQty - standardQty);
      const rate = std?.rate ?? 0;

      return {
        material_id: id,
        material_code: std?.code ?? "",
        material_name: std?.name ?? "",
        stock_uom: std?.uom ?? "",
        standard_qty: standardQty,
        actual_qty: actualQty,
        variance_qty: varianceQty,
        variance_pct: standardQty > 0 ? round2((varianceQty / standardQty) * 100) : 0,
        rate,
        variance_value: round2(varianceQty * rate),
        is_overconsumption: varianceQty > 0,
      };
    })
    .sort((a, b) => b.variance_value - a.variance_value);
}
