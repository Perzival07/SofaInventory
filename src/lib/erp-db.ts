import { neon } from "@neondatabase/serverless";
import {
  Material,
  MaterialBatch,
  MaterialCategory,
  MaterialInput,
  BatchInput,
  MaterialType,
  Product,
  Bom,
  BomLine,
  BomInput,
  ExplodedRequirement,
  Uom,
} from "./erp-types";

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

export const isErpDbConfigured = Boolean(connectionString);

function getSql() {
  return connectionString ? neon(connectionString) : null;
}

import { currentActor } from "./actor";

// -----------------------------------------------------------------------------
// In-memory demo store (used when POSTGRES_URL is absent)
// -----------------------------------------------------------------------------
const mem = {
  categories: [
    { id: 1, name: "Timber", material_type: "timber" },
    { id: 2, name: "Plywood & Boards", material_type: "panel" },
    { id: 3, name: "Veneer & Laminate", material_type: "veneer_laminate" },
    { id: 4, name: "Foam", material_type: "foam" },
    { id: 5, name: "Fabric & Leather", material_type: "fabric_leather" },
    { id: 6, name: "Hardware", material_type: "hardware" },
    { id: 7, name: "Adhesives & Polish", material_type: "adhesive_chemical" },
    { id: 8, name: "Packing Material", material_type: "packing" },
  ] as MaterialCategory[],

  uoms: [
    { id: 1, code: "CFT", name: "Cubic Feet", dimension: "volume" },
    { id: 2, code: "RFT", name: "Running Feet", dimension: "length" },
    { id: 3, code: "SQFT", name: "Square Feet", dimension: "area" },
    { id: 4, code: "SHEET", name: "Sheet", dimension: "count" },
    { id: 5, code: "MTR", name: "Meter", dimension: "length" },
    { id: 6, code: "ROLL", name: "Roll", dimension: "count" },
    { id: 7, code: "KG", name: "Kilogram", dimension: "weight" },
    { id: 8, code: "LTR", name: "Litre", dimension: "liquid" },
    { id: 9, code: "NOS", name: "Numbers", dimension: "count" },
    { id: 10, code: "PCS", name: "Pieces", dimension: "count" },
    { id: 11, code: "SET", name: "Set", dimension: "count" },
  ] as Uom[],

  materials: [
    {
      id: 1, code: "TMB-SHS-01", name: "Sheesham Timber - Seasoned", category_id: 1,
      material_type: "timber" as MaterialType,
      purchase_uom: "CFT", stock_uom: "CFT", consumption_uom: "RFT",
      purchase_to_stock_factor: 1, stock_to_consumption_factor: 12,
      tracks_batch: true, tracks_dye_lot: false, shelf_life_days: null, is_hazardous: false,
      reorder_level: 50, standard_rate: 2200, hsn_code: "4407",
      is_offcut: false, parent_material_id: null,
      attributes: { species: "Sheesham", grade: "A", moisture_pct: 11, seasoning: "Kiln dried" },
      is_active: true,
    },
    {
      id: 2, code: "PLY-BWR-18", name: "Plywood 18mm BWR Grade", category_id: 2,
      material_type: "panel" as MaterialType,
      purchase_uom: "SHEET", stock_uom: "SHEET", consumption_uom: "SQFT",
      purchase_to_stock_factor: 1, stock_to_consumption_factor: 32,
      tracks_batch: true, tracks_dye_lot: false, shelf_life_days: null, is_hazardous: false,
      reorder_level: 20, standard_rate: 2850, hsn_code: "4412",
      is_offcut: false, parent_material_id: null,
      attributes: { thickness_mm: 18, grade: "BWR", sheet_size: "8x4 ft" },
      is_active: true,
    },
    {
      id: 3, code: "FOM-40D-04", name: "PU Foam 40 Density 4 inch", category_id: 4,
      material_type: "foam" as MaterialType,
      purchase_uom: "SHEET", stock_uom: "SHEET", consumption_uom: "PCS",
      purchase_to_stock_factor: 1, stock_to_consumption_factor: 12,
      tracks_batch: true, tracks_dye_lot: false, shelf_life_days: null, is_hazardous: false,
      reorder_level: 15, standard_rate: 4200, hsn_code: "3921",
      is_offcut: false, parent_material_id: null,
      attributes: { density: 40, thickness_mm: 102, ild: 32 },
      is_active: true,
    },
    {
      id: 4, code: "FAB-VLV-NVY", name: "Velvet Upholstery Fabric - Royal Navy", category_id: 5,
      material_type: "fabric_leather" as MaterialType,
      purchase_uom: "ROLL", stock_uom: "MTR", consumption_uom: "MTR",
      purchase_to_stock_factor: 30, stock_to_consumption_factor: 1,
      tracks_batch: true, tracks_dye_lot: true, shelf_life_days: null, is_hazardous: false,
      reorder_level: 60, standard_rate: 480, hsn_code: "5801",
      is_offcut: false, parent_material_id: null,
      attributes: { width_inch: 54, gsm: 320, shade: "Royal Navy", composition: "Poly Velvet" },
      is_active: true,
    },
    {
      id: 5, code: "HW-CAST-50", name: "Castor Wheel 50mm - Black Nylon", category_id: 6,
      material_type: "hardware" as MaterialType,
      purchase_uom: "NOS", stock_uom: "NOS", consumption_uom: "NOS",
      purchase_to_stock_factor: 1, stock_to_consumption_factor: 1,
      tracks_batch: false, tracks_dye_lot: false, shelf_life_days: null, is_hazardous: false,
      reorder_level: 200, standard_rate: 38, hsn_code: "8302",
      is_offcut: false, parent_material_id: null,
      attributes: { size: "50mm", finish: "Black", brand: "Ebco" },
      is_active: true,
    },
    {
      id: 6, code: "ADH-SR998", name: "Rubber Adhesive SR-998", category_id: 7,
      material_type: "adhesive_chemical" as MaterialType,
      purchase_uom: "KG", stock_uom: "KG", consumption_uom: "KG",
      purchase_to_stock_factor: 1, stock_to_consumption_factor: 1,
      tracks_batch: true, tracks_dye_lot: false, shelf_life_days: 365, is_hazardous: true,
      reorder_level: 25, standard_rate: 310, hsn_code: "3506",
      is_offcut: false, parent_material_id: null,
      attributes: { brand: "Pidilite", type: "Synthetic Rubber", coverage: "3.5 sqm/kg" },
      is_active: true,
    },
    {
      id: 7, code: "HW-ZIP-24", name: "Upholstery Zipper 24 inch", category_id: 6,
      material_type: "hardware" as MaterialType,
      purchase_uom: "NOS", stock_uom: "NOS", consumption_uom: "NOS",
      purchase_to_stock_factor: 1, stock_to_consumption_factor: 1,
      tracks_batch: false, tracks_dye_lot: false, shelf_life_days: null, is_hazardous: false,
      reorder_level: 150, standard_rate: 22, hsn_code: "9607",
      is_offcut: false, parent_material_id: null,
      attributes: { size: '24"', finish: "Black", brand: "YKK" },
      is_active: true,
    },
    {
      id: 8, code: "TMB-SHS-01-OC", name: "Sheesham Offcut - Usable Remnant", category_id: 1,
      material_type: "timber" as MaterialType,
      purchase_uom: "RFT", stock_uom: "RFT", consumption_uom: "RFT",
      purchase_to_stock_factor: 1, stock_to_consumption_factor: 1,
      tracks_batch: false, tracks_dye_lot: false, shelf_life_days: null, is_hazardous: false,
      reorder_level: 0, standard_rate: 900, hsn_code: "4407",
      is_offcut: true, parent_material_id: 1,
      attributes: { species: "Sheesham", grade: "B" },
      is_active: true,
    },
  ] as Material[],

  // Rates are GST-inclusive because the shop is currently unregistered; the tax
  // amount is still captured so transitional credit can be claimed on registration.
  batches: [
    { id: 1, material_id: 1, batch_no: "TMB-2026-08", dye_lot: null, quantity: 68, rate: 2180,
      received_date: "2026-08-14", expiry_date: null, moisture_pct: 10.5,
      seasoning_date: "2026-07-02", kiln_batch: "KLN-114", location: "Yard A", notes: null,
      supplier_name: "Barasat Timber Mart", supplier_invoice_no: "BTM/1142",
      supplier_invoice_date: "2026-08-14", supplier_gstin: "19AABCT1234K1Z9",
      tax_rate: 18, cost_basis: "inclusive", regime_at_receipt: false },
    { id: 2, material_id: 1, batch_no: "TMB-2026-09", dye_lot: null, quantity: 41, rate: 2240,
      received_date: "2026-09-05", expiry_date: null, moisture_pct: 12.2,
      seasoning_date: "2026-08-10", kiln_batch: "KLN-121", location: "Yard A", notes: null,
      supplier_name: "Barasat Timber Mart", supplier_invoice_no: "BTM/1208",
      supplier_invoice_date: "2026-09-05", supplier_gstin: "19AABCT1234K1Z9",
      tax_rate: 18, cost_basis: "inclusive", regime_at_receipt: false },
    { id: 3, material_id: 2, batch_no: "PLY-4471", dye_lot: null, quantity: 34, rate: 2850,
      received_date: "2026-08-28", expiry_date: null, moisture_pct: null,
      seasoning_date: null, kiln_batch: null, location: "Rack B2", notes: null,
      supplier_name: "Madhyamgram Ply House", supplier_invoice_no: "MPH/882",
      supplier_invoice_date: "2026-08-28", supplier_gstin: "19AACFM5678L1ZP",
      tax_rate: 18, cost_basis: "inclusive", regime_at_receipt: false },
    { id: 4, material_id: 3, batch_no: "FOM-8823", dye_lot: null, quantity: 22, rate: 4200,
      received_date: "2026-09-01", expiry_date: null, moisture_pct: null,
      seasoning_date: null, kiln_batch: null, location: "Foam Loft", notes: null,
      supplier_name: "Sleepwell Distributors", supplier_invoice_no: "SD/2291",
      supplier_invoice_date: "2026-09-01", supplier_gstin: "19AADCS9012M1ZQ",
      tax_rate: 18, cost_basis: "inclusive", regime_at_receipt: false },
    { id: 5, material_id: 4, batch_no: "FAB-NVY-A", dye_lot: "LOT-2411-A", quantity: 46, rate: 470,
      received_date: "2026-08-20", expiry_date: null, moisture_pct: null,
      seasoning_date: null, kiln_batch: null, location: "Fabric Rack 1",
      notes: "Slightly deeper shade than LOT-2503-B",
      supplier_name: "Burrabazar Furnishings", supplier_invoice_no: "BF/5510",
      supplier_invoice_date: "2026-08-20", supplier_gstin: "19AAEFB3456N1ZR",
      tax_rate: 5, cost_basis: "inclusive", regime_at_receipt: false },
    { id: 6, material_id: 4, batch_no: "FAB-NVY-B", dye_lot: "LOT-2503-B", quantity: 58, rate: 485,
      received_date: "2026-09-06", expiry_date: null, moisture_pct: null,
      seasoning_date: null, kiln_batch: null, location: "Fabric Rack 1", notes: null,
      supplier_name: "Burrabazar Furnishings", supplier_invoice_no: "BF/5644",
      supplier_invoice_date: "2026-09-06", supplier_gstin: "19AAEFB3456N1ZR",
      tax_rate: 5, cost_basis: "inclusive", regime_at_receipt: false },
    // Local cash purchase with no proper invoice — cannot support a credit claim.
    { id: 7, material_id: 6, batch_no: "ADH-2609", dye_lot: null, quantity: 31, rate: 310,
      received_date: "2026-09-02", expiry_date: "2027-09-02", moisture_pct: null,
      seasoning_date: null, kiln_batch: null, location: "Chemical Store",
      notes: "Local cash purchase, kacha bill",
      supplier_name: "Local hardware store", supplier_invoice_no: null,
      supplier_invoice_date: null, supplier_gstin: null,
      tax_rate: 18, cost_basis: "inclusive", regime_at_receipt: false },
  ] as MaterialBatch[],

  products: [
    { id: 1, code: "SOFA-3S-CHS", name: "3-Seater Chesterfield Sofa - Royal Navy",
      product_type: "finished", category: "Sofa", uom: "NOS", is_active: true },
    { id: 2, code: "SUB-FRAME-3S", name: "3-Seater Frame Assembly",
      product_type: "sub_assembly", category: "Frame", uom: "NOS", is_active: true },
    { id: 3, code: "SUB-CUSH-3S", name: "3-Seater Cushion Set",
      product_type: "sub_assembly", category: "Cushion", uom: "SET", is_active: true },
  ] as Product[],

  boms: [
    { id: 1, product_id: 1, version: 1, status: "active", effective_from: "2026-09-01",
      effective_to: null, output_quantity: 1, notes: "Standard navy velvet configuration" },
    { id: 2, product_id: 2, version: 1, status: "active", effective_from: "2026-09-01",
      effective_to: null, output_quantity: 1, notes: null },
    { id: 3, product_id: 3, version: 1, status: "active", effective_from: "2026-09-01",
      effective_to: null, output_quantity: 1, notes: null },
  ] as Bom[],

  bomLines: [
    // Sofa (multi-level: two sub-assemblies + direct materials)
    { id: 1, bom_id: 1, line_type: "sub_assembly", material_id: null, child_product_id: 2,
      quantity: 1, uom: "NOS", wastage_pct: 0, notes: null, sort_order: 1 },
    { id: 2, bom_id: 1, line_type: "sub_assembly", material_id: null, child_product_id: 3,
      quantity: 1, uom: "SET", wastage_pct: 0, notes: null, sort_order: 2 },
    { id: 3, bom_id: 1, line_type: "material", material_id: 4, child_product_id: null,
      quantity: 12, uom: "MTR", wastage_pct: 8, notes: "Outer upholstery", sort_order: 3 },
    { id: 4, bom_id: 1, line_type: "material", material_id: 6, child_product_id: null,
      quantity: 1.5, uom: "KG", wastage_pct: 5, notes: null, sort_order: 4 },
    { id: 5, bom_id: 1, line_type: "material", material_id: 5, child_product_id: null,
      quantity: 5, uom: "NOS", wastage_pct: 0, notes: null, sort_order: 5 },
    // Frame sub-assembly
    { id: 6, bom_id: 2, line_type: "material", material_id: 1, child_product_id: null,
      quantity: 45, uom: "RFT", wastage_pct: 12, notes: "Conversion loss", sort_order: 1 },
    { id: 7, bom_id: 2, line_type: "material", material_id: 2, child_product_id: null,
      quantity: 22, uom: "SQFT", wastage_pct: 8, notes: null, sort_order: 2 },
    // Cushion sub-assembly
    { id: 8, bom_id: 3, line_type: "material", material_id: 3, child_product_id: null,
      quantity: 6, uom: "PCS", wastage_pct: 10, notes: "Cutting offcut", sort_order: 1 },
    { id: 9, bom_id: 3, line_type: "material", material_id: 4, child_product_id: null,
      quantity: 6, uom: "MTR", wastage_pct: 8, notes: "Cushion covers", sort_order: 2 },
    { id: 10, bom_id: 3, line_type: "material", material_id: 7, child_product_id: null,
      quantity: 4, uom: "NOS", wastage_pct: 0, notes: null, sort_order: 3 },
  ] as BomLine[],

  nextId: { material: 9, batch: 8, product: 4, bom: 4, bomLine: 11 },
};

