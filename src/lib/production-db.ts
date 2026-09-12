import { neon } from "@neondatabase/serverless";
import {
  Operation,
  Karigar,
  WorkOrder,
  WorkOrderOperation,
  StockReservation,
  MaterialRequirement,
  MaterialIssue,
  IssueLineInput,
  ProductionEntry,
  ProductionEntryInput,
  StageWip,
  KarigarWage,
  ConsumptionVarianceLine,
  AllocationResult,
} from "./production-types";
import { Material } from "./erp-types";
import {
  getMaterials,
  getAllBatches,
  consumeBatchQuantity,
  explodeBom,
  getBoms,
} from "./erp-db";
import {
  checkMaterialAvailability,
  allocateBatches,
  computeStageWip,
  computeKarigarWages,
  computeConsumptionVariance,
  requirementToStockQty,
} from "./production-logic";
import { financialYearOf, round2, round4 } from "./tax-regime";

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

function getSql() {
  return connectionString ? neon(connectionString) : null;
}

const CURRENT_ACTOR = "owner";

// -----------------------------------------------------------------------------
// Standard routing for a furniture unit, and the floor team.
// -----------------------------------------------------------------------------
const DEFAULT_OPERATIONS: Omit<Operation, "id">[] = [
  { code: "CUT", name: "Cutting", sequence: 1, standard_minutes: 45, piece_rate: 80, machine_required: true, is_active: true },
  { code: "FRAME", name: "Frame Assembly", sequence: 2, standard_minutes: 120, piece_rate: 220, machine_required: false, is_active: true },
  { code: "SAND", name: "Sanding", sequence: 3, standard_minutes: 60, piece_rate: 90, machine_required: true, is_active: true },
  { code: "FOAM", name: "Foaming", sequence: 4, standard_minutes: 75, piece_rate: 140, machine_required: false, is_active: true },
  { code: "UPH", name: "Upholstery", sequence: 5, standard_minutes: 180, piece_rate: 320, machine_required: false, is_active: true },
  { code: "POL", name: "Polish", sequence: 6, standard_minutes: 90, piece_rate: 150, machine_required: false, is_active: true },
  { code: "HW", name: "Hardware Fitting", sequence: 7, standard_minutes: 30, piece_rate: 60, machine_required: false, is_active: true },
  { code: "QC", name: "Quality Check", sequence: 8, standard_minutes: 20, piece_rate: 0, machine_required: false, is_active: true },
  { code: "PACK", name: "Packing", sequence: 9, standard_minutes: 25, piece_rate: 50, machine_required: false, is_active: true },
];

const DEFAULT_KARIGARS: Omit<Karigar, "id">[] = [
  { code: "K-01", name: "Sujit Das", skill: "FRAME", phone: "9830011111", daily_wage: 650, is_piece_rate: true, is_active: true },
  { code: "K-02", name: "Ratan Mondal", skill: "UPH", phone: "9830022222", daily_wage: 700, is_piece_rate: true, is_active: true },
  { code: "K-03", name: "Bapi Sardar", skill: "POL", phone: "9830033333", daily_wage: 600, is_piece_rate: true, is_active: true },
  { code: "K-04", name: "Nemai Ghosh", skill: "CUT", phone: "9830044444", daily_wage: 620, is_piece_rate: true, is_active: true },
  { code: "K-05", name: "Swapan Roy", skill: "FOAM", phone: "9830055555", daily_wage: 580, is_piece_rate: true, is_active: true },
];

const memProd = {
  operations: DEFAULT_OPERATIONS.map((o, i) => ({ ...o, id: i + 1 })) as Operation[],
  karigars: DEFAULT_KARIGARS.map((k, i) => ({ ...k, id: i + 1 })) as Karigar[],
  workOrders: [] as WorkOrder[],
  woOperations: [] as WorkOrderOperation[],
  reservations: [] as StockReservation[],
  issues: [] as MaterialIssue[],
  issueLines: [] as Record<string, unknown>[],
  entries: [] as ProductionEntry[],
  nextId: { wo: 1, woOp: 1, reservation: 1, issue: 1, issueLine: 1, entry: 1 },
  nextWoSeq: 1,
  nextIssueSeq: 1,
};

let prodTablesReady = false;

