/**
 * GRN posting tests — UOM conversion, dual cost basis, freight landing,
 * and purchase price variance.
 *
 * Run with:  npm run test:grn
 */

import { postGrn, supplierPayable } from "../grn-costing";
import { Material, MaterialType } from "../erp-types";
import { resolveRegimeForDate, UNREGISTERED_STATE } from "../tax-regime";
import { TaxRegimePeriod } from "../tax-types";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}\n      expected ${e}\n      actual   ${a}`);
  }
}

function material(over: Partial<Material>): Material {
  return {
    id: 1, code: "TMB-SHS-01", name: "Sheesham Timber", category_id: 1,
    material_type: "timber" as MaterialType,
    purchase_uom: "CFT", stock_uom: "CFT", consumption_uom: "RFT",
    purchase_to_stock_factor: 1, stock_to_consumption_factor: 12,
    tracks_batch: true, tracks_dye_lot: false, shelf_life_days: null, is_hazardous: false,
    reorder_level: 0, standard_rate: 2200, hsn_code: "4407",
    is_offcut: false, parent_material_id: null, attributes: {}, is_active: true,
    ...over,
  };
}

const REGISTERED_PERIODS: TaxRegimePeriod[] = [
  { id: 1, registration_number: "19ABCDE1234F1Z5", from_date: "2027-04-01",
    to_date: null, state_code: "19", composition_scheme: false },
];
const registeredRegime = resolveRegimeForDate(REGISTERED_PERIODS, "2027-06-01");

// -----------------------------------------------------------------------------
console.log("\n1. Purchase UOM converts to stock UOM before hitting the batch");
{
  // Plywood: bought per SHEET, stocked per SHEET (factor 1) — simple case
  const ply = material({
    id: 2, code: "PLY-BWR-18", name: "Plywood 18mm",
    purchase_uom: "SHEET", stock_uom: "SHEET", consumption_uom: "SQFT",
    purchase_to_stock_factor: 1, stock_to_consumption_factor: 32, standard_rate: 2850,
  });

  const posted = postGrn({
    lines: [{ material_id: 2, received_quantity: 10, accepted_quantity: 10,
      rejected_quantity: 0, rate: 2850, tax_rate: 18, batch_no: "PLY-A" }],
    freightAmount: 0,
    regime: UNREGISTERED_STATE,
    materialsById: new Map([[2, ply]]),
  });

  check("stock quantity equals purchase quantity at factor 1", posted.lines[0].stock_quantity, 10);
  check("stock uom recorded", posted.lines[0].stock_uom, "SHEET");
}

{
  // Fabric: bought per ROLL of 30 MTR, stocked in MTR — the conversion that matters
  const fabric = material({
    id: 4, code: "FAB-VLV-NVY", name: "Velvet Fabric",
    purchase_uom: "ROLL", stock_uom: "MTR", consumption_uom: "MTR",
    purchase_to_stock_factor: 30, stock_to_consumption_factor: 1, standard_rate: 480,
  });

  const posted = postGrn({
    lines: [{ material_id: 4, received_quantity: 2, accepted_quantity: 2,
      rejected_quantity: 0, rate: 14400, tax_rate: 5, batch_no: "FAB-A", dye_lot: "LOT-1" }],
    freightAmount: 0,
    regime: UNREGISTERED_STATE,
    materialsById: new Map([[4, fabric]]),
  });

  check("2 rolls become 60 metres of stock", posted.lines[0].stock_quantity, 60);
  // 2 rolls x 14400 = 28800 taxable, +5% = 30240 inclusive, over 60 MTR
  check("landed cost is per METRE, not per roll", posted.lines[0].landed_unit_cost, 504);
  check("dye lot carried onto the batch", posted.lines[0].dye_lot, "LOT-1");
}

// -----------------------------------------------------------------------------
console.log("\n2. Dual cost basis at receipt");
{
  const timber = material({});
  const line = { material_id: 1, received_quantity: 10, accepted_quantity: 10,
    rejected_quantity: 0, rate: 2000, tax_rate: 18, batch_no: "T-1" };

  const unreg = postGrn({
    lines: [line], freightAmount: 0, regime: UNREGISTERED_STATE,
    materialsById: new Map([[1, timber]]),
  });
  check("unregistered: tax inflates inventory value", unreg.total_inventory_value, 23600);
  check("unregistered: nothing recoverable", unreg.total_recoverable_tax, 0);
  check("unregistered: landed cost carries the tax", unreg.lines[0].landed_unit_cost, 2360);
  check("unregistered: cost basis stamped", unreg.cost_basis, "inclusive");

  const reg = postGrn({
    lines: [line], freightAmount: 0, regime: registeredRegime,
    materialsById: new Map([[1, timber]]),
  });
  check("registered: inventory booked net", reg.total_inventory_value, 20000);
  check("registered: tax recoverable", reg.total_recoverable_tax, 3600);
  check("registered: landed cost excludes tax", reg.lines[0].landed_unit_cost, 2000);
  check("registered: cost basis stamped", reg.cost_basis, "net");
  check("registered: GSTIN frozen onto the receipt", reg.gstin_at_receipt, "19ABCDE1234F1Z5");

  check("supplier is owed the same either way",
    supplierPayable(unreg), supplierPayable(reg));
}

// -----------------------------------------------------------------------------
console.log("\n3. Freight is landed into unit cost, apportioned by value");
{
  const timber = material({});
  const ply = material({
    id: 2, code: "PLY-BWR-18", name: "Plywood", purchase_uom: "SHEET", stock_uom: "SHEET",
    purchase_to_stock_factor: 1, standard_rate: 2850,
  });

  const posted = postGrn({
    lines: [
      // 30,000 taxable
      { material_id: 1, received_quantity: 10, accepted_quantity: 10, rejected_quantity: 0,
        rate: 3000, tax_rate: 0, batch_no: "T-1" },
      // 10,000 taxable
      { material_id: 2, received_quantity: 10, accepted_quantity: 10, rejected_quantity: 0,
        rate: 1000, tax_rate: 0, batch_no: "P-1" },
    ],
    freightAmount: 4000,
    regime: UNREGISTERED_STATE,
    materialsById: new Map([[1, timber], [2, ply]]),
  });

  check("freight split 75/25 by value",
    [posted.lines[0].freight_allocated, posted.lines[1].freight_allocated], [3000, 1000]);
  check("all freight is allocated, none lost",
    posted.lines[0].freight_allocated + posted.lines[1].freight_allocated, 4000);
  check("freight raises the landed unit cost", posted.lines[0].landed_unit_cost, 3300);
  check("total inventory value includes freight", posted.total_inventory_value, 44000);
}

// -----------------------------------------------------------------------------
console.log("\n4. Rejected quantity never enters stock");
{
  const timber = material({});
  const posted = postGrn({
    lines: [{ material_id: 1, received_quantity: 10, accepted_quantity: 7,
      rejected_quantity: 3, rejection_reason: "Excess moisture", rate: 2000,
      tax_rate: 0, batch_no: "T-1" }],
    freightAmount: 0, regime: UNREGISTERED_STATE,
    materialsById: new Map([[1, timber]]),
  });

  check("only accepted qty is stocked", posted.lines[0].stock_quantity, 7);
  check("only accepted qty is costed", posted.total_inventory_value, 14000);
}

{
  const timber = material({});
  const posted = postGrn({
    lines: [{ material_id: 1, received_quantity: 5, accepted_quantity: 0,
      rejected_quantity: 5, rejection_reason: "Wrong grade", rate: 2000,
      tax_rate: 18, batch_no: "T-BAD" }],
    freightAmount: 500, regime: UNREGISTERED_STATE,
    materialsById: new Map([[1, timber]]),
  });

  check("a fully rejected line produces no stock line", posted.lines.length, 0);
  check("and no inventory value", posted.total_inventory_value, 0);
}

// -----------------------------------------------------------------------------
console.log("\n5. Purchase price variance against standard rate");
{
  const timber = material({ standard_rate: 2200 });

  const overpaid = postGrn({
    lines: [{ material_id: 1, received_quantity: 10, accepted_quantity: 10,
      rejected_quantity: 0, rate: 2400, tax_rate: 0, batch_no: "T-1" }],
    freightAmount: 0, regime: UNREGISTERED_STATE,
    materialsById: new Map([[1, timber]]),
  });
  check("paying above standard shows positive variance",
    overpaid.lines[0].price_variance_per_unit, 200);
  check("variance totalled over stock quantity", overpaid.total_price_variance, 2000);

  const underpaid = postGrn({
    lines: [{ material_id: 1, received_quantity: 10, accepted_quantity: 10,
      rejected_quantity: 0, rate: 2000, tax_rate: 0, batch_no: "T-1" }],
    freightAmount: 0, regime: UNREGISTERED_STATE,
    materialsById: new Map([[1, timber]]),
  });
  check("buying below standard shows negative variance",
    underpaid.lines[0].price_variance_per_unit, -200);
}

// -----------------------------------------------------------------------------
console.log("\n6. Inter-state purchase attracts IGST, not CGST/SGST");
{
  const timber = material({});
  const posted = postGrn({
    lines: [{ material_id: 1, received_quantity: 10, accepted_quantity: 10,
      rejected_quantity: 0, rate: 2000, tax_rate: 18, batch_no: "T-1" }],
    freightAmount: 0,
    regime: registeredRegime,
    materialsById: new Map([[1, timber]]),
    supplierStateCode: "10", // Bihar supplier into West Bengal
  });

  check("IGST charged in full", posted.lines[0].igst_amount, 3600);
  check("no CGST/SGST on inter-state",
    [posted.lines[0].cgst_amount, posted.lines[0].sgst_amount], [0, 0]);
  check("still fully recoverable when registered", posted.total_recoverable_tax, 3600);
}

// -----------------------------------------------------------------------------
console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