// -----------------------------------------------------------------------------
// Schema bootstrap
// -----------------------------------------------------------------------------
let erpTablesReady = false;

export async function ensureErpTables(): Promise<void> {
  const sql = getSql();
  if (!sql || erpTablesReady) return;

  try {
    await sql`CREATE TABLE IF NOT EXISTS uoms (
      id SERIAL PRIMARY KEY, code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(80) NOT NULL, dimension VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS material_categories (
      id SERIAL PRIMARY KEY, name VARCHAR(80) UNIQUE NOT NULL,
      material_type VARCHAR(40) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      code VARCHAR(40) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      category_id INT NOT NULL REFERENCES material_categories(id),
      material_type VARCHAR(40) NOT NULL,
      purchase_uom VARCHAR(20) NOT NULL,
      stock_uom VARCHAR(20) NOT NULL,
      consumption_uom VARCHAR(20) NOT NULL,
      purchase_to_stock_factor NUMERIC(16,6) NOT NULL DEFAULT 1 CHECK (purchase_to_stock_factor > 0),
      stock_to_consumption_factor NUMERIC(16,6) NOT NULL DEFAULT 1 CHECK (stock_to_consumption_factor > 0),
      tracks_batch BOOLEAN NOT NULL DEFAULT FALSE,
      tracks_dye_lot BOOLEAN NOT NULL DEFAULT FALSE,
      shelf_life_days INT,
      is_hazardous BOOLEAN NOT NULL DEFAULT FALSE,
      reorder_level NUMERIC(16,3) NOT NULL DEFAULT 0,
      standard_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
      hsn_code VARCHAR(20),
      is_offcut BOOLEAN NOT NULL DEFAULT FALSE,
      parent_material_id INT REFERENCES materials(id),
      attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS material_batches (
      id SERIAL PRIMARY KEY,
      material_id INT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      batch_no VARCHAR(60) NOT NULL,
      dye_lot VARCHAR(60),
      quantity NUMERIC(16,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      rate NUMERIC(14,2) NOT NULL DEFAULT 0,
      received_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expiry_date DATE,
      moisture_pct NUMERIC(5,2),
      seasoning_date DATE,
      kiln_batch VARCHAR(60),
      location VARCHAR(80),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (material_id, batch_no))`;

    await sql`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      code VARCHAR(40) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      product_type VARCHAR(20) NOT NULL DEFAULT 'finished',
      category VARCHAR(80),
      uom VARCHAR(20) NOT NULL DEFAULT 'NOS',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS boms (
      id SERIAL PRIMARY KEY,
      product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      version INT NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
      effective_to DATE,
      output_quantity NUMERIC(16,3) NOT NULL DEFAULT 1 CHECK (output_quantity > 0),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (product_id, version))`;

    await sql`CREATE TABLE IF NOT EXISTS bom_lines (
      id SERIAL PRIMARY KEY,
      bom_id INT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
      line_type VARCHAR(20) NOT NULL,
      material_id INT REFERENCES materials(id),
      child_product_id INT REFERENCES products(id),
      quantity NUMERIC(16,4) NOT NULL CHECK (quantity > 0),
      uom VARCHAR(20) NOT NULL,
      wastage_pct NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (wastage_pct >= 0),
      notes TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      CONSTRAINT bom_line_target_valid CHECK (
        (line_type = 'material' AND material_id IS NOT NULL AND child_product_id IS NULL) OR
        (line_type = 'sub_assembly' AND child_product_id IS NOT NULL AND material_id IS NULL)))`;

    await sql`CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      entity VARCHAR(60) NOT NULL,
      entity_id VARCHAR(60) NOT NULL,
      action VARCHAR(40) NOT NULL,
      actor VARCHAR(160) NOT NULL DEFAULT 'owner',
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_material_batches_material ON material_batches(material_id, received_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bom_lines_bom ON bom_lines(bom_id, sort_order)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id, created_at DESC)`;

    // Seed reference data
    for (const u of mem.uoms) {
      await sql`INSERT INTO uoms (code, name, dimension) VALUES (${u.code}, ${u.name}, ${u.dimension})
                ON CONFLICT (code) DO NOTHING`;
    }
    for (const c of mem.categories) {
      await sql`INSERT INTO material_categories (name, material_type) VALUES (${c.name}, ${c.material_type})
                ON CONFLICT (name) DO NOTHING`;
    }

    erpTablesReady = true;
  } catch (error) {
    console.error("Error initializing ERP schema:", error);
  }
}