export async function ensureProductionTables(): Promise<void> {
  const sql = getSql();
  if (!sql || prodTablesReady) return;

  try {
    await sql`CREATE TABLE IF NOT EXISTS operations (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(80) NOT NULL,
      sequence INT NOT NULL,
      standard_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
      piece_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
      machine_required BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE)`;

    await sql`CREATE TABLE IF NOT EXISTS karigars (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL,
      skill VARCHAR(20),
      phone VARCHAR(20),
      daily_wage NUMERIC(12,2) NOT NULL DEFAULT 0,
      is_piece_rate BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE)`;

    await sql`CREATE TABLE IF NOT EXISTS work_orders (
      id SERIAL PRIMARY KEY,
      wo_number VARCHAR(40) UNIQUE NOT NULL,
      product_id INT NOT NULL REFERENCES products(id),
      quantity NUMERIC(16,3) NOT NULL CHECK (quantity > 0),
      source VARCHAR(20) NOT NULL DEFAULT 'forecast',
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE,
      bom_id INT REFERENCES boms(id),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS work_order_operations (
      id SERIAL PRIMARY KEY,
      work_order_id INT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      operation_id INT NOT NULL REFERENCES operations(id),
      sequence INT NOT NULL,
      piece_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
      standard_minutes NUMERIC(10,2) NOT NULL DEFAULT 0)`;

    await sql`CREATE TABLE IF NOT EXISTS stock_reservations (
      id SERIAL PRIMARY KEY,
      work_order_id INT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      material_id INT NOT NULL REFERENCES materials(id),
      quantity NUMERIC(16,4) NOT NULL,
      issued_quantity NUMERIC(16,4) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'reserved')`;

    await sql`CREATE TABLE IF NOT EXISTS material_issues (
      id SERIAL PRIMARY KEY,
      issue_number VARCHAR(40) UNIQUE NOT NULL,
      work_order_id INT NOT NULL REFERENCES work_orders(id),
      issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
      issued_to VARCHAR(120),
      notes TEXT,
      total_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS material_issue_lines (
      id SERIAL PRIMARY KEY,
      issue_id INT NOT NULL REFERENCES material_issues(id) ON DELETE CASCADE,
      material_id INT NOT NULL REFERENCES materials(id),
      batch_id INT REFERENCES material_batches(id),
      batch_no VARCHAR(60),
      dye_lot VARCHAR(60),
      quantity NUMERIC(16,4) NOT NULL,
      rate NUMERIC(14,4) NOT NULL DEFAULT 0,
      value NUMERIC(14,2) NOT NULL DEFAULT 0)`;

    await sql`CREATE TABLE IF NOT EXISTS production_entries (
      id SERIAL PRIMARY KEY,
      work_order_id INT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      operation_id INT NOT NULL REFERENCES operations(id),
      karigar_id INT REFERENCES karigars(id),
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      shift VARCHAR(20) NOT NULL DEFAULT 'day',
      completed_quantity NUMERIC(16,3) NOT NULL DEFAULT 0,
      rework_quantity NUMERIC(16,3) NOT NULL DEFAULT 0,
      rejected_quantity NUMERIC(16,3) NOT NULL DEFAULT 0,
      rejection_reason TEXT,
      hours_worked NUMERIC(8,2),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE INDEX IF NOT EXISTS idx_prod_entries_wo ON production_entries(work_order_id, entry_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_material ON stock_reservations(material_id, status)`;

    for (const op of DEFAULT_OPERATIONS) {
      await sql`INSERT INTO operations (code, name, sequence, standard_minutes, piece_rate, machine_required)
                VALUES (${op.code}, ${op.name}, ${op.sequence}, ${op.standard_minutes},
                        ${op.piece_rate}, ${op.machine_required})
                ON CONFLICT (code) DO NOTHING`;
    }
    for (const k of DEFAULT_KARIGARS) {
      await sql`INSERT INTO karigars (code, name, skill, phone, daily_wage, is_piece_rate)
                VALUES (${k.code}, ${k.name}, ${k.skill}, ${k.phone}, ${k.daily_wage}, ${k.is_piece_rate})
                ON CONFLICT (code) DO NOTHING`;
    }

    prodTablesReady = true;
  } catch (error) {
    console.error("Error initializing production schema:", error);
  }
}

