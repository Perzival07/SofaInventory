/**
 * Sales, delivery, khata and turnover tests.
 *
 * Run with:  npm run test:sales
 */

import {
  isSellable, sellableReason, canBillAsNew, needsMarkdown, daysOnFloor,
  computeAtp, isHoldExpired, softHoldExpiry, computeDelivery, vehicleLoad,
  registrationTriggers, computeTurnoverStatus, seasonalProjection, fyMonthsElapsed,
  computeKhataBalance, summariseKhata, priceOrder,
} from "../sales-logic";
import { FinishedUnit, KhataEntry, ConditionGrade } from "../sales-types";
import { resolveRegimeForDate, UNREGISTERED_STATE } from "../tax-regime";
import { TaxRegimePeriod } from "../tax-types";

let passed = 0, failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected ${e}\n      actual   ${a}`); }
}

function unit(over: Partial<FinishedUnit>): FinishedUnit {
  return {
    id: 1, serial_no: "SN-001", product_id: 1, work_order_id: null,
    condition_grade: "new_in_box", cost: 23000, list_price: 42000,
    carton_total: 1, cartons_present: 1, floor_since: null,
    status: "available", reserved_for_order_id: null, hold_expires_at: null,
    location: null, created_at: "2026-09-01", ...over,
  };
}

const REGISTERED: TaxRegimePeriod[] = [
  { id: 1, registration_number: "19ABCDE1234F1Z5", from_date: "2026-01-01",
    to_date: null, state_code: "19", composition_scheme: false },
];
const registered = resolveRegimeForDate(REGISTERED, "2026-09-12");

// -----------------------------------------------------------------------------
console.log("\n1. Multi-carton units — a missing box makes it unsellable");
{
  check("complete unit is sellable", isSellable(unit({})), true);

  const partial = unit({ carton_total: 4, cartons_present: 3 });
  check("3 of 4 cartons is NOT sellable", isSellable(partial), false);
  check("and says why", sellableReason(partial), "Incomplete — 3 of 4 cartons present");

  check("all 4 present is sellable",
    isSellable(unit({ carton_total: 4, cartons_present: 4 })), true);
  check("damaged is not sellable", isSellable(unit({ status: "damaged" })), false);
  check("held stock is not sellable", isSellable(unit({ status: "hard_reserved" })), false);
}

// -----------------------------------------------------------------------------
console.log("\n2. Condition grades — a floor model can never be sold as new");
{
  check("new in box can be billed as new", canBillAsNew("new_in_box"), true);
  for (const g of ["floor_model", "open_box", "minor_damage", "as_is_clearance", "customer_return"] as ConditionGrade[]) {
    check(`${g} cannot be billed as new`, canBillAsNew(g), false);
  }
}

// -----------------------------------------------------------------------------
console.log("\n3. Floor sample lifecycle");
{
  check("days on floor", daysOnFloor("2026-06-14", "2026-09-12"), 90);

  const fresh = unit({ condition_grade: "floor_model", floor_since: "2026-08-01" });
  check("6 weeks on the floor is fine", needsMarkdown(fresh, "2026-09-12"), false);

  const stale = unit({ condition_grade: "floor_model", floor_since: "2026-05-01" });
  check("past 90 days flags for markdown", needsMarkdown(stale, "2026-09-12"), true);

  const boxed = unit({ condition_grade: "new_in_box", floor_since: "2026-05-01" });
  check("a boxed unit is never a markdown candidate", needsMarkdown(boxed, "2026-09-12"), false);
}

// -----------------------------------------------------------------------------
console.log("\n4. ATP excludes what cannot actually be handed over");
{
  const units = [
    unit({ id: 1, status: "available" }),
    unit({ id: 2, status: "available" }),
    unit({ id: 3, status: "soft_reserved" }),
    unit({ id: 4, status: "hard_reserved" }),
    unit({ id: 5, status: "damaged" }),
    unit({ id: 6, status: "available", carton_total: 4, cartons_present: 2 }),
    unit({ id: 7, status: "sold" }),
  ];

  const atp = computeAtp(1, "Chesterfield Sofa", units, 6, "2026-11-14");
  check("only genuinely free complete units count", atp.available_now, 2);
  check("on hand counts everything unsold", atp.on_hand, 6);
  check("incomplete sets reported separately", atp.incomplete, 1);
  check("soft holds visible", atp.soft_reserved, 1);
  check("hard holds visible", atp.hard_reserved, 1);
  check("2 now, 8 once production lands", atp.available_later, 8);
  check("promise date carried", atp.next_available_date, "2026-11-14");
}

// -----------------------------------------------------------------------------
console.log("\n5. Soft holds lapse, hard holds do not");
{
  const expiry = softHoldExpiry("2026-09-10T10:00:00Z");
  check("quote holds for 48 hours", expiry.slice(0, 13), "2026-09-12T10");

  const soft = unit({ status: "soft_reserved", hold_expires_at: "2026-09-11T10:00:00Z" });
  check("lapsed quote frees the unit", isHoldExpired(soft, "2026-09-12T10:00:00Z"), true);
  check("live quote still holds", isHoldExpired(soft, "2026-09-10T10:00:00Z"), false);

  const hard = unit({ status: "hard_reserved", hold_expires_at: null });
  check("a confirmed order never lapses", isHoldExpired(hard, "2030-01-01T00:00:00Z"), false);
}

// -----------------------------------------------------------------------------
console.log("\n6. Delivery — zone, floor and lift");
{
  const barasat = computeDelivery("BARASAT", 0, false);
  check("ground floor in Barasat", barasat.total_charge, 250);

  const thirdNoLift = computeDelivery("BARASAT", 3, false);
  check("third floor no lift adds 2 floors of surcharge", thirdNoLift.floor_surcharge, 300);
  check("total reflects the carry", thirdNoLift.total_charge, 550);

  const thirdWithLift = computeDelivery("BARASAT", 3, true);
  check("a lift removes the surcharge", thirdWithLift.floor_surcharge, 0);

  const saltlake = computeDelivery("SALTLAKE", 2, false);
  check("Salt Lake costs more and sends a bigger crew",
    [saltlake.base_charge, saltlake.crew_size], [650, 3]);

  const load = vehicleLoad(200, "Tempo");
  check("200 cu ft needs 3 tempo trips", load.trips, 3);
  check("utilisation reported", load.utilisation_pct, 83.33);
}

// -----------------------------------------------------------------------------
console.log("\n7. Registration triggers fire regardless of turnover");
{
  const clean = registrationTriggers({
    regime: UNREGISTERED_STATE, zoneCode: "BARASAT", channel: "walk_in",
    servicesItemised: false, buyerGstin: null,
  });
  check("an ordinary local sale triggers nothing", clean.length, 0);

  const interstate = registrationTriggers({
    regime: UNREGISTERED_STATE, zoneCode: "INTERSTATE", channel: "walk_in",
    servicesItemised: false, buyerGstin: null,
  });
  check("delivery outside WB is blocking", interstate[0].severity, "blocking");
  check("and names the reason", interstate[0].code, "interstate_supply");

  const ecom = registrationTriggers({
    regime: UNREGISTERED_STATE, zoneCode: "BARASAT", channel: "ecommerce",
    servicesItemised: false, buyerGstin: null,
  });
  check("marketplace sales are blocking", ecom[0].code, "ecommerce_channel");

  const itemised = registrationTriggers({
    regime: UNREGISTERED_STATE, zoneCode: "BARASAT", channel: "walk_in",
    servicesItemised: true, buyerGstin: null,
  });
  check("separately billed services warn about the services threshold",
    itemised[0].code, "itemised_services");
  check("as a warning, not a block", itemised[0].severity, "warning");

  const b2b = registrationTriggers({
    regime: UNREGISTERED_STATE, zoneCode: "BARASAT", channel: "walk_in",
    servicesItemised: false, buyerGstin: "19AAAAA0000A1Z1",
  });
  check("a registered buyer raises the e-way bill note", b2b[0].code, "registered_buyer");

  const onceRegistered = registrationTriggers({
    regime: registered, zoneCode: "INTERSTATE", channel: "ecommerce",
    servicesItemised: true, buyerGstin: "19AAAAA0000A1Z1",
  });
  check("all of it goes quiet once registered", onceRegistered.length, 0);
}

// -----------------------------------------------------------------------------
console.log("\n8. Turnover watchdog");
{
  const safe = computeTurnoverStatus({
    financial_year: "2026-27", shop_turnover: 1200000, other_pan_turnover: 0,
    threshold: 4000000, amber: 3000000, red: 3500000, blocking: 3800000, months_elapsed: 6,
  });
  check("₹12L is safe", safe.band, "safe");
  check("headroom reported", safe.headroom, 2800000);

  const amber = computeTurnoverStatus({
    financial_year: "2026-27", shop_turnover: 3100000, other_pan_turnover: 0,
    threshold: 4000000, amber: 3000000, red: 3500000, blocking: 3800000, months_elapsed: 8,
  });
  check("₹31L is amber", amber.band, "amber");

  const red = computeTurnoverStatus({
    financial_year: "2026-27", shop_turnover: 3600000, other_pan_turnover: 0,
    threshold: 4000000, amber: 3000000, red: 3500000, blocking: 3800000, months_elapsed: 9,
  });
  check("₹36L is red", red.band, "red");

  const blocking = computeTurnoverStatus({
    financial_year: "2026-27", shop_turnover: 3850000, other_pan_turnover: 0,
    threshold: 4000000, amber: 3000000, red: 3500000, blocking: 3800000, months_elapsed: 10,
  });
  check("₹38.5L is blocking", blocking.band, "blocking");

  // Aggregate turnover is PAN-wide, not per shop — the classic trap.
  const withOther = computeTurnoverStatus({
    financial_year: "2026-27", shop_turnover: 2500000, other_pan_turnover: 900000,
    threshold: 4000000, amber: 3000000, red: 3500000, blocking: 3800000, months_elapsed: 8,
  });
  check("shop alone would be safe", 2500000 < 3000000, true);
  check("but PAN-wide aggregate is amber", withOther.band, "amber");
  check("aggregate includes the other business", withOther.aggregate_turnover, 3400000);
}

// -----------------------------------------------------------------------------
console.log("\n9. Seasonal projection beats a straight-line run rate");
{
  check("FY month index: April is month 1", fyMonthsElapsed("2026-04-15"), 1);
  check("September is month 6", fyMonthsElapsed("2026-09-12"), 6);
  check("March is month 12", fyMonthsElapsed("2027-03-20"), 12);

  // ₹15L by end of September, before the festive quarter has happened.
  const status = computeTurnoverStatus({
    financial_year: "2026-27", shop_turnover: 1500000, other_pan_turnover: 0,
    threshold: 4000000, amber: 3000000, red: 3500000, blocking: 3800000, months_elapsed: 6,
  });
  check("straight-line says ₹30L", status.projected_year_end, 3000000);
  check("seasonal weighting sees the festive quarter coming",
    status.projected_seasonal > status.projected_year_end, true);
  check("and warns the threshold will be crossed",
    status.message.includes("festive"), true);
  check("projection is 39.9L — under the threshold but past the blocking band",
    status.projected_seasonal, 3990000);

  check("a full year needs no projection", seasonalProjection(4000000, 12), 4000000);
}

// -----------------------------------------------------------------------------
console.log("\n10. Khata running balance");
{
  const entries: KhataEntry[] = [
    { id: 1, customer_id: 1, order_id: 1, entry_date: "2026-07-01", amount: 42000,
      mode: null, reference: "CM/26-27/0001", notes: null },
    { id: 2, customer_id: 1, order_id: null, entry_date: "2026-07-01", amount: -15000,
      mode: "cash", reference: null, notes: "Advance" },
    { id: 3, customer_id: 1, order_id: null, entry_date: "2026-08-05", amount: -10000,
      mode: "upi", reference: "UPI-8842", notes: "Instalment 1" },
    { id: 4, customer_id: 1, order_id: 2, entry_date: "2026-09-01", amount: 18500,
      mode: null, reference: "CM/26-27/0014", notes: null },
  ];

  const withBalance = computeKhataBalance(entries);
  check("running balance after each entry",
    withBalance.map((e) => e.balance), [42000, 27000, 17000, 35500]);

  const acct = summariseKhata(1, "Sujata Ghosh", "9830099999", entries, "2026-09-12");
  check("total billed", acct.total_billed, 60500);
  check("total paid", acct.total_paid, 25000);
  check("outstanding balance", acct.balance, 35500);
  check("oldest unpaid charge is the July sale", acct.oldest_due_date, "2026-07-01");
  check("days overdue from that date", acct.days_overdue, 73);

  const settled = summariseKhata(1, "X", "1", [
    { id: 1, customer_id: 1, order_id: 1, entry_date: "2026-07-01", amount: 5000, mode: null, reference: null, notes: null },
    { id: 2, customer_id: 1, order_id: null, entry_date: "2026-07-10", amount: -5000, mode: "cash", reference: null, notes: null },
  ], "2026-09-12");
  check("a settled account shows no due date", settled.oldest_due_date, null);
  check("and no overdue days", settled.days_overdue, 0);
}

// -----------------------------------------------------------------------------
console.log("\n11. Order pricing — the customer-facing total does not jump on registration");
{
  const lines = [{ product_id: 1, quantity: 1, unit_price: 42000, tax_rate: 18 }];

  const unreg = priceOrder(lines, 250, 15000, UNREGISTERED_STATE, "19");
  check("unregistered: cash memo", unreg.document_type, "cash_memo");
  check("no tax broken out", unreg.tax_total, 0);
  check("total is simply price plus delivery", unreg.grand_total, 42250);
  check("balance after advance", unreg.balance_due, 27250);
  check("no tax fields on the line", unreg.lines[0].taxable_value, null);

  const reg = priceOrder(lines, 250, 15000, registered, "19");
  check("registered: tax invoice", reg.document_type, "tax_invoice");
  check("customer still pays the same", reg.grand_total, 42250);
  check("but tax is now broken out of it", reg.tax_total, 6406.78);
  check("taxable value backed out", reg.lines[0].taxable_value, 35593.22);
  check("split CGST/SGST for a WB buyer",
    [reg.lines[0].cgst_amount, reg.lines[0].sgst_amount], [3203.39, 3203.39]);

  const interstate = priceOrder(lines, 250, 0, registered, "10");
  check("out-of-state buyer gets IGST", interstate.lines[0].igst_amount, 6406.78);
  check("and no CGST/SGST",
    [interstate.lines[0].cgst_amount, interstate.lines[0].sgst_amount], [0, 0]);
}

// -----------------------------------------------------------------------------
console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
