import { neon } from "@neondatabase/serverless";
import {
  JobWorkVendor, JobWorkOrder, JobWorkOrderInput, JobWorkChallan, ChallanLine,
  ChallanLineInput, VendorStockLine, ChallanReconciliation, JobWorkReceiptInput,
  WastageAssessment, ThreeWayMatch, VendorScorecard, MakeVsBuyLine,
} from "./jobwork-types";
import { getMaterials, getAllBatches, consumeBatchQuantity, addMaterialBatch, explodeBom } from "./erp-db";
import { getRegimePeriods, getTaxConfig, getTaxRules } from "./tax-db";
import { getOperations } from "./production-db";
import { allocateBatches, requirementToStockQty } from "./production-logic";
import { resolveRegimeForDate, financialYearOf, round2, round4 } from "./tax-regime";
import {
  deadlineStatus, daysBetween, ewayBillRequirement, assessWastage,
  threeWayMatch, makeVsBuy,
} from "./jobwork-logic";

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

function getSql() {
  return connectionString ? neon(connectionString) : null;
}

import { currentActor } from "./actor";

const DEFAULT_VENDORS: Omit<JobWorkVendor, "id">[] = [
  { code: "JV-01", name: "Habra Polish Works", gstin: "19AAFCH1234P1Z8", state_code: "19",
    phone: "9836011111", address: "Habra, North 24 Pgs", capabilities: ["POL", "SAND"],
    monthly_capacity: 120, standard_lead_days: 5, agreed_wastage_pct: 5,
    quality_rating: 4, is_active: true },
  { code: "JV-02", name: "Duttapukur Upholstery Unit", gstin: "19AAGCD5678U1ZK", state_code: "19",
    phone: "9836022222", address: "Duttapukur", capabilities: ["UPH", "FOAM"],
    monthly_capacity: 80, standard_lead_days: 7, agreed_wastage_pct: 8,
    quality_rating: 3, is_active: true },
  { code: "JV-03", name: "Barrackpore CNC Cutting", gstin: null, state_code: "19",
    phone: "9836033333", address: "Barrackpore", capabilities: ["CUT"],
    monthly_capacity: 200, standard_lead_days: 3, agreed_wastage_pct: 4,
    quality_rating: 5, is_active: true },
];

const memJw = {
  vendors: DEFAULT_VENDORS.map((v, i) => ({ ...v, id: i + 1 })) as JobWorkVendor[],
  orders: [] as JobWorkOrder[],
  challans: [] as JobWorkChallan[],
  challanLines: [] as ChallanLine[],
  receipts: [] as Record<string, unknown>[],
  invoices: [] as { jw_order_id: number; qty: number; rate: number; amount: number }[],
  nextId: { vendor: 4, order: 1, challan: 1, line: 1, receipt: 1 },
  nextOrderSeq: 1,
  nextChallanSeq: 1,
};

let jwTablesReady = false;