async function logAudit(entity: string, entityId: string, action: string, details: Record<string, unknown>) {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`INSERT INTO audit_log (entity, entity_id, action, actor, details)
              VALUES (${entity}, ${entityId}, ${action}, ${CURRENT_ACTOR}, ${JSON.stringify(details)}::jsonb)`;
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

// -----------------------------------------------------------------------------
// Masters
// -----------------------------------------------------------------------------
export async function getOperations(): Promise<Operation[]> {
  const sql = getSql();
  if (!sql) return [...memProd.operations];
  await ensureProductionTables();
  return (await sql`SELECT id, code, name, sequence, standard_minutes::float AS standard_minutes,
                           piece_rate::float AS piece_rate, machine_required, is_active
                    FROM operations WHERE is_active = TRUE ORDER BY sequence`) as Operation[];
}

export async function getKarigars(): Promise<Karigar[]> {
  const sql = getSql();
  if (!sql) return [...memProd.karigars];
  await ensureProductionTables();
  return (await sql`SELECT id, code, name, skill, phone, daily_wage::float AS daily_wage,
                           is_piece_rate, is_active
                    FROM karigars WHERE is_active = TRUE ORDER BY name`) as Karigar[];
}

async function getReservations(): Promise<StockReservation[]> {
  const sql = getSql();
  if (!sql) return [...memProd.reservations];
  await ensureProductionTables();
  return (await sql`SELECT id, work_order_id, material_id, quantity::float AS quantity,
                           issued_quantity::float AS issued_quantity, status
                    FROM stock_reservations WHERE status = 'reserved'`) as StockReservation[];
}

// -----------------------------------------------------------------------------
// Availability check — run before releasing a work order
// -----------------------------------------------------------------------------
export async function checkAvailability(
  productId: number,
  quantity: number,
  excludeWorkOrderId?: number
): Promise<MaterialRequirement[]> {
  const [requirements, materials, batches, reservations] = await Promise.all([
    explodeBom(productId, quantity),
    getMaterials(),
    getAllBatches(),
    getReservations(),
  ]);

  const materialsById = new Map<number, Material>(materials.map((m) => [m.id, m]));
  return checkMaterialAvailability(
    requirements, materialsById, batches, reservations, excludeWorkOrderId
  );
}

// -----------------------------------------------------------------------------
// Work orders
// -----------------------------------------------------------------------------
async function nextWoNumber(date: string): Promise<string> {
  const shortFy = financialYearOf(date).replace("20", "");
  const sql = getSql();
  if (sql) {
    const rows = (await sql`SELECT COUNT(*)::int AS n FROM work_orders
                            WHERE wo_number LIKE ${"WO/" + shortFy + "/%"}`) as { n: number }[];
    return `WO/${shortFy}/${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
  }
  return `WO/${shortFy}/${String(memProd.nextWoSeq++).padStart(4, "0")}`;
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const sql = getSql();
  if (sql) {
    await ensureProductionTables();
    const rows = (await sql`
      SELECT w.id, w.wo_number, w.product_id, p.name AS product_name, p.code AS product_code,
             w.quantity::float AS quantity, w.source, w.status,
             TO_CHAR(w.order_date,'YYYY-MM-DD') AS order_date,
             TO_CHAR(w.due_date,'YYYY-MM-DD') AS due_date, w.bom_id, w.notes,
             COALESCE((SELECT SUM(completed_quantity) FROM production_entries pe
                       JOIN operations o ON o.id = pe.operation_id
                       WHERE pe.work_order_id = w.id
                         AND o.sequence = (SELECT MAX(sequence) FROM operations WHERE is_active)), 0)::float
               AS completed_quantity
      FROM work_orders w JOIN products p ON p.id = w.product_id
      ORDER BY w.order_date DESC, w.id DESC`) as WorkOrder[];
    return rows;
  }

  const lastSeq = Math.max(...memProd.operations.map((o) => o.sequence));
  const lastOp = memProd.operations.find((o) => o.sequence === lastSeq);
  return memProd.workOrders.map((w) => ({
    ...w,
    completed_quantity: round4(
      memProd.entries
        .filter((e) => e.work_order_id === w.id && e.operation_id === lastOp?.id)
        .reduce((s, e) => s + e.completed_quantity, 0)
    ),
  }));
}

export async function createWorkOrder(input: {
  product_id: number;
  quantity: number;
  source: "sales_order" | "forecast";
  order_date: string;
  due_date?: string | null;
  notes?: string | null;
}): Promise<{ workOrder: WorkOrder; requirements: MaterialRequirement[] }> {
  const sql = getSql();
  if (sql) await ensureProductionTables();

  const woNumber = await nextWoNumber(input.order_date);
  const [operations, boms, requirements] = await Promise.all([
    getOperations(),
    getBoms(),
    checkAvailability(input.product_id, input.quantity),
  ]);

  // Freeze the BOM version in force now, so a later recipe change cannot
  // retrospectively alter what this order was supposed to consume.
  const activeBom = boms.find((b) => b.product_id === input.product_id && b.status === "active");

  const workOrder: WorkOrder = {
    id: 0,
    wo_number: woNumber,
    product_id: input.product_id,
    quantity: input.quantity,
    source: input.source,
    status: "released",
    order_date: input.order_date,
    due_date: input.due_date ?? null,
    bom_id: activeBom?.id ?? null,
    notes: input.notes ?? null,
  };

  if (sql) {
    const rows = (await sql`
      INSERT INTO work_orders (wo_number, product_id, quantity, source, status, order_date, due_date, bom_id, notes)
      VALUES (${woNumber}, ${input.product_id}, ${input.quantity}, ${input.source}, 'released',
              ${input.order_date}, ${input.due_date ?? null}, ${activeBom?.id ?? null}, ${input.notes ?? null})
      RETURNING id`) as { id: number }[];
    workOrder.id = rows[0].id;

    for (const op of operations) {
      await sql`INSERT INTO work_order_operations (work_order_id, operation_id, sequence, piece_rate, standard_minutes)
                VALUES (${workOrder.id}, ${op.id}, ${op.sequence}, ${op.piece_rate}, ${op.standard_minutes})`;
    }
    // Reserve what is required so a second work order cannot be promised the same stock.
    for (const req of requirements) {
      await sql`INSERT INTO stock_reservations (work_order_id, material_id, quantity)
                VALUES (${workOrder.id}, ${req.material_id}, ${req.required_qty})`;
    }
  } else {
    workOrder.id = memProd.nextId.wo++;
    memProd.workOrders.push(workOrder);
    for (const op of operations) {
      memProd.woOperations.push({
        id: memProd.nextId.woOp++, work_order_id: workOrder.id, operation_id: op.id,
        sequence: op.sequence, piece_rate: op.piece_rate, standard_minutes: op.standard_minutes,
        completed_quantity: 0, rejected_quantity: 0, rework_quantity: 0,
      });
    }
    for (const req of requirements) {
      memProd.reservations.push({
        id: memProd.nextId.reservation++, work_order_id: workOrder.id,
        material_id: req.material_id, quantity: req.required_qty,
        issued_quantity: 0, status: "reserved",
      });
    }
  }

  await logAudit("work_order", String(workOrder.id), "create", {
    wo_number: woNumber, product_id: input.product_id, quantity: input.quantity,
    shortages: requirements.filter((r) => r.shortfall > 0).length,
  });

  return { workOrder, requirements };
}

export async function getWorkOrderOperations(woId: number): Promise<WorkOrderOperation[]> {
  const sql = getSql();
  if (sql) {
    await ensureProductionTables();
    return (await sql`
      SELECT wo.id, wo.work_order_id, wo.operation_id, o.code AS operation_code,
             o.name AS operation_name, wo.sequence, wo.piece_rate::float AS piece_rate,
             wo.standard_minutes::float AS standard_minutes,
             COALESCE((SELECT SUM(completed_quantity) FROM production_entries
                       WHERE work_order_id = wo.work_order_id AND operation_id = wo.operation_id), 0)::float
               AS completed_quantity,
             COALESCE((SELECT SUM(rejected_quantity) FROM production_entries
                       WHERE work_order_id = wo.work_order_id AND operation_id = wo.operation_id), 0)::float
               AS rejected_quantity,
             COALESCE((SELECT SUM(rework_quantity) FROM production_entries
                       WHERE work_order_id = wo.work_order_id AND operation_id = wo.operation_id), 0)::float
               AS rework_quantity
      FROM work_order_operations wo JOIN operations o ON o.id = wo.operation_id
      WHERE wo.work_order_id = ${woId} ORDER BY wo.sequence`) as WorkOrderOperation[];
  }

  return memProd.woOperations
    .filter((w) => w.work_order_id === woId)
    .map((w) => {
      const op = memProd.operations.find((o) => o.id === w.operation_id);
      const entries = memProd.entries.filter(
        (e) => e.work_order_id === woId && e.operation_id === w.operation_id
      );
      return {
        ...w,
        operation_code: op?.code,
        operation_name: op?.name,
        completed_quantity: round4(entries.reduce((s, e) => s + e.completed_quantity, 0)),
        rejected_quantity: round4(entries.reduce((s, e) => s + e.rejected_quantity, 0)),
        rework_quantity: round4(entries.reduce((s, e) => s + e.rework_quantity, 0)),
      };
    })
    .sort((a, b) => a.sequence - b.sequence);
}

// -----------------------------------------------------------------------------
// Material issue
// -----------------------------------------------------------------------------
export async function previewIssue(
  woId: number,
  lines: IssueLineInput[]
): Promise<{ material: Material; result: AllocationResult }[]> {
  const [materials, batches] = await Promise.all([getMaterials(), getAllBatches()]);
  const today = new Date().toISOString().slice(0, 10);

  return lines
    .filter((l) => l.quantity > 0)
    .map((line) => {
      const material = materials.find((m) => m.id === line.material_id)!;
      return { material, result: allocateBatches(material, batches, line.quantity, today) };
    });
}

export async function issueMaterials(input: {
  work_order_id: number;
  issue_date: string;
  issued_to?: string | null;
  notes?: string | null;
  lines: IssueLineInput[];
}): Promise<{ issue: MaterialIssue; warnings: string[] }> {
  const sql = getSql();
  if (sql) await ensureProductionTables();

  const [materials, batches] = await Promise.all([getMaterials(), getAllBatches()]);
  const shortFy = financialYearOf(input.issue_date).replace("20", "");

  let issueNumber: string;
  if (sql) {
    const rows = (await sql`SELECT COUNT(*)::int AS n FROM material_issues
                            WHERE issue_number LIKE ${"MI/" + shortFy + "/%"}`) as { n: number }[];
    issueNumber = `MI/${shortFy}/${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
  } else {
    issueNumber = `MI/${shortFy}/${String(memProd.nextIssueSeq++).padStart(4, "0")}`;
  }

  const warnings: string[] = [];
  const allocationsToApply: {
    material_id: number; batch_id: number; batch_no: string; dye_lot: string | null;
    quantity: number; rate: number; value: number;
  }[] = [];

  for (const line of input.lines.filter((l) => l.quantity > 0)) {
    const material = materials.find((m) => m.id === line.material_id);
    if (!material) continue;

    const result = allocateBatches(material, batches, line.quantity, input.issue_date);
    warnings.push(...result.warnings.map((w) => `${material.name}: ${w}`));

    if (result.shortfall > 0) {
      warnings.push(
        `${material.name}: short by ${result.shortfall} ${material.stock_uom} — issued what was available`
      );
    }

    for (const alloc of result.allocations) {
      allocationsToApply.push({ material_id: material.id, ...alloc });
      // Keep the in-memory view consistent so a second line in the same issue
      // does not allocate stock that this line has already taken.
      const b = batches.find((x) => x.id === alloc.batch_id);
      if (b) b.quantity = round4(Number(b.quantity) - alloc.quantity);
    }
  }

  const totalValue = round2(allocationsToApply.reduce((s, a) => s + a.value, 0));

  const issue: MaterialIssue = {
    id: 0,
    issue_number: issueNumber,
    work_order_id: input.work_order_id,
    issue_date: input.issue_date,
    issued_to: input.issued_to ?? null,
    notes: input.notes ?? null,
    total_value: totalValue,
    line_count: allocationsToApply.length,
  };

  if (sql) {
    const rows = (await sql`
      INSERT INTO material_issues (issue_number, work_order_id, issue_date, issued_to, notes, total_value)
      VALUES (${issueNumber}, ${input.work_order_id}, ${input.issue_date},
              ${input.issued_to ?? null}, ${input.notes ?? null}, ${totalValue})
      RETURNING id`) as { id: number }[];
    issue.id = rows[0].id;
  } else {
    issue.id = memProd.nextId.issue++;
    memProd.issues.push(issue);
  }

  for (const alloc of allocationsToApply) {
    await consumeBatchQuantity(alloc.batch_id, alloc.quantity);

    if (sql) {
      await sql`INSERT INTO material_issue_lines (issue_id, material_id, batch_id, batch_no, dye_lot, quantity, rate, value)
                VALUES (${issue.id}, ${alloc.material_id}, ${alloc.batch_id}, ${alloc.batch_no},
                        ${alloc.dye_lot}, ${alloc.quantity}, ${alloc.rate}, ${alloc.value})`;
      await sql`UPDATE stock_reservations
                SET issued_quantity = issued_quantity + ${alloc.quantity}
                WHERE work_order_id = ${input.work_order_id} AND material_id = ${alloc.material_id}`;
    } else {
      memProd.issueLines.push({
        id: memProd.nextId.issueLine++, issue_id: issue.id, work_order_id: input.work_order_id,
        material_id: alloc.material_id, batch_id: alloc.batch_id, batch_no: alloc.batch_no,
        dye_lot: alloc.dye_lot, quantity: alloc.quantity, rate: alloc.rate, value: alloc.value,
      });
      const res = memProd.reservations.find(
        (r) => r.work_order_id === input.work_order_id && r.material_id === alloc.material_id
      );
      if (res) res.issued_quantity = round4(res.issued_quantity + alloc.quantity);
    }
  }

  // First issue moves the order onto the floor.
  await setWorkOrderStatus(input.work_order_id, "in_progress");

  await logAudit("material_issue", String(issue.id), "issue", {
    issue_number: issueNumber, work_order_id: input.work_order_id, value: totalValue,
  });

  return { issue, warnings };
}

async function setWorkOrderStatus(woId: number, status: WorkOrder["status"]): Promise<void> {
  const sql = getSql();
  if (sql) {
    await sql`UPDATE work_orders SET status = ${status}, updated_at = NOW()
              WHERE id = ${woId} AND status IN ('released','in_progress')`;
    return;
  }
  const wo = memProd.workOrders.find((w) => w.id === woId);
  if (wo && (wo.status === "released" || wo.status === "in_progress")) wo.status = status;
}

export async function getIssuesForWorkOrder(woId: number): Promise<MaterialIssue[]> {
  const sql = getSql();
  if (sql) {
    await ensureProductionTables();
    return (await sql`
      SELECT id, issue_number, work_order_id, TO_CHAR(issue_date,'YYYY-MM-DD') AS issue_date,
             issued_to, notes, total_value::float AS total_value,
             (SELECT COUNT(*) FROM material_issue_lines WHERE issue_id = material_issues.id) AS line_count
      FROM material_issues WHERE work_order_id = ${woId} ORDER BY issue_date DESC`) as MaterialIssue[];
  }
  return memProd.issues.filter((i) => i.work_order_id === woId);
}

// -----------------------------------------------------------------------------
// Production entries
// -----------------------------------------------------------------------------
export async function recordProductionEntry(input: ProductionEntryInput): Promise<void> {
  const sql = getSql();
  if (sql) {
    await ensureProductionTables();
    await sql`
      INSERT INTO production_entries (work_order_id, operation_id, karigar_id, entry_date, shift,
        completed_quantity, rework_quantity, rejected_quantity, rejection_reason, hours_worked, notes)
      VALUES (${input.work_order_id}, ${input.operation_id}, ${input.karigar_id}, ${input.entry_date},
        ${input.shift}, ${input.completed_quantity}, ${input.rework_quantity},
        ${input.rejected_quantity}, ${input.rejection_reason ?? null},
        ${input.hours_worked ?? null}, ${input.notes ?? null})`;
  } else {
    memProd.entries.push({ ...input, id: memProd.nextId.entry++ });
  }

  await setWorkOrderStatus(input.work_order_id, "in_progress");
  await logAudit("production_entry", String(input.work_order_id), "record", {
    operation_id: input.operation_id, completed: input.completed_quantity,
    rejected: input.rejected_quantity,
  });
}

export async function getProductionEntries(woId?: number): Promise<ProductionEntry[]> {
  const sql = getSql();
  if (sql) {
    await ensureProductionTables();
    const filter = woId ?? null;
    return (await sql`
      SELECT e.id, e.work_order_id, w.wo_number, e.operation_id, o.code AS operation_code,
             o.name AS operation_name, o.sequence, o.piece_rate::float AS piece_rate,
             e.karigar_id, k.name AS karigar_name,
             TO_CHAR(e.entry_date,'YYYY-MM-DD') AS entry_date, e.shift,
             e.completed_quantity::float AS completed_quantity,
             e.rework_quantity::float AS rework_quantity,
             e.rejected_quantity::float AS rejected_quantity,
             e.rejection_reason, e.hours_worked::float AS hours_worked, e.notes,
             (e.completed_quantity * o.piece_rate)::float AS piece_wage
      FROM production_entries e
      JOIN work_orders w ON w.id = e.work_order_id
      JOIN operations o ON o.id = e.operation_id
      LEFT JOIN karigars k ON k.id = e.karigar_id
      WHERE (${filter}::int IS NULL OR e.work_order_id = ${filter})
      ORDER BY e.entry_date DESC, e.id DESC`) as ProductionEntry[];
  }

  return memProd.entries
    .filter((e) => !woId || e.work_order_id === woId)
    .map((e) => {
      const op = memProd.operations.find((o) => o.id === e.operation_id);
      const k = memProd.karigars.find((x) => x.id === e.karigar_id);
      const wo = memProd.workOrders.find((w) => w.id === e.work_order_id);
      return {
        ...e,
        wo_number: wo?.wo_number,
        operation_code: op?.code,
        operation_name: op?.name,
        sequence: op?.sequence,
        piece_rate: op?.piece_rate,
        karigar_name: k?.name,
        piece_wage: round2(e.completed_quantity * (op?.piece_rate ?? 0)),
      };
    })
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id);
}

export async function getStageWip(woId: number): Promise<StageWip[]> {
  const [operations, entries, workOrders] = await Promise.all([
    getOperations(),
    getProductionEntries(woId),
    getWorkOrders(),
  ]);
  const wo = workOrders.find((w) => w.id === woId);
  const today = new Date().toISOString().slice(0, 10);
  return computeStageWip(operations, entries, wo?.quantity ?? 0, today);
}

export async function getKarigarWages(from?: string, to?: string): Promise<KarigarWage[]> {
  const [operations, karigars, allEntries] = await Promise.all([
    getOperations(), getKarigars(), getProductionEntries(),
  ]);

  const entries = allEntries.filter(
    (e) => (!from || e.entry_date >= from) && (!to || e.entry_date <= to)
  );

  return computeKarigarWages(
    entries,
    new Map(operations.map((o) => [o.id, o])),
    new Map(karigars.map((k) => [k.id, k.name]))
  );
}

/** Standard consumption from the BOM against what was actually issued. */
export async function getConsumptionVariance(woId: number): Promise<ConsumptionVarianceLine[]> {
  const workOrders = await getWorkOrders();
  const wo = workOrders.find((w) => w.id === woId);
  if (!wo) return [];

  const [requirements, materials] = await Promise.all([
    explodeBom(wo.product_id, wo.quantity),
    getMaterials(),
  ]);

  const standard = requirements.map((r) => {
    const m = materials.find((x) => x.id === r.material_id);
    return {
      material_id: r.material_id,
      code: r.code,
      name: r.name,
      qty: m ? round4(requirementToStockQty(m, r.gross_quantity, r.uom)) : r.gross_quantity,
      uom: m?.stock_uom ?? r.uom,
      rate: m?.standard_rate ?? 0,
    };
  });

  const actual = new Map<number, number>();
  const sql = getSql();

  if (sql) {
    const rows = (await sql`
      SELECT l.material_id, SUM(l.quantity)::float AS qty
      FROM material_issue_lines l
      JOIN material_issues i ON i.id = l.issue_id
      WHERE i.work_order_id = ${woId}
      GROUP BY l.material_id`) as { material_id: number; qty: number }[];
    for (const r of rows) actual.set(Number(r.material_id), Number(r.qty));
  } else {
    for (const l of memProd.issueLines) {
      if (l.work_order_id !== woId) continue;
      const id = l.material_id as number;
      actual.set(id, round4((actual.get(id) ?? 0) + (l.quantity as number)));
    }
  }

  return computeConsumptionVariance(standard, actual);
}
