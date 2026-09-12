import { neon } from "@neondatabase/serverless";
import {
  Supplier,
  SupplierInput,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderInput,
  Grn,
  GrnInput,
  PostedGrn,
  PriceHistoryPoint,
} from "./purchase-types";
import { Material } from "./erp-types";
import { getMaterials, addMaterialBatch } from "./erp-db";
import { getRegimePeriods, getTaxConfig } from "./tax-db";
import { resolveRegimeForDate, financialYearOf, round2 } from "./tax-regime";
import { postGrn } from "./grn-costing";

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

function getSql() {
  return connectionString ? neon(connectionString) : null;
}

import { currentActor } from "./actor";

// -----------------------------------------------------------------------------
// In-memory demo store
// -----------------------------------------------------------------------------
const memPurchase = {
  suppliers: [
    { id: 1, code: "SUP-BTM", name: "Barasat Timber Mart", gstin: "19AABCT1234K1Z9",
      state_code: "19", contact_person: "Sanjib Ghosh", phone: "9830012345",
      address: "Jessore Road, Barasat", payment_terms_days: 30, is_active: true },
    { id: 2, code: "SUP-MPH", name: "Madhyamgram Ply House", gstin: "19AACFM5678L1ZP",
      state_code: "19", contact_person: "Rakesh Saha", phone: "9831045678",
      address: "Madhyamgram Chowmatha", payment_terms_days: 15, is_active: true },
    { id: 3, code: "SUP-BF", name: "Burrabazar Furnishings", gstin: "19AAEFB3456N1ZR",
      state_code: "19", contact_person: "Imran Ali", phone: "9903312345",
      address: "Burrabazar, Kolkata", payment_terms_days: 0, is_active: true },
    { id: 4, code: "SUP-SD", name: "Sleepwell Distributors", gstin: "19AADCS9012M1ZQ",
      state_code: "19", contact_person: "Debasish Roy", phone: "9051122334",
      address: "Barrackpore", payment_terms_days: 21, is_active: true },
  ] as Supplier[],

  purchaseOrders: [
    { id: 1, po_number: "PO/26-27/0001", supplier_id: 1, order_date: "2026-09-08",
      expected_date: "2026-09-16", status: "approved", freight_amount: 2500,
      notes: "Festive season frame stock" },
  ] as PurchaseOrder[],

  poLines: [
    { id: 1, po_id: 1, material_id: 1, quantity: 40, uom: "CFT", rate: 1900,
      tax_rate: 18, hsn_code: "4407", received_quantity: 0, sort_order: 1 },
    { id: 2, po_id: 1, material_id: 2, quantity: 25, uom: "SHEET", rate: 2450,
      tax_rate: 18, hsn_code: "4412", received_quantity: 0, sort_order: 2 },
  ] as PurchaseOrderLine[],

  grns: [] as Grn[],
  grnLines: [] as Record<string, unknown>[],

  nextId: { supplier: 5, po: 2, poLine: 3, grn: 1, grnLine: 1 },
  nextPoSeq: 2,
  nextGrnSeq: 1,
};

let purchaseTablesReady = false;