async function logAudit(
  entity: string,
  entityId: string | number,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`INSERT INTO audit_log (entity, entity_id, action, actor, details)
              VALUES (${entity}, ${String(entityId)}, ${action}, ${await currentActor()},
                      ${JSON.stringify(details ?? {})}::jsonb)`;
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

// -----------------------------------------------------------------------------
// Reference data
// -----------------------------------------------------------------------------
export async function getUoms(): Promise<Uom[]> {
  const sql = getSql();
  if (!sql) return [...mem.uoms];
  await ensureErpTables();
  return (await sql`SELECT id, code, name, dimension FROM uoms ORDER BY code`) as Uom[];
}

export async function getMaterialCategories(): Promise<MaterialCategory[]> {
  const sql = getSql();
  if (!sql) return [...mem.categories];
  await ensureErpTables();
  return (await sql`SELECT id, name, material_type FROM material_categories ORDER BY name`) as MaterialCategory[];
}

// -----------------------------------------------------------------------------
// Materials
// -----------------------------------------------------------------------------
function hydrateMaterial(row: Record<string, unknown>): Material {
  return {
    ...(row as unknown as Material),
    purchase_to_stock_factor: Number(row.purchase_to_stock_factor),
    stock_to_consumption_factor: Number(row.stock_to_consumption_factor),
    reorder_level: Number(row.reorder_level),
    standard_rate: Number(row.standard_rate),
    shelf_life_days: row.shelf_life_days === null ? null : Number(row.shelf_life_days),
    stock_quantity: row.stock_quantity === undefined ? undefined : Number(row.stock_quantity ?? 0),
    stock_value: row.stock_value === undefined ? undefined : Number(row.stock_value ?? 0),
    batch_count: row.batch_count === undefined ? undefined : Number(row.batch_count ?? 0),
    attributes: (row.attributes ?? {}) as Record<string, string | number>,
  };
}

export async function getMaterials(search?: string, type?: string): Promise<Material[]> {
  const sql = getSql();
  const q = search?.trim().toLowerCase() || null;
  const typeFilter = type && type !== "All" ? type : null;

  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      SELECT m.*, c.name AS category_name,
             COALESCE(SUM(b.quantity), 0) AS stock_quantity,
             COALESCE(SUM(b.quantity * b.rate), 0) AS stock_value,
             COUNT(b.id) AS batch_count
      FROM materials m
      JOIN material_categories c ON c.id = m.category_id
      LEFT JOIN material_batches b ON b.material_id = m.id
      WHERE m.is_active = TRUE
        AND (${typeFilter}::text IS NULL OR m.material_type = ${typeFilter})
        AND (${q}::text IS NULL OR LOWER(m.name) LIKE '%' || ${q} || '%' OR LOWER(m.code) LIKE '%' || ${q} || '%')
      GROUP BY m.id, c.name
      ORDER BY m.name
    `) as Record<string, unknown>[];
    return rows.map(hydrateMaterial);
  }

  let list = mem.materials.filter((m) => m.is_active);
  if (typeFilter) list = list.filter((m) => m.material_type === typeFilter);
  if (q) {
    list = list.filter(
      (m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)
    );
  }
  return list
    .map((m) => {
      const batches = mem.batches.filter((b) => b.material_id === m.id);
      return {
        ...m,
        category_name: mem.categories.find((c) => c.id === m.category_id)?.name,
        stock_quantity: batches.reduce((s, b) => s + b.quantity, 0),
        stock_value: batches.reduce((s, b) => s + b.quantity * b.rate, 0),
        batch_count: batches.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getMaterialById(id: number): Promise<Material | null> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      SELECT m.*, c.name AS category_name,
             COALESCE((SELECT SUM(quantity) FROM material_batches WHERE material_id = m.id), 0) AS stock_quantity
      FROM materials m JOIN material_categories c ON c.id = m.category_id
      WHERE m.id = ${id} LIMIT 1`) as Record<string, unknown>[];
    return rows.length ? hydrateMaterial(rows[0]) : null;
  }
  const m = mem.materials.find((x) => x.id === id);
  if (!m) return null;
  return {
    ...m,
    category_name: mem.categories.find((c) => c.id === m.category_id)?.name,
    stock_quantity: mem.batches.filter((b) => b.material_id === id).reduce((s, b) => s + b.quantity, 0),
  };
}

