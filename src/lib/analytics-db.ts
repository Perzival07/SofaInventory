import {
  StockValuation, SkuMargin, DeadStockLine, AgeingBucket, SeasonMonth,
  FyExportRow, computeSkuMargins, buildAgeing, buildSeasonality, buildFyExport,
  ageingBucketFor, daysSince,
} from "./analytics-logic";
import { getMaterials, getAllBatches } from "./erp-db";
import { getVendorStock, getJobWorkOrders } from "./jobwork-db";
import { getWorkOrders, getIssuesForWorkOrder, getKarigarWages } from "./production-db";
import { getSalesOrders, getOrderLines, getFinishedUnits } from "./sales-db";
import { getGrns } from "./purchase-db";
import { financialYearOf, round2 } from "./tax-regime";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Stock valued at three levels plus material held by vendors.
 *
 * WIP is approximated as the value of material issued to work orders that have
 * not yet completed. Once finished-goods receipt is wired to work order
 * closure this should net off what has already become a finished unit.
 */
export async function getStockValuation(): Promise<StockValuation> {
  const [materials, vendorStock, workOrders, units] = await Promise.all([
    getMaterials(), getVendorStock(), getWorkOrders(), getFinishedUnits(),
  ]);

  const rawMaterial = round2(materials.reduce((s, m) => s + (m.stock_value ?? 0), 0));
  const withVendor = round2(vendorStock.reduce((s, v) => s + v.value, 0));

  let wip = 0;
  for (const wo of workOrders.filter((w) => w.status === "released" || w.status === "in_progress")) {
    const issues = await getIssuesForWorkOrder(wo.id);
    wip = round2(wip + issues.reduce((s, i) => s + Number(i.total_value), 0));
  }

  const finishedGoods = round2(
    units.filter((u) => u.status !== "sold").reduce((s, u) => s + Number(u.cost), 0)
  );

  return {
    raw_material: rawMaterial,
    with_vendor: withVendor,
    wip,
    finished_goods: finishedGoods,
    total: round2(rawMaterial + withVendor + wip + finishedGoods),
  };
}

export async function getSkuMargins(): Promise<SkuMargin[]> {
  const orders = await getSalesOrders();
  const billed = orders.filter((o) => o.status !== "quote" && o.status !== "cancelled");

  const lines: {
    product_id: number; product_name: string;
    quantity: number; line_total: number; unit_cost: number;
  }[] = [];

  for (const o of billed) {
    for (const l of await getOrderLines(o.id)) {
      lines.push({
        product_id: l.product_id,
        product_name: l.product_name ?? "",
        quantity: Number(l.quantity),
        line_total: Number(l.line_total),
        unit_cost: Number(l.unit_cost),
      });
    }
  }

  return computeSkuMargins(lines);
}

export async function getDeadStock(): Promise<{
  lines: DeadStockLine[];
  raw_ageing: AgeingBucket[];
  fg_ageing: AgeingBucket[];
}> {
  const [materials, batches, units] = await Promise.all([
    getMaterials(), getAllBatches(), getFinishedUnits(),
  ]);

  const lines: DeadStockLine[] = [];

  for (const b of batches) {
    const m = materials.find((x) => x.id === b.material_id);
    if (!m) continue;
    const days = daysSince(b.received_date, today());
    lines.push({
      kind: "raw_material", id: b.id, code: m.code,
      name: `${m.name} · ${b.batch_no}`,
      quantity: Number(b.quantity), uom: m.stock_uom,
      value: round2(Number(b.quantity) * Number(b.rate)),
      days_idle: days, bucket: ageingBucketFor(days),
    });
  }

  for (const u of units.filter((x) => x.status !== "sold")) {
    const days = daysSince(u.created_at, today());
    lines.push({
      kind: "finished_goods", id: u.id, code: u.serial_no,
      name: u.product_name ?? "", quantity: 1, uom: "NOS",
      value: Number(u.cost), days_idle: days, bucket: ageingBucketFor(days),
    });
  }

  return {
    lines: lines.sort((a, b) => b.days_idle - a.days_idle),
    raw_ageing: buildAgeing(lines.filter((l) => l.kind === "raw_material")),
    fg_ageing: buildAgeing(lines.filter((l) => l.kind === "finished_goods")),
  };
}

export async function getSeasonality(): Promise<SeasonMonth[]> {
  const orders = await getSalesOrders();
  return buildSeasonality(
    orders
      .filter((o) => o.status !== "quote" && o.status !== "cancelled")
      .map((o) => ({ order_date: o.order_date, grand_total: Number(o.grand_total) }))
  );
}

export async function getFyExport(): Promise<{ rows: FyExportRow[]; financial_year: string }> {
  const fy = financialYearOf(today());

  const [grns, orders, valuation, wages, jwOrders] = await Promise.all([
    getGrns(), getSalesOrders(), getStockValuation(), getKarigarWages(), getJobWorkOrders(),
  ]);

  const fyGrns = grns.filter((g) => financialYearOf(g.receipt_date) === fy);
  const fyOrders = orders.filter(
    (o) => financialYearOf(o.order_date) === fy && o.status !== "quote" && o.status !== "cancelled"
  );

  const jobworkCharges = round2(
    jwOrders.reduce((s, o) => s + (o.received_qty ?? 0) * Number(o.rate), 0)
  );

  const rows = buildFyExport({
    financial_year: fy,
    purchases_taxable: round2(fyGrns.reduce((s, g) => s + Number(g.total_taxable), 0)),
    purchases_tax: round2(fyGrns.reduce((s, g) => s + Number(g.total_tax), 0)),
    sales_total: round2(fyOrders.reduce((s, o) => s + Number(o.grand_total), 0)),
    sales_tax: round2(fyOrders.reduce((s, o) => s + Number(o.tax_total), 0)),
    opening_stock: 0,
    closing_rm: valuation.raw_material,
    closing_wip: valuation.wip,
    closing_fg: valuation.finished_goods,
    closing_with_vendor: valuation.with_vendor,
    wages_paid: round2(wages.reduce((s, w) => s + w.piece_wage, 0)),
    jobwork_charges: jobworkCharges,
  });

  return { rows, financial_year: fy };
}