export async function ensurePurchaseTables(): Promise<void> {
  const sql = getSql();
  if (!sql || purchaseTablesReady) return;

  try {
    await sql`CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      code VARCHAR(40) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      gstin VARCHAR(20),
      state_code VARCHAR(2) NOT NULL DEFAULT '19',
      contact_person VARCHAR(120),
      phone VARCHAR(20),
      address TEXT,
      payment_terms_days INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po_number VARCHAR(40) UNIQUE NOT NULL,
      supplier_id INT NOT NULL REFERENCES suppliers(id),
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expected_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      freight_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS purchase_order_lines (
      id SERIAL PRIMARY KEY,
      po_id INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      material_id INT NOT NULL REFERENCES materials(id),
      quantity NUMERIC(16,3) NOT NULL CHECK (quantity > 0),
      uom VARCHAR(20) NOT NULL,
      rate NUMERIC(14,2) NOT NULL DEFAULT 0,
      tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
      hsn_code VARCHAR(20),
      received_quantity NUMERIC(16,3) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0)`;

    await sql`CREATE TABLE IF NOT EXISTS grns (
      id SERIAL PRIMARY KEY,
      grn_number VARCHAR(40) UNIQUE NOT NULL,
      po_id INT REFERENCES purchase_orders(id),
      supplier_id INT NOT NULL REFERENCES suppliers(id),
      receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
      supplier_invoice_no VARCHAR(60),
      supplier_invoice_date DATE,
      freight_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      regime_at_receipt BOOLEAN NOT NULL DEFAULT FALSE,
      cost_basis VARCHAR(10) NOT NULL DEFAULT 'inclusive',
      gstin_at_receipt VARCHAR(20),
      total_taxable NUMERIC(14,2) NOT NULL DEFAULT 0,
      total_tax NUMERIC(14,2) NOT NULL DEFAULT 0,
      total_recoverable_tax NUMERIC(14,2) NOT NULL DEFAULT 0,
      total_inventory_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS grn_lines (
      id SERIAL PRIMARY KEY,
      grn_id INT NOT NULL REFERENCES grns(id) ON DELETE CASCADE,
      po_line_id INT REFERENCES purchase_order_lines(id),
      material_id INT NOT NULL REFERENCES materials(id),
      batch_id INT REFERENCES material_batches(id),
      accepted_quantity NUMERIC(16,3) NOT NULL,
      rejected_quantity NUMERIC(16,3) NOT NULL DEFAULT 0,
      rejection_reason TEXT,
      purchase_uom VARCHAR(20),
      stock_quantity NUMERIC(16,4),
      rate NUMERIC(14,2),
      tax_rate NUMERIC(5,2),
      taxable_value NUMERIC(14,2),
      cgst_amount NUMERIC(14,2),
      sgst_amount NUMERIC(14,2),
      igst_amount NUMERIC(14,2),
      freight_allocated NUMERIC(14,2) NOT NULL DEFAULT 0,
      inventory_value NUMERIC(14,2),
      recoverable_tax NUMERIC(14,2),
      landed_unit_cost NUMERIC(14,4),
      price_variance_total NUMERIC(14,2))`;

    await sql`CREATE INDEX IF NOT EXISTS idx_po_lines_po ON purchase_order_lines(po_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_grn_lines_grn ON grn_lines(grn_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_grn_lines_material ON grn_lines(material_id)`;

    for (const s of memPurchase.suppliers) {
      await sql`INSERT INTO suppliers (code, name, gstin, state_code, contact_person, phone, address, payment_terms_days)
                VALUES (${s.code}, ${s.name}, ${s.gstin}, ${s.state_code}, ${s.contact_person},
                        ${s.phone}, ${s.address}, ${s.payment_terms_days})
                ON CONFLICT (code) DO NOTHING`;
    }

    purchaseTablesReady = true;
  } catch (error) {
    console.error("Error initializing purchase schema:", error);
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

// -----------------------------------------------------------------------------
// Suppliers
// -----------------------------------------------------------------------------
export async function getSuppliers(): Promise<Supplier[]> {
  const sql = getSql();
  if (!sql) return memPurchase.suppliers.filter((s) => s.is_active);
  await ensurePurchaseTables();
  return (await sql`SELECT id, code, name, gstin, state_code, contact_person, phone, address,
                           payment_terms_days, is_active
                    FROM suppliers WHERE is_active = TRUE ORDER BY name`) as Supplier[];
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const sql = getSql();
  if (sql) {
    await ensurePurchaseTables();
    const rows = (await sql`
      INSERT INTO suppliers (code, name, gstin, state_code, contact_person, phone, address, payment_terms_days)
      VALUES (${input.code}, ${input.name}, ${input.gstin ?? null}, ${input.state_code},
              ${input.contact_person ?? null}, ${input.phone ?? null}, ${input.address ?? null},
              ${input.payment_terms_days})
      RETURNING id, code, name, gstin, state_code, contact_person, phone, address,
                payment_terms_days, is_active`) as Supplier[];
    await logAudit("supplier", String(rows[0].id), "create", { code: input.code });
    return rows[0];
  }
  const created: Supplier = {
    id: memPurchase.nextId.supplier++, ...input,
    gstin: input.gstin ?? null, contact_person: input.contact_person ?? null,
    phone: input.phone ?? null, address: input.address ?? null, is_active: true,
  };
  memPurchase.suppliers.push(created);
  return created;
}

// -----------------------------------------------------------------------------
// Document numbering
// -----------------------------------------------------------------------------
async function nextDocumentNumber(prefix: string, date: string): Promise<string> {
  const fy = financialYearOf(date);
  const shortFy = fy.replace("20", "");
  const sql = getSql();

  if (sql) {
    const table = prefix === "PO" ? "purchase_orders" : "grns";
    const column = prefix === "PO" ? "po_number" : "grn_number";
    const rows = (await sql.query(
      `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${column} LIKE $1`,
      [`${prefix}/${shortFy}/%`]
    )) as unknown as { n: number }[];
    const seq = (rows[0]?.n ?? 0) + 1;
    return `${prefix}/${shortFy}/${String(seq).padStart(4, "0")}`;
  }

  const seq = prefix === "PO" ? memPurchase.nextPoSeq++ : memPurchase.nextGrnSeq++;
  return `${prefix}/${shortFy}/${String(seq).padStart(4, "0")}`;
}

// -----------------------------------------------------------------------------
// Purchase orders
// -----------------------------------------------------------------------------
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const sql = getSql();
  if (sql) {
    await ensurePurchaseTables();
    const rows = (await sql`
      SELECT p.id, p.po_number, p.supplier_id, s.name AS supplier_name, s.gstin AS supplier_gstin,
             TO_CHAR(p.order_date,'YYYY-MM-DD') AS order_date,
             TO_CHAR(p.expected_date,'YYYY-MM-DD') AS expected_date,
             p.status, p.freight_amount::float AS freight_amount, p.notes,
             (SELECT COUNT(*) FROM purchase_order_lines WHERE po_id = p.id) AS line_count,
             COALESCE((SELECT SUM(quantity * rate) FROM purchase_order_lines WHERE po_id = p.id), 0)::float AS total_value
      FROM purchase_orders p JOIN suppliers s ON s.id = p.supplier_id
      ORDER BY p.order_date DESC, p.id DESC`) as Record<string, unknown>[];
    return rows.map((r) => ({
      ...(r as unknown as PurchaseOrder),
      line_count: Number(r.line_count),
      total_value: Number(r.total_value),
    }));
  }

  return memPurchase.purchaseOrders
    .map((po) => {
      const lines = memPurchase.poLines.filter((l) => l.po_id === po.id);
      const supplier = memPurchase.suppliers.find((s) => s.id === po.supplier_id);
      return {
        ...po,
        supplier_name: supplier?.name,
        supplier_gstin: supplier?.gstin,
        line_count: lines.length,
        total_value: round2(lines.reduce((s, l) => s + l.quantity * l.rate, 0)),
      };
    })
    .sort((a, b) => b.order_date.localeCompare(a.order_date));
}

export async function getPurchaseOrderLines(poId: number): Promise<PurchaseOrderLine[]> {
  const sql = getSql();
  if (sql) {
    await ensurePurchaseTables();
    return (await sql`
      SELECT l.id, l.po_id, l.material_id, m.code AS material_code, m.name AS material_name,
             l.quantity::float AS quantity, l.uom, l.rate::float AS rate,
             l.tax_rate::float AS tax_rate, l.hsn_code,
             l.received_quantity::float AS received_quantity, l.sort_order
      FROM purchase_order_lines l JOIN materials m ON m.id = l.material_id
      WHERE l.po_id = ${poId} ORDER BY l.sort_order, l.id`) as PurchaseOrderLine[];
  }

  const materials = await getMaterials();
  return memPurchase.poLines
    .filter((l) => l.po_id === poId)
    .map((l) => {
      const m = materials.find((x) => x.id === l.material_id);
      return { ...l, material_code: m?.code, material_name: m?.name };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrder> {
  const poNumber = await nextDocumentNumber("PO", input.order_date);
  const sql = getSql();

  if (sql) {
    await ensurePurchaseTables();
    const rows = (await sql`
      INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_date, status, freight_amount, notes)
      VALUES (${poNumber}, ${input.supplier_id}, ${input.order_date}, ${input.expected_date ?? null},
              'approved', ${input.freight_amount}, ${input.notes ?? null})
      RETURNING id, po_number, supplier_id,
                TO_CHAR(order_date,'YYYY-MM-DD') AS order_date,
                TO_CHAR(expected_date,'YYYY-MM-DD') AS expected_date,
                status, freight_amount::float AS freight_amount, notes`) as PurchaseOrder[];
    const po = rows[0];

    let order = 1;
    for (const l of input.lines) {
      await sql`INSERT INTO purchase_order_lines (po_id, material_id, quantity, uom, rate, tax_rate, hsn_code, sort_order)
                VALUES (${po.id}, ${l.material_id}, ${l.quantity}, ${l.uom}, ${l.rate},
                        ${l.tax_rate}, ${l.hsn_code ?? null}, ${order++})`;
    }
    await logAudit("purchase_order", String(po.id), "create", { po_number: poNumber, lines: input.lines.length });
    return po;
  }

  const po: PurchaseOrder = {
    id: memPurchase.nextId.po++,
    po_number: poNumber,
    supplier_id: input.supplier_id,
    order_date: input.order_date,
    expected_date: input.expected_date ?? null,
    status: "approved",
    freight_amount: input.freight_amount,
    notes: input.notes ?? null,
  };
  memPurchase.purchaseOrders.push(po);

  let order = 1;
  for (const l of input.lines) {
    memPurchase.poLines.push({
      id: memPurchase.nextId.poLine++, po_id: po.id, material_id: l.material_id,
      quantity: l.quantity, uom: l.uom, rate: l.rate, tax_rate: l.tax_rate,
      hsn_code: l.hsn_code ?? null, received_quantity: 0, sort_order: order++,
    });
  }
  return po;
}

// -----------------------------------------------------------------------------
// GRN — the point where the dual cost basis is applied and frozen
// -----------------------------------------------------------------------------
export async function receiveGrn(input: GrnInput): Promise<{ grn: Grn; posted: PostedGrn }> {
  const sql = getSql();
  if (sql) await ensurePurchaseTables();

  const [materials, periods, config, suppliers] = await Promise.all([
    getMaterials(),
    getRegimePeriods(),
    getTaxConfig(),
    getSuppliers(),
  ]);

  // The regime that applies is the one in force on the RECEIPT DATE.
  const regime = resolveRegimeForDate(periods, input.receipt_date, config.state_code);
  const supplier = suppliers.find((s) => s.id === input.supplier_id);
  const materialsById = new Map<number, Material>(materials.map((m) => [m.id, m]));

  const posted = postGrn({
    lines: input.lines,
    freightAmount: input.freight_amount,
    regime,
    materialsById,
    supplierStateCode: supplier?.state_code,
  });

  const grnNumber = await nextDocumentNumber("GRN", input.receipt_date);

  const grn: Grn = {
    id: 0,
    grn_number: grnNumber,
    po_id: input.po_id ?? null,
    supplier_id: input.supplier_id,
    supplier_name: supplier?.name,
    receipt_date: input.receipt_date,
    supplier_invoice_no: input.supplier_invoice_no ?? null,
    supplier_invoice_date: input.supplier_invoice_date ?? null,
    freight_amount: input.freight_amount,
    regime_at_receipt: posted.regime_at_receipt,
    cost_basis: posted.cost_basis,
    gstin_at_receipt: posted.gstin_at_receipt,
    total_taxable: posted.total_taxable,
    total_tax: posted.total_tax,
    total_recoverable_tax: posted.total_recoverable_tax,
    total_inventory_value: posted.total_inventory_value,
    notes: input.notes ?? null,
    line_count: posted.lines.length,
  };

  if (sql) {
    const rows = (await sql`
      INSERT INTO grns (grn_number, po_id, supplier_id, receipt_date, supplier_invoice_no,
        supplier_invoice_date, freight_amount, regime_at_receipt, cost_basis, gstin_at_receipt,
        total_taxable, total_tax, total_recoverable_tax, total_inventory_value, notes)
      VALUES (${grnNumber}, ${input.po_id ?? null}, ${input.supplier_id}, ${input.receipt_date},
        ${input.supplier_invoice_no ?? null}, ${input.supplier_invoice_date ?? null},
        ${input.freight_amount}, ${posted.regime_at_receipt}, ${posted.cost_basis},
        ${posted.gstin_at_receipt}, ${posted.total_taxable}, ${posted.total_tax},
        ${posted.total_recoverable_tax}, ${posted.total_inventory_value}, ${input.notes ?? null})
      RETURNING id`) as { id: number }[];
    grn.id = rows[0].id;
  } else {
    grn.id = memPurchase.nextId.grn++;
    memPurchase.grns.push(grn);
  }

  // Write each accepted line into stock as a batch, carrying supplier and tax
  // detail so transitional credit can be claimed later.
  for (const line of posted.lines) {
    const inputLine = input.lines.find(
      (l) => l.material_id === line.material_id && l.batch_no === line.batch_no
    );

    const batch = await addMaterialBatch(line.material_id, {
      batch_no: line.batch_no,
      dye_lot: line.dye_lot,
      quantity: line.stock_quantity,
      rate: line.landed_unit_cost,
      received_date: input.receipt_date,
      expiry_date: inputLine?.expiry_date ?? null,
      moisture_pct: inputLine?.moisture_pct ?? null,
      kiln_batch: inputLine?.kiln_batch ?? null,
      location: inputLine?.location ?? null,
      notes: `Received on ${grnNumber}`,
      supplier_name: supplier?.name ?? null,
      supplier_invoice_no: input.supplier_invoice_no ?? null,
      supplier_invoice_date: input.supplier_invoice_date ?? null,
      supplier_gstin: supplier?.gstin ?? null,
      taxable_value: line.taxable_value,
      tax_rate: line.tax_rate,
      cgst_amount: line.cgst_amount,
      sgst_amount: line.sgst_amount,
      igst_amount: line.igst_amount,
      cost_basis: posted.cost_basis,
      regime_at_receipt: posted.regime_at_receipt,
    });

    if (sql) {
      await sql`
        INSERT INTO grn_lines (grn_id, po_line_id, material_id, batch_id, accepted_quantity,
          rejected_quantity, rejection_reason, purchase_uom, stock_quantity, rate, tax_rate,
          taxable_value, cgst_amount, sgst_amount, igst_amount, freight_allocated,
          inventory_value, recoverable_tax, landed_unit_cost, price_variance_total)
        VALUES (${grn.id}, ${inputLine?.po_line_id ?? null}, ${line.material_id}, ${batch.id},
          ${line.accepted_quantity}, ${inputLine?.rejected_quantity ?? 0},
          ${inputLine?.rejection_reason ?? null}, ${line.purchase_uom}, ${line.stock_quantity},
          ${inputLine?.rate ?? 0}, ${line.tax_rate}, ${line.taxable_value},
          ${line.cgst_amount}, ${line.sgst_amount}, ${line.igst_amount},
          ${line.freight_allocated}, ${line.inventory_value}, ${line.recoverable_tax},
          ${line.landed_unit_cost}, ${line.price_variance_total})`;
    } else {
      memPurchase.grnLines.push({
        id: memPurchase.nextId.grnLine++, grn_id: grn.id, material_id: line.material_id,
        batch_id: batch.id, grn_number: grnNumber, receipt_date: input.receipt_date,
        supplier_name: supplier?.name, rate: inputLine?.rate ?? 0,
        landed_unit_cost: line.landed_unit_cost, stock_uom: line.stock_uom,
        price_variance_total: line.price_variance_total,
      });
    }

    // Advance the PO line's received quantity and roll up the PO status.
    if (inputLine?.po_line_id) {
      if (sql) {
        await sql`UPDATE purchase_order_lines
                  SET received_quantity = received_quantity + ${line.accepted_quantity}
                  WHERE id = ${inputLine.po_line_id}`;
      } else {
        const poLine = memPurchase.poLines.find((l) => l.id === inputLine.po_line_id);
        if (poLine) poLine.received_quantity += line.accepted_quantity;
      }
    }
  }

  if (input.po_id) await refreshPoStatus(input.po_id);

  await logAudit("grn", String(grn.id), "receive", {
    grn_number: grnNumber, cost_basis: posted.cost_basis,
    regime_at_receipt: posted.regime_at_receipt,
    inventory_value: posted.total_inventory_value,
  });

  return { grn, posted };
}

/** A PO is received once every line has met its ordered quantity. */
async function refreshPoStatus(poId: number): Promise<void> {
  const lines = await getPurchaseOrderLines(poId);
  if (!lines.length) return;

  const allReceived = lines.every((l) => Number(l.received_quantity) >= Number(l.quantity));
  const anyReceived = lines.some((l) => Number(l.received_quantity) > 0);
  const status = allReceived ? "received" : anyReceived ? "partial" : "approved";

  const sql = getSql();
  if (sql) {
    await sql`UPDATE purchase_orders SET status = ${status}, updated_at = NOW() WHERE id = ${poId}`;
    return;
  }
  const po = memPurchase.purchaseOrders.find((p) => p.id === poId);
  if (po) po.status = status as PurchaseOrder["status"];
}

export async function getGrns(): Promise<Grn[]> {
  const sql = getSql();
  if (sql) {
    await ensurePurchaseTables();
    const rows = (await sql`
      SELECT g.id, g.grn_number, g.po_id, p.po_number, g.supplier_id, s.name AS supplier_name,
             TO_CHAR(g.receipt_date,'YYYY-MM-DD') AS receipt_date,
             g.supplier_invoice_no, TO_CHAR(g.supplier_invoice_date,'YYYY-MM-DD') AS supplier_invoice_date,
             g.freight_amount::float AS freight_amount, g.regime_at_receipt, g.cost_basis,
             g.gstin_at_receipt, g.total_taxable::float AS total_taxable,
             g.total_tax::float AS total_tax,
             g.total_recoverable_tax::float AS total_recoverable_tax,
             g.total_inventory_value::float AS total_inventory_value, g.notes,
             (SELECT COUNT(*) FROM grn_lines WHERE grn_id = g.id) AS line_count
      FROM grns g
      JOIN suppliers s ON s.id = g.supplier_id
      LEFT JOIN purchase_orders p ON p.id = g.po_id
      ORDER BY g.receipt_date DESC, g.id DESC`) as Record<string, unknown>[];
    return rows.map((r) => ({ ...(r as unknown as Grn), line_count: Number(r.line_count) }));
  }
  return [...memPurchase.grns].sort((a, b) => b.receipt_date.localeCompare(a.receipt_date));
}

/** Rate history for a material, so timber and ply price movement is visible. */
export async function getPriceHistory(materialId: number): Promise<PriceHistoryPoint[]> {
  const sql = getSql();
  if (sql) {
    await ensurePurchaseTables();
    return (await sql`
      SELECT TO_CHAR(g.receipt_date,'YYYY-MM-DD') AS date, s.name AS supplier_name,
             g.grn_number, l.rate::float AS rate,
             l.landed_unit_cost::float AS landed_unit_cost, m.stock_uom
      FROM grn_lines l
      JOIN grns g ON g.id = l.grn_id
      JOIN suppliers s ON s.id = g.supplier_id
      JOIN materials m ON m.id = l.material_id
      WHERE l.material_id = ${materialId}
      ORDER BY g.receipt_date DESC LIMIT 20`) as PriceHistoryPoint[];
  }

  return memPurchase.grnLines
    .filter((l) => l.material_id === materialId)
    .map((l) => ({
      date: l.receipt_date as string,
      supplier_name: (l.supplier_name as string) ?? "",
      grn_number: l.grn_number as string,
      rate: l.rate as number,
      landed_unit_cost: l.landed_unit_cost as number,
      stock_uom: (l.stock_uom as string) ?? "",
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