export async function createMaterial(input: MaterialInput): Promise<Material> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      INSERT INTO materials (code, name, category_id, material_type, purchase_uom, stock_uom,
        consumption_uom, purchase_to_stock_factor, stock_to_consumption_factor, tracks_batch,
        tracks_dye_lot, shelf_life_days, is_hazardous, reorder_level, standard_rate, hsn_code, attributes)
      VALUES (${input.code}, ${input.name}, ${input.category_id}, ${input.material_type},
        ${input.purchase_uom}, ${input.stock_uom}, ${input.consumption_uom},
        ${input.purchase_to_stock_factor}, ${input.stock_to_consumption_factor},
        ${input.tracks_batch}, ${input.tracks_dye_lot}, ${input.shelf_life_days},
        ${input.is_hazardous}, ${input.reorder_level}, ${input.standard_rate},
        ${input.hsn_code ?? null}, ${JSON.stringify(input.attributes)}::jsonb)
      RETURNING *`) as Record<string, unknown>[];
    const created = hydrateMaterial(rows[0]);
    await logAudit("material", created.id, "create", { code: created.code, name: created.name });
    return created;
  }

  const created: Material = {
    id: mem.nextId.material++,
    ...input,
    hsn_code: input.hsn_code ?? null,
    is_offcut: false,
    parent_material_id: null,
    is_active: true,
    stock_quantity: 0,
    batch_count: 0,
    category_name: mem.categories.find((c) => c.id === input.category_id)?.name,
  };
  mem.materials.push(created);
  return created;
}

export async function updateMaterial(id: number, input: MaterialInput): Promise<Material> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      UPDATE materials SET
        code = ${input.code}, name = ${input.name}, category_id = ${input.category_id},
        material_type = ${input.material_type}, purchase_uom = ${input.purchase_uom},
        stock_uom = ${input.stock_uom}, consumption_uom = ${input.consumption_uom},
        purchase_to_stock_factor = ${input.purchase_to_stock_factor},
        stock_to_consumption_factor = ${input.stock_to_consumption_factor},
        tracks_batch = ${input.tracks_batch}, tracks_dye_lot = ${input.tracks_dye_lot},
        shelf_life_days = ${input.shelf_life_days}, is_hazardous = ${input.is_hazardous},
        reorder_level = ${input.reorder_level}, standard_rate = ${input.standard_rate},
        hsn_code = ${input.hsn_code ?? null}, attributes = ${JSON.stringify(input.attributes)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id} RETURNING *`) as Record<string, unknown>[];
    if (!rows.length) throw new Error(`Material ${id} not found`);
    await logAudit("material", id, "update", { code: input.code });
    return hydrateMaterial(rows[0]);
  }

  const idx = mem.materials.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error(`Material ${id} not found`);
  mem.materials[idx] = { ...mem.materials[idx], ...input, hsn_code: input.hsn_code ?? null };
  return mem.materials[idx];
}

