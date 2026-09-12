import { neon } from "@neondatabase/serverless";
import {
  Customer, FinishedUnit, SalesOrder, SalesOrderInput, SalesOrderLine,
  KhataEntry, KhataAccount, TurnoverStatus, AtpResult, CashBookRow,
  RegistrationTrigger, ConditionGrade, PaymentMode,
} from "./sales-types";
import { getProducts } from "./erp-db";
import { getWorkOrders } from "./production-db";
import { getRegimePeriods, getTaxConfig, getTaxRules } from "./tax-db";
import { resolveRegimeForDate, financialYearOf, round2 } from "./tax-regime";
import {
  priceOrder, computeDelivery, registrationTriggers, computeTurnoverStatus,
  fyMonthsElapsed, computeKhataBalance, summariseKhata, computeAtp,
  isSellable, softHoldExpiry,
} from "./sales-logic";

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

function getSql() {
  return connectionString ? neon(connectionString) : null;
}

import { currentActor } from "./actor";
const today = () => new Date().toISOString().slice(0, 10);

const memSales = {
  customers: [
    { id: 1, name: "Sujata Ghosh", phone: "9830099901", address: "Champadali, Barasat",
      zone_code: "BARASAT", gstin: null, state_code: "19", created_at: "2026-07-01" },
    { id: 2, name: "Amit Chakraborty", phone: "9830099902", address: "Madhyamgram",
      zone_code: "MADHYAMGRAM", gstin: null, state_code: "19", created_at: "2026-08-10" },
    { id: 3, name: "Rina Interiors", phone: "9830099903", address: "Salt Lake Sector 2",
      zone_code: "SALTLAKE", gstin: "19AABCR1234M1Z7", state_code: "19", created_at: "2026-08-22" },
  ] as Customer[],
  units: [] as FinishedUnit[],
  orders: [] as SalesOrder[],
  orderLines: [] as SalesOrderLine[],
  khata: [] as KhataEntry[],
  settings: { other_pan_turnover: 0 },
  nextId: { customer: 4, unit: 1, order: 1, line: 1, khata: 1 },
  nextOrderSeq: { cash_memo: 1, tax_invoice: 1, bill_of_supply: 1 },
};

let salesTablesReady = false;

