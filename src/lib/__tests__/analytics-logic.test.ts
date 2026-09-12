/**
 * Analytics tests — margin on actual cost, ageing, seasonality, FY export.
 *
 * Run with:  npm run test:analytics
 */

import {
  computeSkuMargins, ageingBucketFor, buildAgeing, daysSince,
  buildSeasonality, buildFyExport, toCsv, SEASON_BY_MONTH,
} from "../analytics-logic";

let passed = 0, failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected ${e}\n      actual   ${a}`); }
}

// -----------------------------------------------------------------------------
console.log("\n1. Gross margin on ACTUAL cost");
{
  const lines = [
    { product_id: 1, product_name: "Chesterfield Sofa", quantity: 2, line_total: 84000, unit_cost: 23764 },
    { product_id: 1, product_name: "Chesterfield Sofa", quantity: 1, line_total: 42000, unit_cost: 25100 },
    { product_id: 2, product_name: "Recliner", quantity: 3, line_total: 93000, unit_cost: 22000 },
  ];

  const margins = computeSkuMargins(lines);

  const sofa = margins.find((m) => m.product_id === 1)!;
  check("units aggregated across orders", sofa.units_sold, 3);
  check("revenue summed", sofa.revenue, 126000);
  check("cost uses each unit's own actual cost", sofa.cost, 2 * 23764 + 25100);
  check("gross margin", sofa.gross_margin, 126000 - 72628);
  check("margin percentage", sofa.margin_pct, 42.36);

  const recliner = margins.find((m) => m.product_id === 2)!;
  check("recliner margin", recliner.gross_margin, 93000 - 66000);

  check("sorted by absolute margin, biggest first", margins[0].product_id, 1);
}

{
  // A unit produced before cost capture existed carries zero cost. Reporting
  // that as 100% margin would be misleading; it shows as 100% only because
  // revenue is real and cost is genuinely unknown — flagged by cost === 0.
  const margins = computeSkuMargins([
    { product_id: 9, product_name: "Legacy item", quantity: 1, line_total: 10000, unit_cost: 0 },
  ]);
  check("uncosted line shows zero cost", margins[0].cost, 0);
  check("and therefore 100% margin, which the UI must flag", margins[0].margin_pct, 100);
}

// -----------------------------------------------------------------------------
console.log("\n2. Ageing buckets");
{
  check("fresh stock", ageingBucketFor(10), "0–30 days");
  check("boundary at 30", ageingBucketFor(30), "0–30 days");
  check("31 rolls over", ageingBucketFor(31), "31–60 days");
  check("three months", ageingBucketFor(95), "91–180 days");
  check("very old", ageingBucketFor(400), "Over 180 days");

  const buckets = buildAgeing([
    { days_idle: 5, value: 10000 },
    { days_idle: 20, value: 5000 },
    { days_idle: 100, value: 42000 },
    { days_idle: 400, value: 18000 },
  ]);

  check("all five buckets always present", buckets.length, 5);
  check("fresh bucket holds two items", buckets[0].count, 2);
  check("fresh value summed", buckets[0].value, 15000);
  check("empty bucket still reported", buckets[1].count, 0);
  check("dead stock lands in the oldest bucket", buckets[4].value, 18000);

  check("days since", daysSince("2026-06-14", "2026-09-12"), 90);
}

// -----------------------------------------------------------------------------
console.log("\n3. Bengali trade seasonality");
{
  check("October is the Puja peak", SEASON_BY_MONTH[9], "Durga–Kali Puja (peak)");
  check("June is the monsoon lull", SEASON_BY_MONTH[5], "Monsoon (slow)");
  check("April is Poila Boishakh", SEASON_BY_MONTH[3], "Poila Boishakh");

  const months = buildSeasonality([
    { order_date: "2026-10-05", grand_total: 120000 },
    { order_date: "2026-10-18", grand_total: 85000 },
    { order_date: "2026-06-11", grand_total: 22000 },
    { order_date: "2026-11-02", grand_total: 64000 },
  ]);

  check("twelve months returned", months.length, 12);
  check("starts at April, not January", months[0].month_label, "April");
  check("ends at March", months[11].month_label, "March");

  const oct = months.find((m) => m.month_index === 9)!;
  check("October revenue aggregated", oct.revenue, 205000);
  check("October order count", oct.orders, 2);
  check("and tagged with its season", oct.season, "Durga–Kali Puja (peak)");

  const jun = months.find((m) => m.month_index === 5)!;
  check("monsoon month is far quieter", jun.revenue, 22000);

  const may = months.find((m) => m.month_index === 4)!;
  check("a month with no trade shows zero, not missing", may.revenue, 0);
}

// -----------------------------------------------------------------------------
console.log("\n4. Financial-year export for the accountant");
{
  const rows = buildFyExport({
    financial_year: "2026-27",
    purchases_taxable: 850000, purchases_tax: 153000,
    sales_total: 1450000, sales_tax: 0,
    opening_stock: 0,
    closing_rm: 445140, closing_wip: 62000, closing_fg: 310000, closing_with_vendor: 43600,
    wages_paid: 96000, jobwork_charges: 41000,
  });

  const closing = rows.find((r) => r.label === "Total closing stock")!;
  check("closing stock sums all four buckets", closing.value, 445140 + 62000 + 310000 + 43600);

  const vendorRow = rows.find((r) => r.label === "Stock with job workers")!;
  check("stock with vendors is listed as our asset", vendorRow.value, 43600);
  check("and explained", vendorRow.note?.toLowerCase().includes("our asset"), true);

  const salesTax = rows.find((r) => r.label === "Of which tax collected")!;
  check("no tax collected while unregistered", salesTax.value, 0);

  const purchaseTax = rows.find((r) => r.label === "Tax paid to suppliers")!;
  check("supplier tax still reported", purchaseTax.value, 153000);
  check("with its treatment explained",
    purchaseTax.note?.includes("Unrecoverable"), true);

  const csv = toCsv(rows, "2026-27");
  check("csv carries a header row", csv.includes("Section,Item,Amount (INR),Note"), true);
  check("csv names the shop and year", csv.includes("Financial Year 2026-27"), true);
  check("values quoted so commas in notes cannot break columns",
    csv.includes('"445140.00"'), true);
}

// -----------------------------------------------------------------------------
console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