export async function deactivateMaterial(id: number): Promise<void> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    await sql`UPDATE materials SET is_active = FALSE, updated_at = NOW() WHERE id = ${id}`;
    await logAudit("material", id, "deactivate");
    return;
  }
  const m = mem.materials.find((x) => x.id === id);
  if (m) m.is_active = false;
}

// -----------------------------------------------------------------------------
// Batches / dye lots
// -----------------------------------------------------------------------------
export async function getMaterialBatches(materialId: number): Promise<MaterialBatch[]> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      SELECT id, material_id, batch_no, dye_lot, quantity::float AS quantity, rate::float AS rate,
             TO_CHAR(received_date,'YYYY-MM-DD') AS received_date,
             TO_CHAR(expiry_date,'YYYY-MM-DD') AS expiry_date,
             moisture_pct::float AS moisture_pct,
             TO_CHAR(seasoning_date,'YYYY-MM-DD') AS seasoning_date,
             kiln_batch, location, notes
      FROM material_batches WHERE material_id = ${materialId}
      ORDER BY received_date ASC, id ASC`) as MaterialBatch[];
    return rows;
  }
  return mem.batches
    .filter((b) => b.material_id === materialId)
    .sort((a, b) => a.received_date.localeCompare(b.received_date));
}

export async function addMaterialBatch(materialId: number, input: BatchInput): Promise<MaterialBatch> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      INSERT INTO material_batches (material_id, batch_no, dye_lot, quantity, rate, received_date,
        expiry_date, moisture_pct, seasoning_date, kiln_batch, location, notes,
        supplier_name, supplier_invoice_no, supplier_invoice_date, supplier_gstin,
        taxable_value, tax_rate, cgst_amount, sgst_amount, igst_amount,
        cost_basis, regime_at_receipt)
      VALUES (${materialId}, ${input.batch_no}, ${input.dye_lot ?? null}, ${input.quantity},
        ${input.rate}, ${input.received_date}, ${input.expiry_date ?? null},
        ${input.moisture_pct ?? null}, ${input.seasoning_date ?? null}, ${input.kiln_batch ?? null},
        ${input.location ?? null}, ${input.notes ?? null},
        ${input.supplier_name ?? null}, ${input.supplier_invoice_no ?? null},
        ${input.supplier_invoice_date ?? null}, ${input.supplier_gstin ?? null},
        ${input.taxable_value ?? null}, ${input.tax_rate ?? null},
        ${input.cgst_amount ?? null}, ${input.sgst_amount ?? null}, ${input.igst_amount ?? null},
        ${input.cost_basis ?? "inclusive"}, ${input.regime_at_receipt ?? false})
      RETURNING *`) as MaterialBatch[];
    await logAudit("material_batch", rows[0].id, "create", {
      material_id: materialId, batch_no: input.batch_no, quantity: input.quantity,
    });
    return rows[0];
  }

  const created: MaterialBatch = {
    id: mem.nextId.batch++,
    material_id: materialId,
    batch_no: input.batch_no,
    dye_lot: input.dye_lot ?? null,
    quantity: input.quantity,
    rate: input.rate,
    received_date: input.received_date,
    expiry_date: input.expiry_date ?? null,
    moisture_pct: input.moisture_pct ?? null,
    seasoning_date: input.seasoning_date ?? null,
    kiln_batch: input.kiln_batch ?? null,
    location: input.location ?? null,
    notes: input.notes ?? null,
    supplier_name: input.supplier_name ?? null,
    supplier_invoice_no: input.supplier_invoice_no ?? null,
    supplier_invoice_date: input.supplier_invoice_date ?? null,
    supplier_gstin: input.supplier_gstin ?? null,
    taxable_value: input.taxable_value ?? null,
    tax_rate: input.tax_rate ?? null,
    cgst_amount: input.cgst_amount ?? null,
    sgst_amount: input.sgst_amount ?? null,
    igst_amount: input.igst_amount ?? null,
    cost_basis: input.cost_basis ?? "inclusive",
    regime_at_receipt: input.regime_at_receipt ?? false,
  };
  mem.batches.push(created);
  return created;
}