export async function ensureJobWorkTables(): Promise<void> {
  const sql = getSql();
  if (!sql || jwTablesReady) return;

  try {
    await sql`CREATE TABLE IF NOT EXISTS jobwork_vendors (
      id SERIAL PRIMARY KEY, code VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(200) NOT NULL,
      gstin VARCHAR(20), state_code VARCHAR(2) NOT NULL DEFAULT '19',
      phone VARCHAR(20), address TEXT, capabilities TEXT[] NOT NULL DEFAULT '{}',
      monthly_capacity INT NOT NULL DEFAULT 0, standard_lead_days INT NOT NULL DEFAULT 0,
      agreed_wastage_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      quality_rating NUMERIC(3,1) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE)`;

    await sql`CREATE TABLE IF NOT EXISTS jobwork_orders (
      id SERIAL PRIMARY KEY, jw_number VARCHAR(40) UNIQUE NOT NULL,
      vendor_id INT NOT NULL REFERENCES jobwork_vendors(id),
      operation_code VARCHAR(20),
      work_order_id INT REFERENCES work_orders(id),
      output_product_id INT REFERENCES products(id),
      expected_output_qty NUMERIC(16,3) NOT NULL,
      rate NUMERIC(14,2) NOT NULL DEFAULT 0,
      tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
      agreed_wastage_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      order_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'open', notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS jobwork_challans (
      id SERIAL PRIMARY KEY, challan_number VARCHAR(40) UNIQUE NOT NULL,
      jw_order_id INT NOT NULL REFERENCES jobwork_orders(id) ON DELETE CASCADE,
      vendor_id INT NOT NULL REFERENCES jobwork_vendors(id),
      dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
      challan_type VARCHAR(20) NOT NULL DEFAULT 'internal',
      regime_at_dispatch BOOLEAN NOT NULL DEFAULT FALSE,
      gstin_at_dispatch VARCHAR(20),
      total_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      eway_bill_required BOOLEAN NOT NULL DEFAULT FALSE,
      eway_bill_exempt_reason TEXT, notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS jobwork_challan_lines (
      id SERIAL PRIMARY KEY,
      challan_id INT NOT NULL REFERENCES jobwork_challans(id) ON DELETE CASCADE,
      material_id INT NOT NULL REFERENCES materials(id),
      quantity NUMERIC(16,4) NOT NULL,
      rate NUMERIC(14,4) NOT NULL DEFAULT 0,
      value NUMERIC(14,2) NOT NULL DEFAULT 0,
      hsn_code VARCHAR(20),
      returned_quantity NUMERIC(16,4) NOT NULL DEFAULT 0)`;

    await sql`CREATE TABLE IF NOT EXISTS jobwork_receipts (
      id SERIAL PRIMARY KEY,
      jw_order_id INT NOT NULL REFERENCES jobwork_orders(id) ON DELETE CASCADE,
      receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
      good_qty NUMERIC(16,3) NOT NULL DEFAULT 0,
      rejected_qty NUMERIC(16,3) NOT NULL DEFAULT 0,
      rejection_reason TEXT,
      scrap_returned_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      wastage_recovery NUMERIC(14,2) NOT NULL DEFAULT 0,
      notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS jobwork_invoices (
      id SERIAL PRIMARY KEY,
      jw_order_id INT NOT NULL REFERENCES jobwork_orders(id) ON DELETE CASCADE,
      invoice_no VARCHAR(60), invoice_date DATE,
      qty NUMERIC(16,3) NOT NULL, rate NUMERIC(14,2) NOT NULL,
      amount NUMERIC(14,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE INDEX IF NOT EXISTS idx_jw_challan_lines ON jobwork_challan_lines(challan_id)`;

    for (const v of DEFAULT_VENDORS) {
      await sql`INSERT INTO jobwork_vendors (code, name, gstin, state_code, phone, address,
                  capabilities, monthly_capacity, standard_lead_days, agreed_wastage_pct, quality_rating)
                VALUES (${v.code}, ${v.name}, ${v.gstin}, ${v.state_code}, ${v.phone}, ${v.address},
                  ${v.capabilities}, ${v.monthly_capacity}, ${v.standard_lead_days},
                  ${v.agreed_wastage_pct}, ${v.quality_rating})
                ON CONFLICT (code) DO NOTHING`;
    }

    jwTablesReady = true;
  } catch (error) {
    console.error("Error initializing job work schema:", error);
  }
}

