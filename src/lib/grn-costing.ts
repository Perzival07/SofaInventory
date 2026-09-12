/**
 * GRN posting logic — pure, so it can be tested without a database.
 *
 * Three things happen here that are easy to get wrong, and all three are the
 * reason this is a separate tested module:
 *
 *   1. Quantities arrive in the PURCHASE uom but stock is held in the STOCK
 *      uom. Timber bought in CFT, plywood in sheets. The conversion must
 *      happen before the batch is written or every downstream cost is wrong.
 *   2. Tax treatment depends on the regime in force on the RECEIPT DATE, not
 *      on today's flag.
 *   3. Freight is a landed cost: it must be spread across the received lines
 *      and folded into the unit cost, never expensed away separately.
 */

import { Material } from "./erp-types";
import { GrnLineInput, PostedGrn, PostedGrnLine } from "./purchase-types";
import { RegimeState } from "./tax-types";
import { costPurchaseLine, round2, round4 } from "./tax-regime";

export interface PostGrnArgs {
  lines: GrnLineInput[];
  freightAmount: number;
  regime: RegimeState;
  materialsById: Map<number, Material>;
  supplierStateCode?: string;
}

export function postGrn({
  lines,
  freightAmount,
  regime,
  materialsById,
  supplierStateCode,
}: PostGrnArgs): PostedGrn {
  const accepted = lines.filter((l) => l.accepted_quantity > 0);

  // Freight is apportioned by taxable value, so a high-value line carries more
  // of the transport cost than a cheap one on the same truck.
  const lineTaxableValues = accepted.map((l) => round2(l.accepted_quantity * l.rate));
  const totalTaxable = round2(lineTaxableValues.reduce((s, v) => s + v, 0));

  const postedLines: PostedGrnLine[] = accepted.map((line, index) => {
    const material = materialsById.get(line.material_id);
    if (!material) {
      throw new Error(`Material ${line.material_id} not found while posting GRN`);
    }

    const taxableValue = lineTaxableValues[index];

    const costed = costPurchaseLine(
      {
        quantity: line.accepted_quantity,
        taxable_value: taxableValue,
        tax_rate: line.tax_rate,
        supplier_state_code: supplierStateCode,
      },
      regime
    );

    const freightShare =
      totalTaxable > 0 ? round2((freightAmount * taxableValue) / totalTaxable) : 0;

    // Purchase uom -> stock uom. 1 purchase uom = purchase_to_stock_factor stock uom.
    const stockQuantity = round4(
      line.accepted_quantity * (material.purchase_to_stock_factor || 1)
    );

    const inventoryValue = round2(costed.inventory_value + freightShare);
    const landedUnitCost = stockQuantity > 0 ? round4(inventoryValue / stockQuantity) : 0;

    const standardRate = material.standard_rate ?? 0;
    const variancePerUnit = round4(landedUnitCost - standardRate);

    return {
      material_id: material.id,
      material_code: material.code,
      material_name: material.name,
      batch_no: line.batch_no,
      dye_lot: line.dye_lot ?? null,

      accepted_quantity: line.accepted_quantity,
      purchase_uom: material.purchase_uom,
      stock_quantity: stockQuantity,
      stock_uom: material.stock_uom,

      taxable_value: taxableValue,
      tax_rate: line.tax_rate,
      cgst_amount: costed.cgst_amount,
      sgst_amount: costed.sgst_amount,
      igst_amount: costed.igst_amount,
      tax_amount: costed.tax_amount,

      freight_allocated: freightShare,
      inventory_value: inventoryValue,
      recoverable_tax: costed.recoverable_tax,
      unrecoverable_tax: costed.unrecoverable_tax,
      landed_unit_cost: landedUnitCost,

      standard_rate: standardRate,
      price_variance_per_unit: variancePerUnit,
      price_variance_total: round2(variancePerUnit * stockQuantity),
    };
  });

  return {
    cost_basis: regime.cost_basis,
    regime_at_receipt: regime.registered,
    gstin_at_receipt: regime.registration_number,
    lines: postedLines,
    total_taxable: totalTaxable,
    total_tax: round2(postedLines.reduce((s, l) => s + l.tax_amount, 0)),
    total_recoverable_tax: round2(postedLines.reduce((s, l) => s + l.recoverable_tax, 0)),
    total_freight: round2(freightAmount),
    total_inventory_value: round2(postedLines.reduce((s, l) => s + l.inventory_value, 0)),
    total_price_variance: round2(postedLines.reduce((s, l) => s + l.price_variance_total, 0)),
  };
}

/**
 * What the supplier is actually owed, which is always gross of tax regardless
 * of how we book the cost internally. Freight is added on top.
 */
export function supplierPayable(posted: PostedGrn): number {
  return round2(posted.total_taxable + posted.total_tax + posted.total_freight);
}