// -----------------------------------------------------------------------------
// Products & BOMs
// -----------------------------------------------------------------------------
/** Every batch across all materials — used for availability checks. */
export async function getAllBatches(): Promise<MaterialBatch[]> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    return (await sql`
      SELECT id, material_id, batch_no, dye_lot, quantity::float AS quantity, rate::float AS rate,
             TO_CHAR(received_date,'YYYY-MM-DD') AS received_date,
             TO_CHAR(expiry_date,'YYYY-MM-DD') AS expiry_date,
             moisture_pct::float AS moisture_pct, kiln_batch, location, notes
      FROM material_batches WHERE quantity > 0
      ORDER BY material_id, received_date`) as MaterialBatch[];
  }
  return mem.batches.filter((b) => b.quantity > 0).map((b) => ({ ...b }));
}

/** Reduce a batch when material is issued to the floor. Never goes negative. */
export async function consumeBatchQuantity(batchId: number, quantity: number): Promise<void> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    await sql`UPDATE material_batches
              SET quantity = GREATEST(0, quantity - ${quantity})
              WHERE id = ${batchId}`;
    return;
  }
  const batch = mem.batches.find((b) => b.id === batchId);
  if (batch) batch.quantity = Math.max(0, batch.quantity - quantity);
}

export async function getProducts(): Promise<Product[]> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    return (await sql`SELECT id, code, name, product_type, category, uom, is_active
                      FROM products WHERE is_active = TRUE ORDER BY name`) as Product[];
  }
  return mem.products.filter((p) => p.is_active);
}

