/**
 * Tax regime switchover tests.
 *
 * Covers the rules from section 2.3 of the build brief that are most commonly
 * got wrong: effective dating, non-retroactivity, reversibility, dual cost
 * basis, and the intra/inter-state split.
 *
 * Run with:  npx tsx src/lib/__tests__/tax-regime.test.ts
 */

import {
  resolveRegimeForDate,
  costPurchaseLine,
  splitTax,
  jobWorkEffectiveCost,
  financialYearOf,
  UNREGISTERED_STATE,
} from "../tax-regime";
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

// -----------------------------------------------------------------------------
console.log("\n1. Unregistered shop (today's reality)");
{
  const regime = resolveRegimeForDate([], "2026-09-12");
  check("not registered", regime.registered, false);
  check("issues cash memo", regime.sales_document_type, "cash_memo");
  check("cost basis is inclusive", regime.cost_basis, "inclusive");
  check("no ITC", regime.itc_available, false);
  check("internal challan for job work", regime.challan_type, "internal");
  check("no statutory filing", regime.statutory_filing_required, false);
}

// -----------------------------------------------------------------------------
console.log("\n2. Effective dating — the switch is never retroactive");
{
  const periods: TaxRegimePeriod[] = [
    { id: 1, registration_number: "19ABCDE1234F1Z5", from_date: "2027-04-01",
      to_date: null, state_code: "19", composition_scheme: false },
  ];

  const before = resolveRegimeForDate(periods, "2026-12-31");
  check("sale before registration is still a cash memo", before.sales_document_type, "cash_memo");
  check("cost basis before registration stays inclusive", before.cost_basis, "inclusive");

  const dayBefore = resolveRegimeForDate(periods, "2027-03-31");
  check("day before registration is unregistered", dayBefore.registered, false);

  const onDay = resolveRegimeForDate(periods, "2027-04-01");
  check("registration day is registered", onDay.registered, true);
  check("issues tax invoice", onDay.sales_document_type, "tax_invoice");
  check("cost basis flips to net", onDay.cost_basis, "net");
  check("ITC becomes available", onDay.itc_available, true);
  check("Rule 45 challan for job work", onDay.challan_type, "rule_45");
  check("GSTIN carried through", onDay.registration_number, "19ABCDE1234F1Z5");

  const later = resolveRegimeForDate(periods, "2030-01-15");
  check("still registered years later", later.registered, true);
}

// -----------------------------------------------------------------------------
console.log("\n3. Reversibility — unregistered → registered → unregistered → registered");
{
  const periods: TaxRegimePeriod[] = [
    { id: 1, registration_number: "19AAAAA0000A1Z1", from_date: "2027-04-01",
      to_date: "2028-03-31", state_code: "19", composition_scheme: false },
    { id: 2, registration_number: "19BBBBB1111B2Z2", from_date: "2029-07-01",
      to_date: null, state_code: "19", composition_scheme: false },
  ];

  check("before first registration", resolveRegimeForDate(periods, "2026-06-01").registered, false);
  check("inside first registration", resolveRegimeForDate(periods, "2027-09-01").registered, true);
  check("in the deregistered gap", resolveRegimeForDate(periods, "2028-09-01").registered, false);
  check("gap reverts to cash memo",
    resolveRegimeForDate(periods, "2028-09-01").sales_document_type, "cash_memo");
  check("gap reverts to inclusive costing",
    resolveRegimeForDate(periods, "2028-09-01").cost_basis, "inclusive");
  check("inside second registration", resolveRegimeForDate(periods, "2030-01-01").registered, true);
  check("second GSTIN used, not the first",
    resolveRegimeForDate(periods, "2030-01-01").registration_number, "19BBBBB1111B2Z2");
}

// -----------------------------------------------------------------------------
console.log("\n4. Composition scheme — registered but no credit");
{
  const periods: TaxRegimePeriod[] = [
    { id: 1, registration_number: "19CCCCC2222C3Z3", from_date: "2027-04-01",
      to_date: null, state_code: "19", composition_scheme: true },
  ];
  const regime = resolveRegimeForDate(periods, "2027-05-01");
  check("registered", regime.registered, true);
  check("issues bill of supply, not tax invoice", regime.sales_document_type, "bill_of_supply");
  check("no input tax credit", regime.itc_available, false);
  check("cost basis stays inclusive", regime.cost_basis, "inclusive");
}