async function logAudit(entity: string, entityId: string, action: string, details: Record<string, unknown>) {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`INSERT INTO audit_log (entity, entity_id, action, actor, details)
              VALUES (${entity}, ${entityId}, ${action}, ${await currentActor()}, ${JSON.stringify(details)}::jsonb)`;
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

async function ruleValue(key: string, fallback: number): Promise<number> {
  const rules = await getTaxRules();
  const rule = rules.find((r) => r.rule_key === key);
  return rule?.numeric_value ?? fallback;
}

// -----------------------------------------------------------------------------
// Vendors
// -----------------------------------------------------------------------------
export async function getJobWorkVendors(): Promise<JobWorkVendor[]> {
  const sql = getSql();
  if (!sql) return [...memJw.vendors];
  await ensureJobWorkTables();
  return (await sql`SELECT id, code, name, gstin, state_code, phone, address, capabilities,
                           monthly_capacity, standard_lead_days,
                           agreed_wastage_pct::float AS agreed_wastage_pct,
                           quality_rating::float AS quality_rating, is_active
                    FROM jobwork_vendors WHERE is_active = TRUE ORDER BY name`) as JobWorkVendor[];
}

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------
export async function getJobWorkOrders(): Promise<JobWorkOrder[]> {
  const sql = getSql();
  const operations = await getOperations();

  if (sql) {
    await ensureJobWorkTables();
    const rows = (await sql`
      SELECT o.id, o.jw_number, o.vendor_id, v.name AS vendor_name, v.gstin AS vendor_gstin,
             o.operation_code, o.work_order_id, w.wo_number,
             o.output_product_id, p.name AS output_product_name,
             o.expected_output_qty::float AS expected_output_qty,
             o.rate::float AS rate, o.tax_rate::float AS tax_rate,
             o.agreed_wastage_pct::float AS agreed_wastage_pct,
             TO_CHAR(o.order_date,'YYYY-MM-DD') AS order_date,
             TO_CHAR(o.due_date,'YYYY-MM-DD') AS due_date, o.status, o.notes,
             COALESCE((SELECT SUM(good_qty) FROM jobwork_receipts WHERE jw_order_id = o.id), 0)::float AS received_qty,
             COALESCE((SELECT SUM(rejected_qty) FROM jobwork_receipts WHERE jw_order_id = o.id), 0)::float AS rejected_qty
      FROM jobwork_orders o
      JOIN jobwork_vendors v ON v.id = o.vendor_id
      LEFT JOIN work_orders w ON w.id = o.work_order_id
      LEFT JOIN products p ON p.id = o.output_product_id
      ORDER BY o.order_date DESC, o.id DESC`) as JobWorkOrder[];
    return rows.map((r) => ({
      ...r,
      operation_name: operations.find((o) => o.code === r.operation_code)?.name ?? null,
    }));
  }

  return memJw.orders.map((o) => {
    const v = memJw.vendors.find((x) => x.id === o.vendor_id);
    const receipts = memJw.receipts.filter((r) => r.jw_order_id === o.id);
    return {
      ...o,
      vendor_name: v?.name,
      vendor_gstin: v?.gstin,
      operation_name: operations.find((x) => x.code === o.operation_code)?.name ?? null,
      received_qty: round4(receipts.reduce((s, r) => s + (r.good_qty as number), 0)),
      rejected_qty: round4(receipts.reduce((s, r) => s + (r.rejected_qty as number), 0)),
    };
  });
}

export async function createJobWorkOrder(input: JobWorkOrderInput): Promise<JobWorkOrder> {
  const sql = getSql();
  if (sql) await ensureJobWorkTables();

  const shortFy = financialYearOf(input.order_date).replace("20", "");
  let jwNumber: string;
  if (sql) {
    const rows = (await sql`SELECT COUNT(*)::int AS n FROM jobwork_orders
                            WHERE jw_number LIKE ${"JW/" + shortFy + "/%"}`) as { n: number }[];
    jwNumber = `JW/${shortFy}/${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
  } else {
    jwNumber = `JW/${shortFy}/${String(memJw.nextOrderSeq++).padStart(4, "0")}`;
  }

  const order: JobWorkOrder = {
    id: 0, jw_number: jwNumber, vendor_id: input.vendor_id,
    operation_code: input.operation_code ?? null, operation_name: null,
    work_order_id: input.work_order_id ?? null,
    output_product_id: input.output_product_id ?? null,
    expected_output_qty: input.expected_output_qty,
    rate: input.rate, tax_rate: input.tax_rate,
    agreed_wastage_pct: input.agreed_wastage_pct,
    order_date: input.order_date, due_date: input.due_date ?? null,
    status: "open", notes: input.notes ?? null,
  };

  if (sql) {
    const rows = (await sql`
      INSERT INTO jobwork_orders (jw_number, vendor_id, operation_code, work_order_id,
        output_product_id, expected_output_qty, rate, tax_rate, agreed_wastage_pct,
        order_date, due_date, status, notes)
      VALUES (${jwNumber}, ${input.vendor_id}, ${input.operation_code ?? null},
        ${input.work_order_id ?? null}, ${input.output_product_id ?? null},
        ${input.expected_output_qty}, ${input.rate}, ${input.tax_rate},
        ${input.agreed_wastage_pct}, ${input.order_date}, ${input.due_date ?? null},
        'open', ${input.notes ?? null})
      RETURNING id`) as { id: number }[];
    order.id = rows[0].id;
  } else {
    order.id = memJw.nextId.order++;
    memJw.orders.push(order);
  }

  await logAudit("jobwork_order", String(order.id), "create", { jw_number: jwNumber });
  return order;
}

// -----------------------------------------------------------------------------
// Dispatch — material leaves the store but stays our asset
// -----------------------------------------------------------------------------
export async function dispatchChallan(input: {
  jw_order_id: number;
  dispatch_date: string;
  lines: ChallanLineInput[];
  notes?: string | null;
}): Promise<{ challan: JobWorkChallan; warnings: string[] }> {
  const sql = getSql();
  if (sql) await ensureJobWorkTables();

  const [orders, vendors, materials, batches, periods, config] = await Promise.all([
    getJobWorkOrders(), getJobWorkVendors(), getMaterials(), getAllBatches(),
    getRegimePeriods(), getTaxConfig(),
  ]);

  const order = orders.find((o) => o.id === input.jw_order_id);
  if (!order) throw new Error("Job work order not found");
  const vendor = vendors.find((v) => v.id === order.vendor_id);

  // Challan format is decided by the regime in force on the DISPATCH DATE and
  // frozen — an internal challan stays internal forever.
  const regime = resolveRegimeForDate(periods, input.dispatch_date, config.state_code);

  const warnings: string[] = [];
  const picked: { material_id: number; quantity: number; rate: number; value: number; hsn: string | null }[] = [];

  for (const line of input.lines.filter((l) => l.quantity > 0)) {
    const material = materials.find((m) => m.id === line.material_id);
    if (!material) continue;

    const result = allocateBatches(material, batches, line.quantity, input.dispatch_date);
    warnings.push(...result.warnings.map((w) => `${material.name}: ${w}`));
    if (result.shortfall > 0) {
      warnings.push(`${material.name}: short by ${result.shortfall} ${material.stock_uom}`);
    }

    for (const alloc of result.allocations) {
      // Value moves out of the raw store — it does NOT disappear.
      await consumeBatchQuantity(alloc.batch_id, alloc.quantity);
      const b = batches.find((x) => x.id === alloc.batch_id);
      if (b) b.quantity = round4(Number(b.quantity) - alloc.quantity);

      picked.push({
        material_id: material.id, quantity: alloc.quantity, rate: alloc.rate,
        value: alloc.value, hsn: material.hsn_code,
      });
    }
  }

  // Nothing could actually be allocated — refuse rather than leaving an empty
  // challan on record, which would misstate what is with the vendor.
  if (picked.length === 0) {
    throw new Error(
      `No stock available to dispatch. ${warnings.join("; ") || "Check free stock for the selected materials."}`
    );
  }

  const totalValue = round2(picked.reduce((s, p) => s + p.value, 0));

  const [ewayThreshold, intrastateExemptRule] = await Promise.all([
    ruleValue("eway_bill_consignment_value", 50000),
    ruleValue("intrastate_jobwork_wb", 1),
  ]);

  const eway = ewayBillRequirement(
    totalValue, config.state_code, vendor?.state_code ?? config.state_code, regime,
    { threshold: ewayThreshold, intrastateJobWorkExempt: intrastateExemptRule === 1 }
  );

  const shortFy = financialYearOf(input.dispatch_date).replace("20", "");
  const prefix = regime.challan_type === "rule_45" ? "JWC" : "DC";
  let challanNumber: string;
  if (sql) {
    const rows = (await sql`SELECT COUNT(*)::int AS n FROM jobwork_challans
                            WHERE challan_number LIKE ${prefix + "/" + shortFy + "/%"}`) as { n: number }[];
    challanNumber = `${prefix}/${shortFy}/${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
  } else {
    challanNumber = `${prefix}/${shortFy}/${String(memJw.nextChallanSeq++).padStart(4, "0")}`;
  }

  const challan: JobWorkChallan = {
    id: 0, challan_number: challanNumber, jw_order_id: input.jw_order_id,
    vendor_id: order.vendor_id, vendor_name: vendor?.name,
    dispatch_date: input.dispatch_date,
    challan_type: regime.challan_type,
    regime_at_dispatch: regime.registered,
    gstin_at_dispatch: regime.registration_number,
    total_value: totalValue,
    eway_bill_required: eway.required,
    eway_bill_exempt_reason: eway.exempt_reason,
    notes: input.notes ?? null,
    line_count: picked.length,
  };

  if (sql) {
    const rows = (await sql`
      INSERT INTO jobwork_challans (challan_number, jw_order_id, vendor_id, dispatch_date,
        challan_type, regime_at_dispatch, gstin_at_dispatch, total_value,
        eway_bill_required, eway_bill_exempt_reason, notes)
      VALUES (${challanNumber}, ${input.jw_order_id}, ${order.vendor_id}, ${input.dispatch_date},
        ${regime.challan_type}, ${regime.registered}, ${regime.registration_number},
        ${totalValue}, ${eway.required}, ${eway.exempt_reason}, ${input.notes ?? null})
      RETURNING id`) as { id: number }[];
    challan.id = rows[0].id;

    for (const p of picked) {
      await sql`INSERT INTO jobwork_challan_lines (challan_id, material_id, quantity, rate, value, hsn_code)
                VALUES (${challan.id}, ${p.material_id}, ${p.quantity}, ${p.rate}, ${p.value}, ${p.hsn})`;
    }
    await sql`UPDATE jobwork_orders SET status = 'dispatched' WHERE id = ${input.jw_order_id}
              AND status IN ('open','draft')`;
  } else {
    challan.id = memJw.nextId.challan++;
    memJw.challans.push(challan);
    for (const p of picked) {
      memJw.challanLines.push({
        id: memJw.nextId.line++, challan_id: challan.id, material_id: p.material_id,
        quantity: p.quantity, rate: p.rate, value: p.value, hsn_code: p.hsn,
        returned_quantity: 0,
      });
    }
    const o = memJw.orders.find((x) => x.id === input.jw_order_id);
    if (o && (o.status === "open" || o.status === "draft")) o.status = "dispatched";
  }

  await logAudit("jobwork_challan", String(challan.id), "dispatch", {
    challan_number: challanNumber, value: totalValue, challan_type: regime.challan_type,
  });

  return { challan, warnings };
}

export async function getChallans(): Promise<JobWorkChallan[]> {
  const sql = getSql();
  if (sql) {
    await ensureJobWorkTables();
    return (await sql`
      SELECT c.id, c.challan_number, c.jw_order_id, o.jw_number, c.vendor_id, v.name AS vendor_name,
             TO_CHAR(c.dispatch_date,'YYYY-MM-DD') AS dispatch_date, c.challan_type,
             c.regime_at_dispatch, c.gstin_at_dispatch, c.total_value::float AS total_value,
             c.eway_bill_required, c.eway_bill_exempt_reason, c.notes,
             (SELECT COUNT(*) FROM jobwork_challan_lines WHERE challan_id = c.id) AS line_count
      FROM jobwork_challans c
      JOIN jobwork_orders o ON o.id = c.jw_order_id
      JOIN jobwork_vendors v ON v.id = c.vendor_id
      ORDER BY c.dispatch_date DESC, c.id DESC`) as JobWorkChallan[];
  }
  return memJw.challans.map((c) => ({
    ...c,
    jw_number: memJw.orders.find((o) => o.id === c.jw_order_id)?.jw_number,
  }));
}

async function getChallanLinesAll(): Promise<(ChallanLine & { dispatch_date: string; vendor_id: number })[]> {
  const sql = getSql();
  if (sql) {
    await ensureJobWorkTables();
    return (await sql`
      SELECT l.id, l.challan_id, l.material_id, m.code AS material_code, m.name AS material_name,
             m.stock_uom, l.quantity::float AS quantity, l.rate::float AS rate,
             l.value::float AS value, l.hsn_code, l.returned_quantity::float AS returned_quantity,
             TO_CHAR(c.dispatch_date,'YYYY-MM-DD') AS dispatch_date, c.vendor_id
      FROM jobwork_challan_lines l
      JOIN jobwork_challans c ON c.id = l.challan_id
      JOIN materials m ON m.id = l.material_id`) as (ChallanLine & { dispatch_date: string; vendor_id: number })[];
  }

  const materials = await getMaterials();
  return memJw.challanLines.map((l) => {
    const c = memJw.challans.find((x) => x.id === l.challan_id)!;
    const m = materials.find((x) => x.id === l.material_id);
    return {
      ...l, material_code: m?.code, material_name: m?.name, stock_uom: m?.stock_uom,
      dispatch_date: c.dispatch_date, vendor_id: c.vendor_id,
    };
  });
}

/**
 * Stock physically with vendors, derived from challan lines rather than stored
 * separately so it cannot drift out of step with what was actually sent.
 */
export async function getVendorStock(): Promise<VendorStockLine[]> {
  const [lines, vendors, returnMonths, alertMonths] = await Promise.all([
    getChallanLinesAll(), getJobWorkVendors(),
    ruleValue("inputs_return_months", 12), ruleValue("alert_at_months", 9),
  ]);

  const grouped = new Map<string, VendorStockLine>();

  for (const l of lines) {
    const outstanding = round4(l.quantity - l.returned_quantity);
    if (outstanding <= 0.0001) continue;

    const key = `${l.vendor_id}:${l.material_id}`;
    const existing = grouped.get(key);
    const dl = deadlineStatus(l.dispatch_date, today(), returnMonths, alertMonths);

    if (existing) {
      existing.quantity = round4(existing.quantity + outstanding);
      existing.value = round2(existing.value + outstanding * l.rate);
      if (l.dispatch_date < existing.oldest_dispatch_date) {
        existing.oldest_dispatch_date = l.dispatch_date;
        existing.days_out = daysBetween(l.dispatch_date, today());
        existing.deadline_status = dl.status;
      }
    } else {
      grouped.set(key, {
        vendor_id: l.vendor_id,
        vendor_name: vendors.find((v) => v.id === l.vendor_id)?.name ?? "",
        material_id: l.material_id,
        material_code: l.material_code ?? "",
        material_name: l.material_name ?? "",
        stock_uom: l.stock_uom ?? "",
        quantity: outstanding,
        value: round2(outstanding * l.rate),
        oldest_dispatch_date: l.dispatch_date,
        days_out: daysBetween(l.dispatch_date, today()),
        deadline_status: dl.status,
      });
    }
  }

  return [...grouped.values()].sort((a, b) => b.days_out - a.days_out);
}

export async function getChallanReconciliation(): Promise<ChallanReconciliation[]> {
  const [challans, lines, returnMonths, alertMonths] = await Promise.all([
    getChallans(), getChallanLinesAll(),
    ruleValue("inputs_return_months", 12), ruleValue("alert_at_months", 9),
  ]);

  return challans.map((c) => {
    const cl = lines.filter((l) => l.challan_id === c.id);
    const sentQty = round4(cl.reduce((s, l) => s + l.quantity, 0));
    const returnedQty = round4(cl.reduce((s, l) => s + l.returned_quantity, 0));
    const dl = deadlineStatus(c.dispatch_date, today(), returnMonths, alertMonths);

    return {
      challan_id: c.id,
      challan_number: c.challan_number,
      vendor_name: c.vendor_name ?? "",
      dispatch_date: c.dispatch_date,
      days_out: daysBetween(c.dispatch_date, today()),
      sent_value: c.total_value,
      sent_qty: sentQty,
      returned_qty: returnedQty,
      balance_qty: round4(sentQty - returnedQty),
      deadline_status: dl.status,
      months_remaining: dl.months_remaining,
    };
  }).sort((a, b) => b.days_out - a.days_out);
}

// -----------------------------------------------------------------------------
// Receipt from vendor
// -----------------------------------------------------------------------------
export async function receiveJobWork(input: JobWorkReceiptInput): Promise<{
  wastage: WastageAssessment[];
  recovery: number;
  warnings: string[];
}> {
  const sql = getSql();
  if (sql) await ensureJobWorkTables();

  const [orders, materials, lines] = await Promise.all([
    getJobWorkOrders(), getMaterials(), getChallanLinesAll(),
  ]);

  const order = orders.find((o) => o.id === input.jw_order_id);
  if (!order) throw new Error("Job work order not found");

  const challans = (await getChallans()).filter((c) => c.jw_order_id === input.jw_order_id);
  const challanIds = new Set(challans.map((c) => c.id));
  const orderLines = lines.filter((l) => challanIds.has(l.challan_id));

  // Standard consumption per output unit, taken from the BOM of what is produced.
  const standardPerUnit = new Map<number, number>();
  if (order.output_product_id) {
    const reqs = await explodeBom(order.output_product_id, 1);
    for (const r of reqs) {
      const m = materials.find((x) => x.id === r.material_id);
      standardPerUnit.set(
        r.material_id,
        m ? round4(requirementToStockQty(m, r.gross_quantity, r.uom)) : r.gross_quantity
      );
    }
  }

  const warnings: string[] = [];

  // Return unused material to the store as its own lot, and mark it returned
  // against the challan lines it came from.
  for (const ret of input.material_returns.filter((r) => r.quantity > 0)) {
    const material = materials.find((m) => m.id === ret.material_id);
    if (!material) continue;

    const candidates = orderLines
      .filter((l) => l.material_id === ret.material_id && l.quantity - l.returned_quantity > 0)
      .sort((a, b) => a.dispatch_date.localeCompare(b.dispatch_date));

    // A vendor cannot return what was never sent. Without this guard a mistyped
    // return creates stock from nothing and inflates inventory.
    const outstanding = round4(
      candidates.reduce((s, l) => s + (l.quantity - l.returned_quantity), 0)
    );
    if (outstanding <= 0) {
      warnings.push(
        `${material.name} was not sent to this vendor on this order — return ignored`
      );
      continue;
    }

    const acceptedReturn = Math.min(ret.quantity, outstanding);
    if (acceptedReturn < ret.quantity) {
      warnings.push(
        `${material.name}: only ${outstanding} ${material.stock_uom} is outstanding with the vendor — ` +
          `return capped from ${ret.quantity}`
      );
    }

    let remaining = acceptedReturn;

    for (const line of candidates) {
      if (remaining <= 0.0001) break;
      const canReturn = round4(line.quantity - line.returned_quantity);
      const take = Math.min(canReturn, remaining);

      if (sql) {
        await sql`UPDATE jobwork_challan_lines
                  SET returned_quantity = returned_quantity + ${take} WHERE id = ${line.id}`;
      } else {
        const memLine = memJw.challanLines.find((x) => x.id === line.id);
        if (memLine) memLine.returned_quantity = round4(memLine.returned_quantity + take);
      }
      line.returned_quantity = round4(line.returned_quantity + take);
      remaining = round4(remaining - take);
    }

    await addMaterialBatch(ret.material_id, {
      batch_no: `RET-${order.jw_number.replace(/\//g, "-")}-${ret.material_id}`,
      quantity: acceptedReturn,
      rate: candidates[0]?.rate ?? material.standard_rate,
      received_date: input.receipt_date,
      notes: `Returned unused from ${order.vendor_name} against ${order.jw_number}`,
    });
  }

  // Material consumed by the vendor is written off against the challan lines:
  // it has physically become part of the output.
  const wastageInput = [...new Set(orderLines.map((l) => l.material_id))].map((materialId) => {
    const ml = orderLines.filter((l) => l.material_id === materialId);
    const material = materials.find((m) => m.id === materialId);
    return {
      material_id: materialId,
      material_code: material?.code ?? "",
      material_name: material?.name ?? "",
      stock_uom: material?.stock_uom ?? "",
      sent_qty: round4(ml.reduce((s, l) => s + l.quantity, 0)),
      returned_qty: round4(ml.reduce((s, l) => s + l.returned_quantity, 0)),
      standard_per_unit: standardPerUnit.get(materialId) ?? 0,
      rate: ml[0]?.rate ?? 0,
    };
  });

  const wastage = assessWastage(wastageInput, input.good_qty, order.agreed_wastage_pct);
  const recovery = round2(wastage.reduce((s, w) => s + w.recovery_amount, 0));

  if (sql) {
    await sql`INSERT INTO jobwork_receipts (jw_order_id, receipt_date, good_qty, rejected_qty,
                rejection_reason, scrap_returned_value, wastage_recovery, notes)
              VALUES (${input.jw_order_id}, ${input.receipt_date}, ${input.good_qty},
                ${input.rejected_qty}, ${input.rejection_reason ?? null},
                ${input.scrap_returned_value}, ${recovery}, ${input.notes ?? null})`;
  } else {
    memJw.receipts.push({
      id: memJw.nextId.receipt++, jw_order_id: input.jw_order_id,
      receipt_date: input.receipt_date, good_qty: input.good_qty,
      rejected_qty: input.rejected_qty, wastage_recovery: recovery,
      scrap_returned_value: input.scrap_returned_value,
    });
  }

  // Close the order once the ordered quantity has been met.
  const totalGood = (order.received_qty ?? 0) + input.good_qty;
  const status = totalGood >= order.expected_output_qty ? "completed" : "part_received";
  if (sql) {
    await sql`UPDATE jobwork_orders SET status = ${status} WHERE id = ${input.jw_order_id}`;
  } else {
    const o = memJw.orders.find((x) => x.id === input.jw_order_id);
    if (o) o.status = status as JobWorkOrder["status"];
  }

  await logAudit("jobwork_receipt", String(input.jw_order_id), "receive", {
    good: input.good_qty, rejected: input.rejected_qty, recovery,
  });

  return { wastage, recovery, warnings };
}

export async function recordVendorInvoice(input: {
  jw_order_id: number; invoice_no: string; invoice_date: string;
  qty: number; rate: number; amount: number;
}): Promise<void> {
  const sql = getSql();
  if (sql) {
    await ensureJobWorkTables();
    await sql`INSERT INTO jobwork_invoices (jw_order_id, invoice_no, invoice_date, qty, rate, amount)
              VALUES (${input.jw_order_id}, ${input.invoice_no}, ${input.invoice_date},
                      ${input.qty}, ${input.rate}, ${input.amount})`;
  } else {
    memJw.invoices.push({
      jw_order_id: input.jw_order_id, qty: input.qty, rate: input.rate, amount: input.amount,
    });
  }
  await logAudit("jobwork_invoice", String(input.jw_order_id), "record", { ...input });
}

export async function getThreeWayMatches(): Promise<ThreeWayMatch[]> {
  const orders = await getJobWorkOrders();
  const sql = getSql();

  const invoices = new Map<number, { qty: number; rate: number; amount: number }>();
  const recoveries = new Map<number, number>();

  if (sql) {
    await ensureJobWorkTables();
    const invRows = (await sql`SELECT jw_order_id, qty::float AS qty, rate::float AS rate,
                                      amount::float AS amount FROM jobwork_invoices`) as
      { jw_order_id: number; qty: number; rate: number; amount: number }[];
    for (const r of invRows) invoices.set(Number(r.jw_order_id), r);

    const recRows = (await sql`SELECT jw_order_id, SUM(wastage_recovery)::float AS rec
                               FROM jobwork_receipts GROUP BY jw_order_id`) as
      { jw_order_id: number; rec: number }[];
    for (const r of recRows) recoveries.set(Number(r.jw_order_id), Number(r.rec));
  } else {
    for (const i of memJw.invoices) invoices.set(i.jw_order_id, i);
    for (const r of memJw.receipts) {
      const id = r.jw_order_id as number;
      recoveries.set(id, (recoveries.get(id) ?? 0) + ((r.wastage_recovery as number) ?? 0));
    }
  }

  return orders
    .filter((o) => (o.received_qty ?? 0) > 0)
    .map((o) => {
      const inv = invoices.get(o.id);
      return threeWayMatch({
        jw_order_id: o.id,
        jw_number: o.jw_number,
        ordered_qty: o.expected_output_qty,
        ordered_rate: o.rate,
        received_good_qty: o.received_qty ?? 0,
        invoice_qty: inv?.qty ?? null,
        invoice_rate: inv?.rate ?? null,
        invoice_amount: inv?.amount ?? null,
        wastage_recovery: recoveries.get(o.id) ?? 0,
      });
    });
}

export async function getVendorScorecards(): Promise<VendorScorecard[]> {
  const [vendors, orders] = await Promise.all([getJobWorkVendors(), getJobWorkOrders()]);

  return vendors.map((v) => {
    const vo = orders.filter((o) => o.vendor_id === v.id);
    const completed = vo.filter((o) => o.status === "completed");
    const received = round4(vo.reduce((s, o) => s + (o.received_qty ?? 0), 0));
    const rejected = round4(vo.reduce((s, o) => s + (o.rejected_qty ?? 0), 0));
    const produced = received + rejected;

    return {
      vendor_id: v.id,
      vendor_name: v.name,
      orders_completed: completed.length,
      units_received: received,
      units_rejected: rejected,
      rejection_pct: produced > 0 ? round2((rejected / produced) * 100) : 0,
      on_time_pct: 0,
      avg_wastage_pct: 0,
      agreed_wastage_pct: v.agreed_wastage_pct,
      total_recovery: 0,
      avg_rate: vo.length ? round2(vo.reduce((s, o) => s + o.rate, 0) / vo.length) : 0,
    };
  });
}

/** In-house operation cost against each capable vendor's quoted rate. */
export async function getMakeVsBuy(): Promise<MakeVsBuyLine[]> {
  const [operations, vendors, periods, config] = await Promise.all([
    getOperations(), getJobWorkVendors(), getRegimePeriods(), getTaxConfig(),
  ]);
  const regime = resolveRegimeForDate(periods, today(), config.state_code);
  const jobWorkTaxRate = 18;

  const lines: MakeVsBuyLine[] = [];
  for (const op of operations) {
    const vendor = vendors.find((v) => v.capabilities.includes(op.code));
    if (!vendor || op.piece_rate <= 0) continue;
    // Vendor quote approximated from the in-house piece rate until real rate
    // cards are captured per vendor.
    const quote = round2(op.piece_rate * 0.95);
    lines.push(makeVsBuy(op.name, op.piece_rate, quote, jobWorkTaxRate, regime));
  }
  return lines;
}