export async function ensureSalesTables(): Promise<void> {
  const sql = getSql();
  if (!sql || salesTablesReady) return;

  try {
    await sql`CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, phone VARCHAR(20) NOT NULL,
      address TEXT, zone_code VARCHAR(30), gstin VARCHAR(20),
      state_code VARCHAR(2) NOT NULL DEFAULT '19',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS finished_units (
      id SERIAL PRIMARY KEY, serial_no VARCHAR(40) UNIQUE NOT NULL,
      product_id INT NOT NULL REFERENCES products(id),
      work_order_id INT REFERENCES work_orders(id),
      condition_grade VARCHAR(30) NOT NULL DEFAULT 'new_in_box',
      cost NUMERIC(14,2) NOT NULL DEFAULT 0,
      list_price NUMERIC(14,2) NOT NULL DEFAULT 0,
      carton_total INT NOT NULL DEFAULT 1, cartons_present INT NOT NULL DEFAULT 1,
      floor_since DATE, status VARCHAR(20) NOT NULL DEFAULT 'available',
      reserved_for_order_id INT, hold_expires_at TIMESTAMPTZ, location VARCHAR(80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS sales_orders (
      id SERIAL PRIMARY KEY, order_number VARCHAR(40) UNIQUE NOT NULL,
      document_type VARCHAR(20) NOT NULL DEFAULT 'cash_memo',
      regime_at_sale BOOLEAN NOT NULL DEFAULT FALSE,
      gstin_at_sale VARCHAR(20),
      customer_id INT NOT NULL REFERENCES customers(id),
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'quote',
      channel VARCHAR(20) NOT NULL DEFAULT 'walk_in',
      zone_code VARCHAR(30), floor INT NOT NULL DEFAULT 0,
      has_lift BOOLEAN NOT NULL DEFAULT FALSE,
      delivery_charge NUMERIC(14,2) NOT NULL DEFAULT 0,
      services_itemised BOOLEAN NOT NULL DEFAULT FALSE,
      subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
      tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      advance_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
      balance_due NUMERIC(14,2) NOT NULL DEFAULT 0,
      promised_date DATE, notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS sales_order_lines (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      product_id INT NOT NULL REFERENCES products(id),
      finished_unit_id INT REFERENCES finished_units(id),
      quantity NUMERIC(16,3) NOT NULL DEFAULT 1,
      unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
      line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      hsn_code VARCHAR(20), tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
      taxable_value NUMERIC(14,2), cgst_amount NUMERIC(14,2),
      sgst_amount NUMERIC(14,2), igst_amount NUMERIC(14,2),
      unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0)`;

    await sql`CREATE TABLE IF NOT EXISTS khata_entries (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL REFERENCES customers(id),
      order_id INT REFERENCES sales_orders(id),
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      amount NUMERIC(14,2) NOT NULL,
      mode VARCHAR(20), reference VARCHAR(80), notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS shop_settings (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      other_pan_turnover NUMERIC(14,2) NOT NULL DEFAULT 0)`;

    await sql`INSERT INTO shop_settings (id, other_pan_turnover) VALUES (1, 0)
              ON CONFLICT (id) DO NOTHING`;

    await sql`CREATE INDEX IF NOT EXISTS idx_units_product ON finished_units(product_id, status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_khata_customer ON khata_entries(customer_id, entry_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_date ON sales_orders(order_date)`;

    for (const c of memSales.customers) {
      await sql`INSERT INTO customers (name, phone, address, zone_code, gstin, state_code)
                VALUES (${c.name}, ${c.phone}, ${c.address}, ${c.zone_code}, ${c.gstin}, ${c.state_code})
                ON CONFLICT DO NOTHING`;
    }

    salesTablesReady = true;
  } catch (error) {
    console.error("Error initializing sales schema:", error);
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

async function ruleValue(key: string, fallback: number): Promise<number> {
  const rules = await getTaxRules();
  return rules.find((r) => r.rule_key === key)?.numeric_value ?? fallback;
}

// -----------------------------------------------------------------------------
// Customers
// -----------------------------------------------------------------------------
export async function getCustomers(): Promise<Customer[]> {
  const sql = getSql();
  if (!sql) return [...memSales.customers];
  await ensureSalesTables();
  return (await sql`SELECT id, name, phone, address, zone_code, gstin, state_code,
                           TO_CHAR(created_at,'YYYY-MM-DD') AS created_at
                    FROM customers ORDER BY name`) as Customer[];
}

export async function createCustomer(input: {
  name: string; phone: string; address?: string | null;
  zone_code?: string | null; gstin?: string | null; state_code: string;
}): Promise<Customer> {
  const sql = getSql();
  if (sql) {
    await ensureSalesTables();
    const rows = (await sql`
      INSERT INTO customers (name, phone, address, zone_code, gstin, state_code)
      VALUES (${input.name}, ${input.phone}, ${input.address ?? null},
              ${input.zone_code ?? null}, ${input.gstin ?? null}, ${input.state_code})
      RETURNING id, name, phone, address, zone_code, gstin, state_code,
                TO_CHAR(created_at,'YYYY-MM-DD') AS created_at`) as Customer[];
    return rows[0];
  }
  const c: Customer = {
    id: memSales.nextId.customer++, name: input.name, phone: input.phone,
    address: input.address ?? null, zone_code: input.zone_code ?? null,
    gstin: input.gstin ?? null, state_code: input.state_code, created_at: today(),
  };
  memSales.customers.push(c);
  return c;
}

// -----------------------------------------------------------------------------
// Finished units
// -----------------------------------------------------------------------------
export async function getFinishedUnits(): Promise<FinishedUnit[]> {
  const sql = getSql();
  if (sql) {
    await ensureSalesTables();
    return (await sql`
      SELECT u.id, u.serial_no, u.product_id, p.name AS product_name, u.work_order_id,
             u.condition_grade, u.cost::float AS cost, u.list_price::float AS list_price,
             u.carton_total, u.cartons_present,
             TO_CHAR(u.floor_since,'YYYY-MM-DD') AS floor_since,
             u.status, u.reserved_for_order_id, u.hold_expires_at, u.location,
             TO_CHAR(u.created_at,'YYYY-MM-DD') AS created_at
      FROM finished_units u JOIN products p ON p.id = u.product_id
      ORDER BY u.id DESC`) as FinishedUnit[];
  }
  const products = await getProducts();
  return memSales.units.map((u) => ({
    ...u, product_name: products.find((p) => p.id === u.product_id)?.name,
  }));
}

export async function createFinishedUnit(input: {
  product_id: number; work_order_id?: number | null;
  condition_grade: ConditionGrade; cost: number; list_price: number;
  carton_total: number; cartons_present: number;
  floor_since?: string | null; location?: string | null;
}): Promise<FinishedUnit> {
  const sql = getSql();
  const serial = `U-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  if (sql) {
    await ensureSalesTables();
    const rows = (await sql`
      INSERT INTO finished_units (serial_no, product_id, work_order_id, condition_grade,
        cost, list_price, carton_total, cartons_present, floor_since, location)
      VALUES (${serial}, ${input.product_id}, ${input.work_order_id ?? null},
        ${input.condition_grade}, ${input.cost}, ${input.list_price},
        ${input.carton_total}, ${input.cartons_present},
        ${input.floor_since ?? null}, ${input.location ?? null})
      RETURNING id`) as { id: number }[];
    await logAudit("finished_unit", String(rows[0].id), "create", { serial });
    return (await getFinishedUnits()).find((u) => u.id === rows[0].id)!;
  }

  const u: FinishedUnit = {
    id: memSales.nextId.unit++, serial_no: serial, product_id: input.product_id,
    work_order_id: input.work_order_id ?? null, condition_grade: input.condition_grade,
    cost: input.cost, list_price: input.list_price,
    carton_total: input.carton_total, cartons_present: input.cartons_present,
    floor_since: input.floor_since ?? null, status: "available",
    reserved_for_order_id: null, hold_expires_at: null,
    location: input.location ?? null, created_at: today(),
  };
  memSales.units.push(u);
  return u;
}

export async function getAtp(): Promise<AtpResult[]> {
  const [units, products, workOrders] = await Promise.all([
    getFinishedUnits(), getProducts(), getWorkOrders(),
  ]);

  return products
    .filter((p) => p.product_type === "finished")
    .map((p) => {
      const wos = workOrders.filter(
        (w) => w.product_id === p.id && (w.status === "released" || w.status === "in_progress")
      );
      const inProduction = wos.reduce(
        (s, w) => s + (w.quantity - (w.completed_quantity ?? 0)), 0
      );
      const nextDate = wos.map((w) => w.due_date).filter(Boolean).sort()[0] ?? null;
      return computeAtp(p.id, p.name, units, inProduction, nextDate);
    });
}

// -----------------------------------------------------------------------------
// Sales orders
// -----------------------------------------------------------------------------
const SERIES_PREFIX: Record<string, string> = {
  cash_memo: "CM", tax_invoice: "TI", bill_of_supply: "BOS",
};

async function nextOrderNumber(documentType: string, date: string): Promise<string> {
  const shortFy = financialYearOf(date).replace("20", "");
  const prefix = SERIES_PREFIX[documentType] ?? "CM";
  const sql = getSql();

  if (sql) {
    const rows = (await sql`SELECT COUNT(*)::int AS n FROM sales_orders
                            WHERE order_number LIKE ${prefix + "/" + shortFy + "/%"}`) as { n: number }[];
    return `${prefix}/${shortFy}/${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
  }

  const key = documentType as keyof typeof memSales.nextOrderSeq;
  const seq = memSales.nextOrderSeq[key] ?? 1;
  memSales.nextOrderSeq[key] = seq + 1;
  return `${prefix}/${shortFy}/${String(seq).padStart(4, "0")}`;
}

export async function createSalesOrder(
  input: SalesOrderInput
): Promise<{ order: SalesOrder; triggers: RegistrationTrigger[] }> {
  const sql = getSql();
  if (sql) await ensureSalesTables();

  const [customers, periods, config, units] = await Promise.all([
    getCustomers(), getRegimePeriods(), getTaxConfig(), getFinishedUnits(),
  ]);

  const customer = customers.find((c) => c.id === input.customer_id);
  if (!customer) throw new Error("Customer not found");

  // The document type is decided by the regime on the ORDER DATE and frozen.
  const regime = resolveRegimeForDate(periods, input.order_date, config.state_code);

  const triggers = registrationTriggers({
    regime,
    zoneCode: input.zone_code,
    channel: input.channel,
    servicesItemised: input.services_itemised,
    buyerGstin: customer.gstin,
  });

  const delivery = input.zone_code
    ? computeDelivery(input.zone_code, input.floor, input.has_lift)
    : null;
  const deliveryCharge = delivery?.total_charge ?? 0;

  const priced = priceOrder(
    input.lines.map((l) => ({
      product_id: l.product_id, quantity: l.quantity,
      unit_price: l.unit_price, tax_rate: l.tax_rate,
    })),
    deliveryCharge, input.advance_paid, regime, customer.state_code
  );

  const orderNumber = await nextOrderNumber(priced.document_type, input.order_date);
  // Raising a bill is a sale. Only an explicitly marked quotation is a quote —
  // a counter sale paid in full carries no "advance" and must still count as
  // turnover, which is exactly what the watchdog depends on.
  const status = input.is_quote ? "quote" : "confirmed";

  const order: SalesOrder = {
    id: 0, order_number: orderNumber, document_type: priced.document_type,
    regime_at_sale: regime.registered, gstin_at_sale: regime.registration_number,
    customer_id: customer.id, customer_name: customer.name,
    customer_phone: customer.phone, customer_gstin: customer.gstin,
    order_date: input.order_date, status, channel: input.channel,
    zone_code: input.zone_code, floor: input.floor, has_lift: input.has_lift,
    delivery_charge: deliveryCharge, services_itemised: input.services_itemised,
    subtotal: priced.subtotal, tax_total: priced.tax_total,
    grand_total: priced.grand_total, advance_paid: input.advance_paid,
    balance_due: priced.balance_due, promised_date: input.promised_date ?? null,
    notes: input.notes ?? null, line_count: input.lines.length,
  };

  if (sql) {
    const rows = (await sql`
      INSERT INTO sales_orders (order_number, document_type, regime_at_sale, gstin_at_sale,
        customer_id, order_date, status, channel, zone_code, floor, has_lift,
        delivery_charge, services_itemised, subtotal, tax_total, grand_total,
        advance_paid, balance_due, promised_date, notes)
      VALUES (${orderNumber}, ${priced.document_type}, ${regime.registered},
        ${regime.registration_number}, ${customer.id}, ${input.order_date}, ${status},
        ${input.channel}, ${input.zone_code}, ${input.floor}, ${input.has_lift},
        ${deliveryCharge}, ${input.services_itemised}, ${priced.subtotal},
        ${priced.tax_total}, ${priced.grand_total}, ${input.advance_paid},
        ${priced.balance_due}, ${input.promised_date ?? null}, ${input.notes ?? null})
      RETURNING id`) as { id: number }[];
    order.id = rows[0].id;
  } else {
    order.id = memSales.nextId.order++;
    memSales.orders.push(order);
  }

  for (let i = 0; i < input.lines.length; i++) {
    const l = input.lines[i];
    const p = priced.lines[i];
    const unitCost = l.finished_unit_id
      ? units.find((u) => u.id === l.finished_unit_id)?.cost ?? 0
      : 0;

    if (sql) {
      await sql`INSERT INTO sales_order_lines (order_id, product_id, finished_unit_id,
                  quantity, unit_price, line_total, hsn_code, tax_rate,
                  taxable_value, cgst_amount, sgst_amount, igst_amount, unit_cost)
                VALUES (${order.id}, ${l.product_id}, ${l.finished_unit_id ?? null},
                  ${l.quantity}, ${l.unit_price}, ${p.line_total}, ${l.hsn_code ?? null},
                  ${l.tax_rate}, ${p.taxable_value}, ${p.cgst_amount}, ${p.sgst_amount},
                  ${p.igst_amount}, ${unitCost})`;
    } else {
      memSales.orderLines.push({
        id: memSales.nextId.line++, order_id: order.id, product_id: l.product_id,
        finished_unit_id: l.finished_unit_id ?? null, quantity: l.quantity,
        unit_price: l.unit_price, line_total: p.line_total,
        hsn_code: l.hsn_code ?? null, tax_rate: l.tax_rate,
        taxable_value: p.taxable_value, cgst_amount: p.cgst_amount,
        sgst_amount: p.sgst_amount, igst_amount: p.igst_amount, unit_cost: unitCost,
      });
    }

    // Reserve the physical unit: soft while it is a quote, hard once confirmed.
    if (l.finished_unit_id) {
      const newStatus = status === "confirmed" ? "hard_reserved" : "soft_reserved";
      const expiry = status === "confirmed" ? null : softHoldExpiry(new Date().toISOString());

      if (sql) {
        await sql`UPDATE finished_units SET status = ${newStatus},
                    reserved_for_order_id = ${order.id}, hold_expires_at = ${expiry}
                  WHERE id = ${l.finished_unit_id}`;
      } else {
        const u = memSales.units.find((x) => x.id === l.finished_unit_id);
        if (u) {
          u.status = newStatus as FinishedUnit["status"];
          u.reserved_for_order_id = order.id;
          u.hold_expires_at = expiry;
        }
      }
    }
  }

  // Post to the khata: the full bill as a charge, the advance as a payment.
  await addKhataEntry({
    customer_id: customer.id, order_id: order.id, entry_date: input.order_date,
    amount: priced.grand_total, mode: null, reference: orderNumber,
    notes: `${priced.document_type.replace(/_/g, " ")} raised`,
  });
  if (input.advance_paid > 0) {
    await addKhataEntry({
      customer_id: customer.id, order_id: order.id, entry_date: input.order_date,
      amount: -input.advance_paid, mode: "cash", reference: orderNumber,
      notes: "Advance / token",
    });
  }

  await logAudit("sales_order", String(order.id), "create", {
    order_number: orderNumber, document_type: priced.document_type,
    total: priced.grand_total, triggers: triggers.map((t) => t.code),
  });

  return { order, triggers };
}

export async function getSalesOrders(): Promise<SalesOrder[]> {
  const sql = getSql();
  if (sql) {
    await ensureSalesTables();
    return (await sql`
      SELECT o.id, o.order_number, o.document_type, o.regime_at_sale, o.gstin_at_sale,
             o.customer_id, c.name AS customer_name, c.phone AS customer_phone,
             c.gstin AS customer_gstin,
             TO_CHAR(o.order_date,'YYYY-MM-DD') AS order_date, o.status, o.channel,
             o.zone_code, o.floor, o.has_lift,
             o.delivery_charge::float AS delivery_charge, o.services_itemised,
             o.subtotal::float AS subtotal, o.tax_total::float AS tax_total,
             o.grand_total::float AS grand_total, o.advance_paid::float AS advance_paid,
             o.balance_due::float AS balance_due,
             TO_CHAR(o.promised_date,'YYYY-MM-DD') AS promised_date, o.notes,
             (SELECT COUNT(*) FROM sales_order_lines WHERE order_id = o.id) AS line_count
      FROM sales_orders o JOIN customers c ON c.id = o.customer_id
      ORDER BY o.order_date DESC, o.id DESC`) as SalesOrder[];
  }
  return memSales.orders.map((o) => {
    const c = memSales.customers.find((x) => x.id === o.customer_id);
    return { ...o, customer_name: c?.name, customer_phone: c?.phone, customer_gstin: c?.gstin };
  }).sort((a, b) => b.order_date.localeCompare(a.order_date) || b.id - a.id);
}

export async function getOrderLines(orderId: number): Promise<SalesOrderLine[]> {
  const sql = getSql();
  if (sql) {
    await ensureSalesTables();
    return (await sql`
      SELECT l.id, l.order_id, l.product_id, p.name AS product_name, l.finished_unit_id,
             u.serial_no, u.condition_grade,
             l.quantity::float AS quantity, l.unit_price::float AS unit_price,
             l.line_total::float AS line_total, l.hsn_code, l.tax_rate::float AS tax_rate,
             l.taxable_value::float AS taxable_value, l.cgst_amount::float AS cgst_amount,
             l.sgst_amount::float AS sgst_amount, l.igst_amount::float AS igst_amount,
             l.unit_cost::float AS unit_cost
      FROM sales_order_lines l
      JOIN products p ON p.id = l.product_id
      LEFT JOIN finished_units u ON u.id = l.finished_unit_id
      WHERE l.order_id = ${orderId}`) as SalesOrderLine[];
  }
  const products = await getProducts();
  return memSales.orderLines.filter((l) => l.order_id === orderId).map((l) => {
    const u = memSales.units.find((x) => x.id === l.finished_unit_id);
    return {
      ...l, product_name: products.find((p) => p.id === l.product_id)?.name,
      serial_no: u?.serial_no ?? null, condition_grade: u?.condition_grade,
    };
  });
}

export async function updateOrderStatus(orderId: number, status: string): Promise<void> {
  const sql = getSql();
  if (sql) {
    await sql`UPDATE sales_orders SET status = ${status} WHERE id = ${orderId}`;
    if (status === "delivered") {
      await sql`UPDATE finished_units SET status = 'sold' WHERE reserved_for_order_id = ${orderId}`;
    }
    await logAudit("sales_order", String(orderId), "status", { status });
    return;
  }
  const o = memSales.orders.find((x) => x.id === orderId);
  if (o) o.status = status as SalesOrder["status"];
  if (status === "delivered") {
    memSales.units.filter((u) => u.reserved_for_order_id === orderId)
      .forEach((u) => { u.status = "sold"; });
  }
}

// -----------------------------------------------------------------------------
// Khata
// -----------------------------------------------------------------------------
export async function addKhataEntry(input: {
  customer_id: number; order_id?: number | null; entry_date: string;
  amount: number; mode?: PaymentMode | null; reference?: string | null; notes?: string | null;
}): Promise<void> {
  const sql = getSql();
  if (sql) {
    await ensureSalesTables();
    await sql`INSERT INTO khata_entries (customer_id, order_id, entry_date, amount, mode, reference, notes)
              VALUES (${input.customer_id}, ${input.order_id ?? null}, ${input.entry_date},
                      ${input.amount}, ${input.mode ?? null}, ${input.reference ?? null},
                      ${input.notes ?? null})`;
    // Keep the order's outstanding balance in step with payments received.
    if (input.order_id && input.amount < 0) {
      await sql`UPDATE sales_orders SET balance_due = GREATEST(0, balance_due - ${Math.abs(input.amount)})
                WHERE id = ${input.order_id}`;
    }
    return;
  }

  memSales.khata.push({
    id: memSales.nextId.khata++, customer_id: input.customer_id,
    order_id: input.order_id ?? null, entry_date: input.entry_date,
    amount: input.amount, mode: input.mode ?? null,
    reference: input.reference ?? null, notes: input.notes ?? null,
  });
  if (input.order_id && input.amount < 0) {
    const o = memSales.orders.find((x) => x.id === input.order_id);
    if (o) o.balance_due = Math.max(0, round2(o.balance_due - Math.abs(input.amount)));
  }
}

export async function getKhataEntries(customerId?: number): Promise<KhataEntry[]> {
  const sql = getSql();
  if (sql) {
    await ensureSalesTables();
    const filter = customerId ?? null;
    const rows = (await sql`
      SELECT k.id, k.customer_id, c.name AS customer_name, k.order_id, o.order_number,
             TO_CHAR(k.entry_date,'YYYY-MM-DD') AS entry_date,
             k.amount::float AS amount, k.mode, k.reference, k.notes
      FROM khata_entries k
      JOIN customers c ON c.id = k.customer_id
      LEFT JOIN sales_orders o ON o.id = k.order_id
      WHERE (${filter}::int IS NULL OR k.customer_id = ${filter})
      ORDER BY k.entry_date, k.id`) as KhataEntry[];
    return customerId ? computeKhataBalance(rows) : rows;
  }

  const rows = memSales.khata
    .filter((k) => !customerId || k.customer_id === customerId)
    .map((k) => ({
      ...k,
      customer_name: memSales.customers.find((c) => c.id === k.customer_id)?.name,
      order_number: memSales.orders.find((o) => o.id === k.order_id)?.order_number ?? null,
    }));
  return customerId ? computeKhataBalance(rows) : rows;
}

export async function getKhataAccounts(): Promise<KhataAccount[]> {
  const [customers, entries] = await Promise.all([getCustomers(), getKhataEntries()]);
  return customers
    .map((c) => summariseKhata(c.id, c.name, c.phone, entries, today()))
    .filter((a) => a.entry_count > 0)
    .sort((a, b) => b.balance - a.balance);
}

// -----------------------------------------------------------------------------
// Turnover watchdog
// -----------------------------------------------------------------------------
export async function getOtherPanTurnover(): Promise<number> {
  const sql = getSql();
  if (!sql) return memSales.settings.other_pan_turnover;
  await ensureSalesTables();
  const rows = (await sql`SELECT other_pan_turnover::float AS v FROM shop_settings WHERE id = 1`) as
    { v: number }[];
  return rows[0]?.v ?? 0;
}

export async function setOtherPanTurnover(value: number): Promise<void> {
  const sql = getSql();
  if (sql) {
    await ensureSalesTables();
    await sql`UPDATE shop_settings SET other_pan_turnover = ${value} WHERE id = 1`;
    await logAudit("shop_settings", "1", "set_other_pan_turnover", { value });
    return;
  }
  memSales.settings.other_pan_turnover = value;
}

export async function getTurnoverStatus(): Promise<TurnoverStatus> {
  const [orders, otherPan, threshold, amber, red, blocking] = await Promise.all([
    getSalesOrders(), getOtherPanTurnover(),
    ruleValue("goods_registration_threshold", 4000000),
    ruleValue("turnover_amber", 3000000),
    ruleValue("turnover_red", 3500000),
    ruleValue("turnover_blocking", 3800000),
  ]);

  const fy = financialYearOf(today());
  const fyOrders = orders.filter(
    (o) => financialYearOf(o.order_date) === fy && o.status !== "cancelled" && o.status !== "quote"
  );
  const shopTurnover = round2(fyOrders.reduce((s, o) => s + Number(o.grand_total), 0));

  return computeTurnoverStatus({
    financial_year: fy,
    shop_turnover: shopTurnover,
    other_pan_turnover: otherPan,
    threshold, amber, red, blocking,
    months_elapsed: fyMonthsElapsed(today()),
  });
}

// -----------------------------------------------------------------------------
// Daily cash book
// -----------------------------------------------------------------------------
export async function getCashBook(days: number = 14): Promise<CashBookRow[]> {
  const entries = (await getKhataEntries()).filter((e) => e.amount < 0);
  const byDate = new Map<string, { cash: number; upi: number; other: number }>();

  for (const e of entries) {
    const row = byDate.get(e.entry_date) ?? { cash: 0, upi: 0, other: 0 };
    const amount = Math.abs(e.amount);
    if (e.mode === "cash") row.cash += amount;
    else if (e.mode === "upi") row.upi += amount;
    else row.other += amount;
    byDate.set(e.entry_date, row);
  }

  const dates = [...byDate.keys()].sort();
  let running = 0;
  const rows: CashBookRow[] = dates.map((d) => {
    const r = byDate.get(d)!;
    const totalIn = round2(r.cash + r.upi + r.other);
    const opening = running;
    running = round2(running + totalIn);
    return {
      date: d, opening, cash_in: round2(r.cash), upi_in: round2(r.upi),
      other_in: round2(r.other), total_in: totalIn, closing: running,
    };
  });

  return rows.slice(-days).reverse();
}

/** Units that are sellable right now, for the order screen. */
export async function getSellableUnits(): Promise<FinishedUnit[]> {
  return (await getFinishedUnits()).filter(isSellable);
}