// -----------------------------------------------------------------------------
console.log("\n5. Dual cost basis — one service, two strategies");
{
  // ₹10,000 of plywood at 18%
  const facts = { quantity: 10, taxable_value: 10000, tax_rate: 18 };

  const unregistered = costPurchaseLine(facts, UNREGISTERED_STATE);
  check("unregistered: tax lands in inventory cost", unregistered.inventory_value, 11800);
  check("unregistered: nothing recoverable", unregistered.recoverable_tax, 0);
  check("unregistered: tax is a sunk cost", unregistered.unrecoverable_tax, 1800);
  check("unregistered: unit cost includes tax", unregistered.unit_cost, 1180);
  check("unregistered: tax amount still recorded", unregistered.tax_amount, 1800);

  const registeredPeriods: TaxRegimePeriod[] = [
    { id: 1, registration_number: "19ABCDE1234F1Z5", from_date: "2027-04-01",
      to_date: null, state_code: "19", composition_scheme: false },
  ];
  const registered = costPurchaseLine(facts, resolveRegimeForDate(registeredPeriods, "2027-06-01"));
  check("registered: inventory booked net of tax", registered.inventory_value, 10000);
  check("registered: tax recoverable as ITC", registered.recoverable_tax, 1800);
  check("registered: nothing sunk", registered.unrecoverable_tax, 0);
  check("registered: unit cost excludes tax", registered.unit_cost, 1000);

  check("switchover changes unit cost by exactly the tax",
    unregistered.unit_cost - registered.unit_cost, 180);
}

// -----------------------------------------------------------------------------
console.log("\n6. Intra-state vs inter-state split");
{
  const wbToWb = splitTax(10000, 18, "19", "19");
  check("WB→WB splits into CGST+SGST", [wbToWb.cgst_amount, wbToWb.sgst_amount, wbToWb.igst_amount],
    [900, 900, 0]);
  check("WB→WB is not interstate", wbToWb.is_interstate, false);

  const wbToBihar = splitTax(10000, 18, "19", "10");
  check("WB→Bihar is IGST only", [wbToBihar.cgst_amount, wbToBihar.sgst_amount, wbToBihar.igst_amount],
    [0, 0, 1800]);
  check("WB→Bihar is interstate", wbToBihar.is_interstate, true);

  // Odd-paise rounding must still sum exactly to the total
  const odd = splitTax(1000.05, 5, "19", "19");
  check("halves sum exactly to total", odd.cgst_amount + odd.sgst_amount, odd.total_tax);
}

// -----------------------------------------------------------------------------
console.log("\n7. Make-vs-buy flips automatically at registration");
{
  const labour = 5000;
  const unreg = jobWorkEffectiveCost(labour, 18, UNREGISTERED_STATE);
  check("unregistered: job worker tax is a real cost", unreg.effective_cost, 5900);

  const periods: TaxRegimePeriod[] = [
    { id: 1, registration_number: "19ABCDE1234F1Z5", from_date: "2027-04-01",
      to_date: null, state_code: "19", composition_scheme: false },
  ];
  const reg = jobWorkEffectiveCost(labour, 18, resolveRegimeForDate(periods, "2027-06-01"));
  check("registered: job worker tax becomes creditable", reg.effective_cost, 5000);
  check("outsourcing gets ₹900 cheaper on registration",
    unreg.effective_cost - reg.effective_cost, 900);
}

// -----------------------------------------------------------------------------
console.log("\n8. Financial year boundaries (April–March)");
{
  check("31 March belongs to previous FY", financialYearOf("2027-03-31"), "2026-27");
  check("1 April starts a new FY", financialYearOf("2027-04-01"), "2027-28");
  check("December sits mid-FY", financialYearOf("2026-12-25"), "2026-27");
}

// -----------------------------------------------------------------------------
console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
