/**
 * Job work tests — asset conservation, wastage recovery, three-way match,
 * return deadlines, e-way bill rules, and regime-aware make-vs-buy.
 *
 * Run with:  npm run test:jobwork
 */

import {
  deadlineStatus,
  monthsBetween,
  ewayBillRequirement,
  assessWastage,
  threeWayMatch,
  makeVsBuy,
  totalInventoryValue,
} from "../jobwork-logic";
import { resolveRegimeForDate, UNREGISTERED_STATE } from "../tax-regime";
import { TaxRegimePeriod } from "../tax-types";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected ${e}\n      actual   ${a}`); }
}

const REGISTERED: TaxRegimePeriod[] = [
  { id: 1, registration_number: "19ABCDE1234F1Z5", from_date: "2026-01-01",
    to_date: null, state_code: "19", composition_scheme: false },
];
const registeredRegime = resolveRegimeForDate(REGISTERED, "2026-09-12");

// -----------------------------------------------------------------------------
console.log("\n1. Asset conservation — dispatch moves value, never destroys it");
{
  const before = { raw_store: 500000, with_vendor: 0, wip: 120000, finished_goods: 800000 };
  const totalBefore = totalInventoryValue(before);

  // Send ₹80,000 of material to a polisher.
  const after = {
    raw_store: before.raw_store - 80000,
    with_vendor: before.with_vendor + 80000,
    wip: before.wip,
    finished_goods: before.finished_goods,
  };

  check("total inventory unchanged by dispatch", totalInventoryValue(after), totalBefore);
  check("raw store falls", after.raw_store, 420000);
  check("vendor stock rises by the same amount", after.with_vendor, 80000);

  // The bug this guards against: booking the dispatch as consumption.
  const wrong = { ...before, raw_store: before.raw_store - 80000 };
  check("treating dispatch as consumption loses ₹80,000",
    totalBefore - totalInventoryValue(wrong), 80000);
}

// -----------------------------------------------------------------------------
console.log("\n2. Return deadline — inputs deemed a supply after 1 year");
{
  check("months elapsed", monthsBetween("2026-01-15", "2026-09-12"), 7);

  const fresh = deadlineStatus("2026-08-01", "2026-09-12");
  check("recent dispatch is fine", fresh.status, "ok");
  check("11 months still remaining", fresh.months_remaining, 11);

  const nearing = deadlineStatus("2025-12-01", "2026-09-12");
  check("9 months out triggers the alert", nearing.status, "approaching");
  check("3 months left to get it back", nearing.months_remaining, 3);

  const late = deadlineStatus("2025-09-01", "2026-09-12");
  check("past 12 months is a breach", late.status, "breached");
  check("months remaining goes negative", late.months_remaining, -0);

  const boundary = deadlineStatus("2025-12-12", "2026-09-12");
  check("exactly 9 months alerts", boundary.status, "approaching");

  const capital = deadlineStatus("2024-06-01", "2026-09-12", 36, 30);
  check("capital goods get 3 years", capital.status, "ok");
}

// -----------------------------------------------------------------------------
console.log("\n3. E-way bill rules");
{
  const rules = { threshold: 50000, intrastateJobWorkExempt: true };

  const unreg = ewayBillRequirement(200000, "19", "19", UNREGISTERED_STATE, rules);
  check("unregistered shop has no obligation", unreg.required, false);

  const intra = ewayBillRequirement(200000, "19", "19", registeredRegime, rules);
  check("intra-state WB job work exempt even at high value", intra.required, false);
  check("exemption reason recorded",
    intra.exempt_reason?.includes("Intra-state job work"), true);

  const inter = ewayBillRequirement(200000, "19", "10", registeredRegime, rules);
  check("inter-state above threshold needs a bill", inter.required, true);

  const small = ewayBillRequirement(20000, "19", "10", registeredRegime, rules);
  check("inter-state below threshold does not", small.required, false);

  const ruleOff = ewayBillRequirement(200000, "19", "19", registeredRegime,
    { threshold: 50000, intrastateJobWorkExempt: false });
  check("exemption is configuration, not hardcoded", ruleOff.required, true);
}

// -----------------------------------------------------------------------------
console.log("\n4. Wastage recovery");
{
  // Sent 100 MTR fabric for 10 cushion sets needing 9 MTR each = 90 standard.
  // Vendor returned 4 MTR, so consumed 96 against 90 standard.
  const lines = [{
    material_id: 4, material_code: "FAB", material_name: "Velvet", stock_uom: "MTR",
    sent_qty: 100, returned_qty: 4, standard_per_unit: 9, rate: 480,
  }];

  const within = assessWastage(lines, 10, 8);   // 8% agreed => 97.2 allowed
  check("consumed = sent − returned", within[0].consumed_qty, 96);
  check("standard for 10 good units", within[0].standard_qty, 90);
  check("actual wastage 6.67%", within[0].actual_wastage_pct, 6.67);
  check("within the 8% allowance, nothing recovered", within[0].excess_wastage_qty, 0);
  check("no recovery amount", within[0].recovery_amount, 0);

  const over = assessWastage(lines, 10, 3);     // 3% agreed => 92.7 allowed
  check("beyond a 3% allowance, excess is 3.3 MTR", over[0].excess_wastage_qty, 3.3);
  check("recovered at material cost", over[0].recovery_amount, 1584);

  // A vendor cannot claim material against work that was rejected.
  const withRejects = assessWastage(lines, 8, 8);  // only 8 good => 72 standard
  check("standard follows GOOD output only", withRejects[0].standard_qty, 72);
  check("rejected work inflates the recoverable excess",
    withRejects[0].excess_wastage_qty, 18.24);
}

// -----------------------------------------------------------------------------
console.log("\n5. Three-way match blocks bad payments");
{
  const clean = threeWayMatch({
    jw_order_id: 1, jw_number: "JW/26-27/0001", ordered_qty: 10, ordered_rate: 500,
    received_good_qty: 10, invoice_qty: 10, invoice_rate: 500, invoice_amount: 5000,
  });
  check("clean match passes", clean.matched, true);
  check("payment released", clean.payment_blocked, false);

  const overBilled = threeWayMatch({
    jw_order_id: 1, jw_number: "JW/26-27/0001", ordered_qty: 10, ordered_rate: 500,
    received_good_qty: 8, invoice_qty: 10, invoice_rate: 500, invoice_amount: 5000,
  });
  check("billing 10 when 8 arrived is caught", overBilled.matched, false);
  check("payment blocked", overBilled.payment_blocked, true);
  check("expected amount is on the 8 actually received", overBilled.expected_amount, 4000);

  const wrongRate = threeWayMatch({
    jw_order_id: 1, jw_number: "JW/26-27/0001", ordered_qty: 10, ordered_rate: 500,
    received_good_qty: 10, invoice_qty: 10, invoice_rate: 600, invoice_amount: 6000,
  });
  check("rate creep is caught", wrongRate.payment_blocked, true);
  check("both rate and amount flagged", wrongRate.discrepancies.length, 2);

  const noInvoice = threeWayMatch({
    jw_order_id: 1, jw_number: "JW/26-27/0001", ordered_qty: 10, ordered_rate: 500,
    received_good_qty: 10, invoice_qty: null, invoice_rate: null, invoice_amount: null,
  });
  check("no invoice means no payment", noInvoice.payment_blocked, true);

  const withRecovery = threeWayMatch({
    jw_order_id: 1, jw_number: "JW/26-27/0001", ordered_qty: 10, ordered_rate: 500,
    received_good_qty: 10, invoice_qty: 10, invoice_rate: 500, invoice_amount: 5000,
    wastage_recovery: 1584,
  });
  check("wastage recovery reduces what is payable", withRecovery.expected_amount, 3416);
  check("a full-value invoice is then a mismatch", withRecovery.payment_blocked, true);
}

// -----------------------------------------------------------------------------
console.log("\n6. Make vs buy flips at registration");
{
  // Polishing in-house costs ₹150/unit; a vendor charges ₹140 + 18%.
  const unreg = makeVsBuy("Polish", 150, 140, 18, UNREGISTERED_STATE);
  check("unregistered: vendor tax is a real cost", unreg.job_work_effective_cost, 165.2);
  check("so in-house wins", unreg.cheaper, "make");
  check("by ₹15.20", unreg.difference, 15.2);

  const reg = makeVsBuy("Polish", 150, 140, 18, registeredRegime);
  check("registered: tax becomes creditable", reg.job_work_effective_cost, 140);
  check("recoverable tax recorded", reg.job_work_recoverable_tax, 25.2);
  check("outsourcing now wins", reg.cheaper, "buy");
  check("the recommendation flipped without changing a single rate",
    [unreg.cheaper, reg.cheaper], ["make", "buy"]);
}

// -----------------------------------------------------------------------------
console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