export async function createProduct(input: {
  code: string; name: string; product_type: string; category?: string | null; uom: string;
}): Promise<Product> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      INSERT INTO products (code, name, product_type, category, uom)
      VALUES (${input.code}, ${input.name}, ${input.product_type}, ${input.category ?? null}, ${input.uom})
      RETURNING id, code, name, product_type, category, uom, is_active`) as Product[];
    await logAudit("product", rows[0].id, "create", { code: input.code });
    return rows[0];
  }
  const created = {
    id: mem.nextId.product++, code: input.code, name: input.name,
    product_type: input.product_type as Product["product_type"],
    category: input.category ?? null, uom: input.uom, is_active: true,
  };
  mem.products.push(created);
  return created;
}

export async function getBoms(): Promise<Bom[]> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      SELECT b.id, b.product_id, p.name AS product_name, p.code AS product_code, b.version,
             b.status, TO_CHAR(b.effective_from,'YYYY-MM-DD') AS effective_from,
             TO_CHAR(b.effective_to,'YYYY-MM-DD') AS effective_to,
             b.output_quantity::float AS output_quantity, b.notes,
             (SELECT COUNT(*) FROM bom_lines WHERE bom_id = b.id) AS line_count
      FROM boms b JOIN products p ON p.id = b.product_id
      ORDER BY p.name, b.version DESC`) as Record<string, unknown>[];
    return rows.map((r) => ({ ...(r as unknown as Bom), line_count: Number(r.line_count) }));
  }
  return mem.boms.map((b) => {
    const p = mem.products.find((x) => x.id === b.product_id);
    return {
      ...b,
      product_name: p?.name,
      product_code: p?.code,
      line_count: mem.bomLines.filter((l) => l.bom_id === b.id).length,
    };
  });
}

