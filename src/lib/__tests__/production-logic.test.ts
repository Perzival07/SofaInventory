/**
 * Production logic tests — free stock, FIFO/dye-lot allocation, stage WIP,
 * piece-rate wages, consumption variance.
 *
 * Run with:  npm run test:production
 */

import {
  checkMaterialAvailability,
  allocateBatches,
  computeStageWip,
  computeKarigarWages,
  computeConsumptionVariance,
  requirementToStockQty,
} from "../production-logic";
import { Material, MaterialBatch, MaterialType, ExplodedRequirement } from "../erp-types";
import { Operation, ProductionEntry, StockReservation } from "../production-types";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected ${e}\n      actual   ${a}`); }
}

function material(over: Partial<Material>): Material {
  return {
    id: 1, code: "TMB-SHS-01", name: "Sheesham Timber", category_id: 1,
    material_type: "timber" as MaterialType,
    purchase_uom: "CFT", stock_uom: "CFT", consumption_uom: "RFT",
    purchase_to_stock_factor: 1, stock_to_consumption_factor: 12,
    tracks_batch: true, tracks_dye_lot: false, shelf_life_days: null, is_hazardous: false,
    reorder_level: 0, standard_rate: 2200, hsn_code: null,
    is_offcut: false, parent_material_id: null, attributes: {}, is_active: true,
    ...over,
  };
}

function batch(over: Partial<MaterialBatch>): MaterialBatch {
  return {
    id: 1, material_id: 1, batch_no: "B1", dye_lot: null, quantity: 100, rate: 2200,
    received_date: "2026-08-01", expiry_date: null, moisture_pct: null,
    seasoning_date: null, kiln_batch: null, location: null, notes: null,
    ...over,
  };
}

// -----------------------------------------------------------------------------
console.log("\n1. BOM requirement converts from consumption uom to stock uom");
{
  const timber = material({});  // 1 CFT = 12 RFT
  check("450 RFT of timber is 37.5 CFT of stock",
    requirementToStockQty(timber, 450, "RFT"), 37.5);
  check("a stock-uom requirement passes through",
    requirementToStockQty(timber, 40, "CFT"), 40);
}

// -----------------------------------------------------------------------------
console.log("\n2. Free stock excludes other work orders' reservations");
{
  const timber = material({});
  const reqs: ExplodedRequirement[] = [{
    material_id: 1, code: "TMB-SHS-01", name: "Sheesham Timber", uom: "RFT",
    net_quantity: 450, gross_quantity: 504, wastage_pct: 12,
    stock_equivalent: 42, stock_uom: "CFT", rate: 2200, cost: 92400, path: "Frame",
  }];
  const batches = [batch({ id: 1, quantity: 100 })];

  const noReservations = checkMaterialAvailability(
    reqs, new Map([[1, timber]]), batches, []
  );
  check("504 RFT required becomes 42 CFT", noReservations[0].required_qty, 42);
  check("all 100 CFT free when nothing reserved", noReservations[0].free, 100);
  check("no shortfall", noReservations[0].shortfall, 0);

  const reservations: StockReservation[] = [
    { id: 1, work_order_id: 99, material_id: 1, quantity: 70, issued_quantity: 0, status: "reserved" },
  ];
  const withReservation = checkMaterialAvailability(
    reqs, new Map([[1, timber]]), batches, reservations
  );
  check("another WO's reservation reduces free stock", withReservation[0].free, 30);
  check("shortfall appears even though on-hand looks sufficient",
    withReservation[0].shortfall, 12);
  check("on-hand still reported in full", withReservation[0].on_hand, 100);
  check("shortfall restated in purchase uom for an indent",
    withReservation[0].shortfall_purchase_qty, 12);

  const ownReservation = checkMaterialAvailability(
    reqs, new Map([[1, timber]]), batches, reservations, 99
  );
  check("a work order does not compete with its own reservation",
    ownReservation[0].free, 100);
}

// -----------------------------------------------------------------------------
console.log("\n3. Partly issued reservations only block what is still outstanding");
{
  const timber = material({});
  const reqs: ExplodedRequirement[] = [{
    material_id: 1, code: "T", name: "T", uom: "CFT", net_quantity: 10, gross_quantity: 10,
    wastage_pct: 0, stock_equivalent: 10, stock_uom: "CFT", rate: 2200, cost: 22000, path: "x",
  }];
  const reservations: StockReservation[] = [
    { id: 1, work_order_id: 99, material_id: 1, quantity: 40, issued_quantity: 25, status: "reserved" },
  ];
  const res = checkMaterialAvailability(
    reqs, new Map([[1, timber]]), [batch({ quantity: 60 })], reservations
  );
  check("only the un-issued 15 CFT is still blocking", res[0].free, 45);
}

// -----------------------------------------------------------------------------
console.log("\n4. FIFO allocation");
{
  const timber = material({});
  const batches = [
    batch({ id: 1, batch_no: "OLD", quantity: 20, rate: 2000, received_date: "2026-07-01" }),
    batch({ id: 2, batch_no: "NEW", quantity: 50, rate: 2400, received_date: "2026-09-01" }),
  ];

  const result = allocateBatches(timber, batches, 30, "2026-09-12");
  check("oldest batch drained first",
    result.allocations.map((a) => [a.batch_no, a.quantity]), [["OLD", 20], ["NEW", 10]]);
  check("full quantity allocated", result.allocated_qty, 30);
  check("no shortfall", result.shortfall, 0);
  check("valued at each batch's own rate", result.total_value, 20 * 2000 + 10 * 2400);
}

{
  const timber = material({});
  const result = allocateBatches(timber, [batch({ quantity: 10 })], 25, "2026-09-12");
  check("shortfall reported when stock runs out", result.shortfall, 15);
  check("allocates what it can", result.allocated_qty, 10);
}

// -----------------------------------------------------------------------------
console.log("\n5. Expired batches are never issued");
{
  const adhesive = material({
    id: 6, code: "ADH", name: "Adhesive", stock_uom: "KG", consumption_uom: "KG",
    stock_to_consumption_factor: 1, shelf_life_days: 365,
  });
  const batches = [
    batch({ id: 1, material_id: 6, batch_no: "EXPIRED", quantity: 20,
      received_date: "2025-01-01", expiry_date: "2026-01-01" }),
    batch({ id: 2, material_id: 6, batch_no: "GOOD", quantity: 20,
      received_date: "2026-08-01", expiry_date: "2027-08-01" }),
  ];

  const result = allocateBatches(adhesive, batches, 15, "2026-09-12");
  check("expired batch skipped despite being oldest",
    result.allocations.map((a) => a.batch_no), ["GOOD"]);
  check("a warning explains the skip",
    result.warnings.some((w) => w.includes("expired")), true);
}

// -----------------------------------------------------------------------------
console.log("\n6. Dye lot integrity beats strict FIFO");
{
  const fabric = material({
    id: 4, code: "FAB", name: "Velvet", stock_uom: "MTR", consumption_uom: "MTR",
    stock_to_consumption_factor: 1, tracks_dye_lot: true,
  });
  const batches = [
    batch({ id: 1, material_id: 4, batch_no: "A", dye_lot: "LOT-1", quantity: 20,
      received_date: "2026-07-01", rate: 470 }),
    batch({ id: 2, material_id: 4, batch_no: "B", dye_lot: "LOT-2", quantity: 60,
      received_date: "2026-09-01", rate: 485 }),
  ];

  // 40 m needed: FIFO alone would take 20 from LOT-1 then 20 from LOT-2 and
  // produce a two-tone sofa. LOT-2 alone can cover it, so it must win.
  const result = allocateBatches(fabric, batches, 40, "2026-09-12");
  check("single sufficient lot chosen over older split",
    result.allocations.map((a) => a.dye_lot), ["LOT-2"]);
  check("caller told why FIFO was overridden",
    result.warnings.some((w) => w.includes("dye lot LOT-2")), true);

  // 70 m needed: no single lot can cover it, so the split must be flagged loudly.
  const split = allocateBatches(fabric, batches, 70, "2026-09-12");
  check("falls back to FIFO across lots when unavoidable", split.allocated_qty, 70);
  check("shade-mismatch risk warned",
    split.warnings.some((w) => w.includes("shade mismatch")), true);
}

// -----------------------------------------------------------------------------
console.log("\n7. WIP by stage — the '40 frames but only 22 upholstered' case");
{
  const ops: Operation[] = [
    { id: 1, code: "CUT", name: "Cutting", sequence: 1, standard_minutes: 30, piece_rate: 60, machine_required: true, is_active: true },
    { id: 2, code: "FRAME", name: "Frame Assembly", sequence: 2, standard_minutes: 90, piece_rate: 180, machine_required: false, is_active: true },
    { id: 3, code: "UPH", name: "Upholstery", sequence: 3, standard_minutes: 120, piece_rate: 250, machine_required: false, is_active: true },
    { id: 4, code: "POL", name: "Polish", sequence: 4, standard_minutes: 60, piece_rate: 120, machine_required: false, is_active: true },
  ];

  const entries: ProductionEntry[] = [
    { id: 1, work_order_id: 1, operation_id: 1, karigar_id: 1, entry_date: "2026-09-01",
      shift: "day", completed_quantity: 50, rework_quantity: 0, rejected_quantity: 0 },
    { id: 2, work_order_id: 1, operation_id: 2, karigar_id: 2, entry_date: "2026-09-04",
      shift: "day", completed_quantity: 40, rework_quantity: 0, rejected_quantity: 2 },
    { id: 3, work_order_id: 1, operation_id: 3, karigar_id: 3, entry_date: "2026-09-11",
      shift: "day", completed_quantity: 22, rework_quantity: 3, rejected_quantity: 0 },
  ];

  const wip = computeStageWip(ops, entries, 50, "2026-09-12");

  check("cutting is clear", wip[0].wip, 0);
  check("frame assembly received 50", wip[1].available_to_work, 50);
  check("8 units still waiting at frame assembly (50 − 40 done − 2 rejected)", wip[1].wip, 8);
  check("upholstery only received the 40 good frames", wip[2].available_to_work, 40);
  check("18 frames waiting to be upholstered", wip[2].wip, 18);
  check("polish has 22 available", wip[3].available_to_work, 22);
  check("22 units waiting at polish, never started", wip[3].wip, 22);
  check("polish has no entries yet", wip[3].days_since_last_entry, null);
  check("frame assembly stalled — 8 days idle with work waiting", wip[1].is_stalled, true);
  check("upholstery not stalled, worked yesterday", wip[2].is_stalled, false);
}

{
  // Rejections must not flow downstream as if they were good units.
  const ops: Operation[] = [
    { id: 1, code: "CUT", name: "Cutting", sequence: 1, standard_minutes: 30, piece_rate: 60, machine_required: false, is_active: true },
    { id: 2, code: "FRAME", name: "Frame", sequence: 2, standard_minutes: 90, piece_rate: 180, machine_required: false, is_active: true },
  ];
  const entries: ProductionEntry[] = [
    { id: 1, work_order_id: 1, operation_id: 1, karigar_id: 1, entry_date: "2026-09-10",
      shift: "day", completed_quantity: 30, rework_quantity: 0, rejected_quantity: 10 },
  ];
  const wip = computeStageWip(ops, entries, 40, "2026-09-12");
  check("only good output passes to the next stage", wip[1].available_to_work, 30);
}

// -----------------------------------------------------------------------------
console.log("\n8. Karigar piece-rate wages");
{
  const ops = new Map<number, Operation>([
    [2, { id: 2, code: "FRAME", name: "Frame", sequence: 2, standard_minutes: 90,
      piece_rate: 180, machine_required: false, is_active: true }],
    [3, { id: 3, code: "UPH", name: "Upholstery", sequence: 3, standard_minutes: 120,
      piece_rate: 250, machine_required: false, is_active: true }],
  ]);
  const names = new Map([[1, "Sujit Das"], [2, "Ratan Mondal"]]);

  const entries: ProductionEntry[] = [
    { id: 1, work_order_id: 1, operation_id: 2, karigar_id: 1, entry_date: "2026-09-10",
      shift: "day", completed_quantity: 10, rework_quantity: 0, rejected_quantity: 2, hours_worked: 8 },
    { id: 2, work_order_id: 1, operation_id: 3, karigar_id: 1, entry_date: "2026-09-11",
      shift: "day", completed_quantity: 4, rework_quantity: 0, rejected_quantity: 0, hours_worked: 8 },
    { id: 3, work_order_id: 1, operation_id: 2, karigar_id: 2, entry_date: "2026-09-11",
      shift: "day", completed_quantity: 6, rework_quantity: 0, rejected_quantity: 0, hours_worked: 6 },
  ];

  const wages = computeKarigarWages(entries, ops, names);

  check("highest earner first", wages[0].karigar_name, "Sujit Das");
  check("paid across both operations at their own rates",
    wages[0].piece_wage, 10 * 180 + 4 * 250);
  check("rejected units are not paid", wages[0].units_completed, 14);
  check("rejection rate computed on total produced", wages[0].rejection_rate, 12.5);
  check("output per hour", wages[0].output_per_hour, round(14 / 16));
  check("second karigar's wage", wages[1].piece_wage, 6 * 180);
}

function round(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// -----------------------------------------------------------------------------
console.log("\n9. Standard vs actual consumption variance");
{
  const standard = [
    { material_id: 1, code: "TMB", name: "Timber", qty: 42, uom: "CFT", rate: 2200 },
    { material_id: 4, code: "FAB", name: "Fabric", qty: 97.2, uom: "MTR", rate: 480 },
    { material_id: 5, code: "CAST", name: "Castor", qty: 25, uom: "NOS", rate: 38 },
  ];
  const actual = new Map([[1, 48], [4, 95], [5, 25]]);

  const variance = computeConsumptionVariance(standard, actual);

  const timber = variance.find((v) => v.material_id === 1)!;
  check("timber overconsumed by 6 CFT", timber.variance_qty, 6);
  check("worth ₹13,200", timber.variance_value, 13200);
  check("flagged as overconsumption", timber.is_overconsumption, true);
  check("variance percentage", timber.variance_pct, 14.29);

  const fabric = variance.find((v) => v.material_id === 4)!;
  check("fabric came in under standard", fabric.variance_qty, -2.2);
  check("saving shown as negative value", fabric.variance_value, -1056);

  const castor = variance.find((v) => v.material_id === 5)!;
  check("on-standard material shows no variance", castor.variance_qty, 0);

  check("worst overconsumption sorted first", variance[0].material_id, 1);
}

// -----------------------------------------------------------------------------
console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
