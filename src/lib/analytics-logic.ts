/**
 * Analytics — pure functions.
 *
 * Margin is computed on ACTUAL production cost carried by each unit, not on a
 * standard rate. Standard-cost margin flatters exactly the products whose real
 * cost has drifted, which is the opposite of useful.
 */

import { round2 } from "./tax-regime";

export interface StockValuation {
  raw_material: number;
  with_vendor: number;
  wip: number;
  finished_goods: number;
  total: number;
}

export interface SkuMargin {
  product_id: number;
  product_name: string;
  units_sold: number;
  revenue: number;
  /** Sum of actual unit costs */
  cost: number;
  gross_margin: number;
  margin_pct: number;
}

export interface AgeingBucket {
  label: string;
  count: number;
  value: number;
}

export interface DeadStockLine {
  kind: "raw_material" | "finished_goods";
  id: number;
  code: string;
  name: string;
  quantity: number;
  uom: string;
  value: number;
  days_idle: number;
  bucket: string;
}

export interface SeasonMonth {
  month_label: string;
  month_index: number;
  season: string | null;
  revenue: number;
  orders: number;
}

/**
 * Bengali trade seasons, tagged by month rather than Gregorian quarter.
 * Month numbers are JavaScript's zero-based index: January = 0, December = 11.
 */
export const SEASON_BY_MONTH: Record<number, string | null> = {
  3: "Poila Boishakh",       // April
  4: null,                   // May
  5: "Monsoon (slow)",       // June
  6: "Monsoon (slow)",       // July
  7: "Monsoon (slow)",       // August
  8: "Pre-Puja build-up",    // September
  9: "Durga–Kali Puja (peak)", // October
  10: "Kali Puja & weddings",  // November
  11: "Agrahayan weddings",    // December
  0: "Magh weddings",          // January
  1: "Falgun weddings",        // February
  2: null,                     // March
};

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ageingBucketFor(days: number): string {
  if (days <= 30) return "0–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  if (days <= 180) return "91–180 days";
  return "Over 180 days";
}

export const AGEING_ORDER = [
  "0–30 days", "31–60 days", "61–90 days", "91–180 days", "Over 180 days",
];

export function daysSince(from: string, to: string): number {
  return Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
  );
}

export function buildAgeing(
  items: { days_idle: number; value: number }[]
): AgeingBucket[] {
  const buckets = new Map<string, AgeingBucket>(
    AGEING_ORDER.map((label) => [label, { label, count: 0, value: 0 }])
  );
  for (const i of items) {
    const b = buckets.get(ageingBucketFor(i.days_idle))!;
    b.count += 1;
    b.value = round2(b.value + i.value);
  }
  return AGEING_ORDER.map((l) => buckets.get(l)!);
}

/**
 * Gross margin per SKU on actual cost. Lines with no cost captured are excluded
 * from the margin percentage rather than being shown as 100% margin, which
 * would be a lie by omission.
 */
export function computeSkuMargins(
  lines: {
    product_id: number; product_name: string;
    quantity: number; line_total: number; unit_cost: number;
  }[]
): SkuMargin[] {
  const byProduct = new Map<number, SkuMargin>();

  for (const l of lines) {
    let row = byProduct.get(l.product_id);
    if (!row) {
      row = {
        product_id: l.product_id, product_name: l.product_name,
        units_sold: 0, revenue: 0, cost: 0, gross_margin: 0, margin_pct: 0,
      };
      byProduct.set(l.product_id, row);
    }
    row.units_sold += l.quantity;
    row.revenue = round2(row.revenue + l.line_total);
    row.cost = round2(row.cost + l.unit_cost * l.quantity);
  }

  return [...byProduct.values()]
    .map((r) => ({
      ...r,
      gross_margin: round2(r.revenue - r.cost),
      margin_pct: r.revenue > 0 ? round2(((r.revenue - r.cost) / r.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.gross_margin - a.gross_margin);
}

export function buildSeasonality(
  orders: { order_date: string; grand_total: number }[]
): SeasonMonth[] {
  const byMonth = new Map<number, { revenue: number; orders: number }>();
  for (const o of orders) {
    const m = new Date(o.order_date).getMonth();
    const row = byMonth.get(m) ?? { revenue: 0, orders: 0 };
    row.revenue = round2(row.revenue + o.grand_total);
    row.orders += 1;
    byMonth.set(m, row);
  }

  // Financial-year order: April through March.
  const fyOrder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
  return fyOrder.map((m) => ({
    month_label: MONTH_LABELS[m],
    month_index: m,
    season: SEASON_BY_MONTH[m],
    revenue: byMonth.get(m)?.revenue ?? 0,
    orders: byMonth.get(m)?.orders ?? 0,
  }));
}

export interface FyExportRow {
  section: string;
  label: string;
  value: number;
  note?: string;
}

/**
 * The figures an accountant actually asks for at year end, produced regardless
 * of registration status.
 */
export function buildFyExport(args: {
  financial_year: string;
  purchases_taxable: number;
  purchases_tax: number;
  sales_total: number;
  sales_tax: number;
  opening_stock: number;
  closing_rm: number;
  closing_wip: number;
  closing_fg: number;
  closing_with_vendor: number;
  wages_paid: number;
  jobwork_charges: number;
}): FyExportRow[] {
  const closingTotal = round2(
    args.closing_rm + args.closing_wip + args.closing_fg + args.closing_with_vendor
  );

  return [
    { section: "Sales", label: "Total sales", value: args.sales_total },
    { section: "Sales", label: "Of which tax collected", value: args.sales_tax,
      note: "Zero while unregistered" },
    { section: "Purchases", label: "Purchases (taxable value)", value: args.purchases_taxable },
    { section: "Purchases", label: "Tax paid to suppliers", value: args.purchases_tax,
      note: "Unrecoverable and inside item cost while unregistered" },
    { section: "Direct costs", label: "Wages paid (piece rate)", value: args.wages_paid },
    { section: "Direct costs", label: "Job work charges", value: args.jobwork_charges },
    { section: "Closing stock", label: "Raw material", value: args.closing_rm },
    { section: "Closing stock", label: "Work in progress", value: args.closing_wip },
    { section: "Closing stock", label: "Finished goods", value: args.closing_fg },
    { section: "Closing stock", label: "Stock with job workers", value: args.closing_with_vendor,
      note: "Our asset, physically held by vendors" },
    { section: "Closing stock", label: "Total closing stock", value: closingTotal },
  ];
}

export function toCsv(rows: FyExportRow[], financialYear: string): string {
  const lines = [
    `Loknath Sofa Center — Financial Year ${financialYear}`,
    "",
    "Section,Item,Amount (INR),Note",
    ...rows.map((r) =>
      [r.section, r.label, r.value.toFixed(2), r.note ?? ""]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  return lines.join("\n");
}