export async function getBomLines(bomId: number): Promise<BomLine[]> {
  const sql = getSql();
  if (sql) {
    await ensureErpTables();
    const rows = (await sql`
      SELECT l.id, l.bom_id, l.line_type, l.material_id, l.child_product_id,
             l.quantity::float AS quantity, l.uom, l.wastage_pct::float AS wastage_pct,
             l.notes, l.sort_order,
             COALESCE(m.code, p.code) AS item_code,
             COALESCE(m.name, p.name) AS item_name,
             COALESCE(m.standard_rate, 0)::float AS rate
      FROM bom_lines l
      LEFT JOIN materials m ON m.id = l.material_id
      LEFT JOIN products p ON p.id = l.child_product_id
      WHERE l.bom_id = ${bomId} ORDER BY l.sort_order, l.id`) as BomLine[];
    return rows;
  }
  return mem.bomLines
    .filter((l) => l.bom_id === bomId)
    .map((l) => {
      const m = l.material_id ? mem.materials.find((x) => x.id === l.material_id) : null;
      const p = l.child_product_id ? mem.products.find((x) => x.id === l.child_product_id) : null;
      return {
        ...l,
        item_code: m?.code ?? p?.code,
        item_name: m?.name ?? p?.name,
        rate: m?.standard_rate ?? 0,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function createBom(input: BomInput): Promise<Bom> {
  const sql = getSql();

  if (sql) {
    await ensureErpTables();
    const versionRows = (await sql`
      SELECT COALESCE(MAX(version), 0) + 1 AS next FROM boms WHERE product_id = ${input.product_id}
    `) as { next: number }[];
    const version = input.version ?? Number(versionRows[0].next);

    // A product has at most one active recipe; supersede the previous one.
    if (input.status === "active") {
      await sql`UPDATE boms SET status = 'archived', effective_to = ${input.effective_from}, updated_at = NOW()
                WHERE product_id = ${input.product_id} AND status = 'active'`;
    }

    const rows = (await sql`
      INSERT INTO boms (product_id, version, status, effective_from, output_quantity, notes)
      VALUES (${input.product_id}, ${version}, ${input.status}, ${input.effective_from},
              ${input.output_quantity}, ${input.notes ?? null})
      RETURNING id, product_id, version, status,
                TO_CHAR(effective_from,'YYYY-MM-DD') AS effective_from,
                TO_CHAR(effective_to,'YYYY-MM-DD') AS effective_to,
                output_quantity::float AS output_quantity, notes`) as Bom[];
    const bom = rows[0];

    let order = 1;
    for (const line of input.lines) {
      await sql`
        INSERT INTO bom_lines (bom_id, line_type, material_id, child_product_id, quantity, uom, wastage_pct, notes, sort_order)
        VALUES (${bom.id}, ${line.line_type}, ${line.material_id}, ${line.child_product_id},
                ${line.quantity}, ${line.uom}, ${line.wastage_pct}, ${line.notes ?? null}, ${order++})`;
    }

    await logAudit("bom", bom.id, "create", { product_id: input.product_id, version, lines: input.lines.length });
    return bom;
  }

  const version =
    input.version ??
    Math.max(0, ...mem.boms.filter((b) => b.product_id === input.product_id).map((b) => b.version)) + 1;

  if (input.status === "active") {
    mem.boms
      .filter((b) => b.product_id === input.product_id && b.status === "active")
      .forEach((b) => {
        b.status = "archived";
        b.effective_to = input.effective_from;
      });
  }

  const bom: Bom = {
    id: mem.nextId.bom++,
    product_id: input.product_id,
    version,
    status: input.status,
    effective_from: input.effective_from,
    effective_to: null,
    output_quantity: input.output_quantity,
    notes: input.notes ?? null,
  };
  mem.boms.push(bom);

  let order = 1;
  for (const line of input.lines) {
    mem.bomLines.push({
      id: mem.nextId.bomLine++,
      bom_id: bom.id,
      line_type: line.line_type,
      material_id: line.material_id,
      child_product_id: line.child_product_id,
      quantity: line.quantity,
      uom: line.uom,
      wastage_pct: line.wastage_pct,
      notes: line.notes ?? null,
      sort_order: order++,
    });
  }
  return bom;
}

/**
 * Recursively expands a product's active BOM into flat material requirements,
 * applying standard wastage at each level. Sub-assembly quantities multiply
 * down the tree, so 1 sofa -> 1 frame -> 45 RFT timber + 12% wastage.
 */
export async function explodeBom(
  productId: number,
  quantity: number = 1
): Promise<ExplodedRequirement[]> {
  const requirements = new Map<number, ExplodedRequirement>();
  const allBoms = await getBoms();
  const materialsById = new Map((await getMaterials()).map((m) => [m.id, m]));

  /**
   * BOM lines are written in the consumption UOM (timber in RFT) while
   * standard_rate is priced per stock UOM (timber in CFT), so the quantity has
   * to be converted before costing or the value is off by the UOM factor.
   */
  function toStockQuantity(material: Material | undefined, qty: number, uom: string): number {
    if (!material) return qty;
    if (uom === material.stock_uom) return qty;
    if (uom === material.consumption_uom) return qty / (material.stock_to_consumption_factor || 1);
    if (uom === material.purchase_uom) return qty * (material.purchase_to_stock_factor || 1);
    return qty;
  }

  async function walk(pid: number, multiplier: number, path: string, depth: number) {
    if (depth > 10) return; // guard against a cyclic BOM
    const bom = allBoms.find((b) => b.product_id === pid && b.status === "active");
    if (!bom) return;

    const lines = await getBomLines(bom.id);
    const perUnit = multiplier / (bom.output_quantity || 1);

    for (const line of lines) {
      if (line.line_type === "sub_assembly" && line.child_product_id) {
        await walk(
          line.child_product_id,
          perUnit * line.quantity,
          path ? `${path} > ${line.item_name}` : String(line.item_name),
          depth + 1
        );
        continue;
      }
      if (!line.material_id) continue;

      const material = materialsById.get(line.material_id);
      const net = perUnit * line.quantity;
      const gross = net * (1 + line.wastage_pct / 100);
      const rate = material?.standard_rate ?? line.rate ?? 0;
      const stockEquivalent = toStockQuantity(material, gross, line.uom);
      const existing = requirements.get(line.material_id);

      if (existing) {
        existing.net_quantity += net;
        existing.gross_quantity += gross;
        existing.stock_equivalent += stockEquivalent;
        existing.cost += stockEquivalent * rate;
        if (path && !existing.path.includes(path)) existing.path += `, ${path}`;
      } else {
        requirements.set(line.material_id, {
          material_id: line.material_id,
          code: line.item_code ?? "",
          name: line.item_name ?? "",
          uom: line.uom,
          net_quantity: net,
          gross_quantity: gross,
          wastage_pct: line.wastage_pct,
          stock_equivalent: stockEquivalent,
          stock_uom: material?.stock_uom ?? line.uom,
          rate,
          cost: stockEquivalent * rate,
          path: path || "Direct",
        });
      }
    }
  }

  await walk(productId, quantity, "", 0);
  return Array.from(requirements.values()).sort((a, b) => b.cost - a.cost);
}

/** Converts a quantity between a material's purchase / stock / consumption units. */
export function convertQuantity(
  material: Material,
  quantity: number,
  from: "purchase" | "stock" | "consumption",
  to: "purchase" | "stock" | "consumption"
): number {
  if (from === to) return quantity;
  // Normalise to stock UOM first
  let inStock: number;
  if (from === "purchase") inStock = quantity * material.purchase_to_stock_factor;
  else if (from === "consumption") inStock = quantity / material.stock_to_consumption_factor;
  else inStock = quantity;

  if (to === "purchase") return inStock / material.purchase_to_stock_factor;
  if (to === "consumption") return inStock * material.stock_to_consumption_factor;
  return inStock;
}
