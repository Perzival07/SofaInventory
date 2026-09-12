import { neon } from "@neondatabase/serverless";
import {
  TaxConfig,
  TaxRegimePeriod,
  TaxRule,
  RegimeState,
  TransitionalCreditLine,
} from "./tax-types";
import { resolveRegimeForDate, round2 } from "./tax-regime";
import { getMaterials, getMaterialBatches } from "./erp-db";

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

function getSql() {
  return connectionString ? neon(connectionString) : null;
}

const CURRENT_ACTOR = "owner";

// -----------------------------------------------------------------------------
// In-memory fallback state
// -----------------------------------------------------------------------------
const memTax = {
  config: {
    tax_regime_enabled: false,
    registration_number: null,
    registration_date: null,
    deregistration_date: null,
    state_code: "19",
    composition_scheme: false,
    filing_frequency: "quarterly",
    legal_name: null,
    trade_name: "Loknath Sofa Center",
    principal_place_of_business: "Barasat, North 24 Parganas, West Bengal",
  } as TaxConfig,
  periods: [] as TaxRegimePeriod[],
  rules: [
    { id: 1, rule_type: "threshold", rule_key: "goods_registration_threshold", numeric_value: 4000000,
      text_value: null, effective_from: "2026-04-01", effective_to: null,
      notes: "Aggregate turnover threshold for goods in West Bengal. Verify with CA.", verified_by_ca: false },
    { id: 2, rule_type: "threshold", rule_key: "services_registration_threshold", numeric_value: 2000000,
      text_value: null, effective_from: "2026-04-01", effective_to: null,
      notes: "Lower threshold applies if services are billed separately. Verify with CA.", verified_by_ca: false },
    { id: 3, rule_type: "alert_band", rule_key: "turnover_amber", numeric_value: 3000000,
      text_value: null, effective_from: "2026-04-01", effective_to: null, notes: "Amber warning band", verified_by_ca: false },
    { id: 4, rule_type: "alert_band", rule_key: "turnover_red", numeric_value: 3500000,
      text_value: null, effective_from: "2026-04-01", effective_to: null, notes: "Red warning band", verified_by_ca: false },
    { id: 5, rule_type: "alert_band", rule_key: "turnover_blocking", numeric_value: 3800000,
      text_value: null, effective_from: "2026-04-01", effective_to: null, notes: "Blocking warning band", verified_by_ca: false },
    { id: 6, rule_type: "jobwork_deadline", rule_key: "inputs_return_months", numeric_value: 12,
      text_value: null, effective_from: "2026-04-01", effective_to: null,
      notes: "Inputs must return within 1 year or dispatch is deemed a supply", verified_by_ca: false },
    { id: 7, rule_type: "jobwork_deadline", rule_key: "capital_goods_return_months", numeric_value: 36,
      text_value: null, effective_from: "2026-04-01", effective_to: null,
      notes: "Capital goods must return within 3 years", verified_by_ca: false },
    { id: 8, rule_type: "jobwork_deadline", rule_key: "alert_at_months", numeric_value: 9,
      text_value: null, effective_from: "2026-04-01", effective_to: null, notes: "Escalate before the deadline", verified_by_ca: false },
    { id: 9, rule_type: "eway_exemption", rule_key: "intrastate_jobwork_wb", numeric_value: 1,
      text_value: "exempt", effective_from: "2026-04-01", effective_to: null,
      notes: "Intra-state job work movement within WB. Verify with CA.", verified_by_ca: false },
    { id: 10, rule_type: "threshold", rule_key: "eway_bill_consignment_value", numeric_value: 50000,
      text_value: null, effective_from: "2026-04-01", effective_to: null,
      notes: "Consignment value above which an e-way bill is required. Verify with CA.", verified_by_ca: false },
    { id: 11, rule_type: "hsn_rate", rule_key: "9401", numeric_value: 18,
      text_value: "Seats — sofas, chairs, recliners", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 12, rule_type: "hsn_rate", rule_key: "9403", numeric_value: 18,
      text_value: "Other furniture — beds, wardrobes, tables", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 13, rule_type: "hsn_rate", rule_key: "9404", numeric_value: 18,
      text_value: "Mattresses, cushions, quilts", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 14, rule_type: "hsn_rate", rule_key: "4407", numeric_value: 18,
      text_value: "Wood sawn or chipped lengthwise", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 15, rule_type: "hsn_rate", rule_key: "4412", numeric_value: 18,
      text_value: "Plywood, veneered panels", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 16, rule_type: "hsn_rate", rule_key: "3921", numeric_value: 18,
      text_value: "Plastic sheets — PU foam", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 17, rule_type: "hsn_rate", rule_key: "5801", numeric_value: 5,
      text_value: "Woven pile fabrics, upholstery fabric", effective_from: "2026-04-01", effective_to: null,
      notes: "Rate varies by value. Verify with CA.", verified_by_ca: false },
    { id: 18, rule_type: "hsn_rate", rule_key: "3506", numeric_value: 18,
      text_value: "Prepared adhesives", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 19, rule_type: "hsn_rate", rule_key: "8302", numeric_value: 18,
      text_value: "Base metal mountings, hinges, castors", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 20, rule_type: "hsn_rate", rule_key: "9607", numeric_value: 12,
      text_value: "Slide fasteners — zippers", effective_from: "2026-04-01", effective_to: null,
      notes: "Suggestion only. Verify with CA.", verified_by_ca: false },
    { id: 21, rule_type: "hsn_rate", rule_key: "9988", numeric_value: 18,
      text_value: "Job work services", effective_from: "2026-04-01", effective_to: null,
      notes: "Rate varies. Verify with CA.", verified_by_ca: false },
  ] as TaxRule[],
  nextPeriodId: 1,
};

let taxTablesReady = false;

export async function ensureTaxTables(): Promise<void> {
  const sql = getSql();
  if (!sql || taxTablesReady) return;

  try {
    await sql`CREATE TABLE IF NOT EXISTS tax_config (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      tax_regime_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      registration_number VARCHAR(20),
      registration_date DATE,
      deregistration_date DATE,
      state_code VARCHAR(2) NOT NULL DEFAULT '19',
      composition_scheme BOOLEAN NOT NULL DEFAULT FALSE,
      filing_frequency VARCHAR(10) NOT NULL DEFAULT 'quarterly',
      legal_name VARCHAR(200), trade_name VARCHAR(200), principal_place_of_business TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS tax_regime_periods (
      id SERIAL PRIMARY KEY,
      registration_number VARCHAR(20),
      from_date DATE NOT NULL,
      to_date DATE,
      state_code VARCHAR(2) NOT NULL DEFAULT '19',
      composition_scheme BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    await sql`CREATE TABLE IF NOT EXISTS tax_rules (
      id SERIAL PRIMARY KEY,
      rule_type VARCHAR(40) NOT NULL,
      rule_key VARCHAR(80) NOT NULL,
      numeric_value NUMERIC(16,4),
      text_value TEXT,
      effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
      effective_to DATE,
      notes TEXT,
      verified_by_ca BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (rule_type, rule_key, effective_from))`;

    await sql`CREATE TABLE IF NOT EXISTS document_series (
      id SERIAL PRIMARY KEY,
      series_code VARCHAR(30) NOT NULL,
      financial_year VARCHAR(9) NOT NULL,
      prefix VARCHAR(20) NOT NULL DEFAULT '',
      next_number INT NOT NULL DEFAULT 1,
      requires_regime BOOLEAN,
      UNIQUE (series_code, financial_year))`;

    // Tax columns on masters — nullable, dormant while unregistered
    await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2)`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20)`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2)`;

    for (const col of [
      "supplier_name VARCHAR(200)", "supplier_invoice_no VARCHAR(60)",
      "supplier_invoice_date DATE", "supplier_gstin VARCHAR(20)",
      "taxable_value NUMERIC(14,2)", "tax_rate NUMERIC(5,2)",
      "cgst_amount NUMERIC(14,2)", "sgst_amount NUMERIC(14,2)",
      "igst_amount NUMERIC(14,2)", "cess_amount NUMERIC(14,2)",
      "place_of_supply VARCHAR(2)",
    ]) {
      await sql.query(`ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS ${col}`);
    }
    await sql`ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS cost_basis VARCHAR(10) NOT NULL DEFAULT 'inclusive'`;
    await sql`ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS regime_at_receipt BOOLEAN NOT NULL DEFAULT FALSE`;

    await sql`INSERT INTO tax_config (id, tax_regime_enabled, state_code, trade_name, principal_place_of_business)
              VALUES (1, FALSE, '19', 'Loknath Sofa Center', 'Barasat, North 24 Parganas, West Bengal')
              ON CONFLICT (id) DO NOTHING`;

    for (const r of memTax.rules) {
      await sql`INSERT INTO tax_rules (rule_type, rule_key, numeric_value, text_value, effective_from, notes, verified_by_ca)
                VALUES (${r.rule_type}, ${r.rule_key}, ${r.numeric_value}, ${r.text_value},
                        ${r.effective_from}, ${r.notes}, ${r.verified_by_ca})
                ON CONFLICT (rule_type, rule_key, effective_from) DO NOTHING`;
    }

    taxTablesReady = true;
  } catch (error) {
    console.error("Error initializing tax schema:", error);
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
// Config & periods
// -----------------------------------------------------------------------------
export async function getTaxConfig(): Promise<TaxConfig> {
  const sql = getSql();
  if (!sql) return { ...memTax.config };
  await ensureTaxTables();
  const rows = (await sql`
    SELECT tax_regime_enabled, registration_number,
           TO_CHAR(registration_date,'YYYY-MM-DD') AS registration_date,
           TO_CHAR(deregistration_date,'YYYY-MM-DD') AS deregistration_date,
           state_code, composition_scheme, filing_frequency,
           legal_name, trade_name, principal_place_of_business
    FROM tax_config WHERE id = 1`) as TaxConfig[];
  return rows[0] ?? { ...memTax.config };
}

export async function getRegimePeriods(): Promise<TaxRegimePeriod[]> {
  const sql = getSql();
  if (!sql) return [...memTax.periods];
  await ensureTaxTables();
  return (await sql`
    SELECT id, registration_number,
           TO_CHAR(from_date,'YYYY-MM-DD') AS from_date,
           TO_CHAR(to_date,'YYYY-MM-DD') AS to_date,
           state_code, composition_scheme
    FROM tax_regime_periods ORDER BY from_date`) as TaxRegimePeriod[];
}

/** Regime in force today. For historical documents, resolve against their own date. */
export async function getCurrentRegime(): Promise<RegimeState> {
  const [periods, config] = await Promise.all([getRegimePeriods(), getTaxConfig()]);
  return resolveRegimeForDate(periods, new Date().toISOString().slice(0, 10), config.state_code);
}

export async function enableTaxRegime(input: {
  registration_number: string;
  registration_date: string;
  state_code: string;
  composition_scheme: boolean;
  filing_frequency: "monthly" | "quarterly";
  legal_name?: string | null;
}): Promise<void> {
  const sql = getSql();

  if (sql) {
    await ensureTaxTables();
    // Close any period left open, then open a new one from the registration date.
    await sql`UPDATE tax_regime_periods SET to_date = ${input.registration_date}
              WHERE to_date IS NULL AND from_date < ${input.registration_date}`;
    await sql`INSERT INTO tax_regime_periods (registration_number, from_date, state_code, composition_scheme)
              VALUES (${input.registration_number}, ${input.registration_date},
                      ${input.state_code}, ${input.composition_scheme})`;
    await sql`UPDATE tax_config SET tax_regime_enabled = TRUE,
                registration_number = ${input.registration_number},
                registration_date = ${input.registration_date},
                deregistration_date = NULL,
                state_code = ${input.state_code},
                composition_scheme = ${input.composition_scheme},
                filing_frequency = ${input.filing_frequency},
                legal_name = ${input.legal_name ?? null},
                updated_at = NOW()
              WHERE id = 1`;
    await logAudit("tax_config", "1", "enable_regime", { ...input });
    return;
  }

  memTax.periods
    .filter((p) => p.to_date === null && p.from_date < input.registration_date)
    .forEach((p) => { p.to_date = input.registration_date; });
  memTax.periods.push({
    id: memTax.nextPeriodId++,
    registration_number: input.registration_number,
    from_date: input.registration_date,
    to_date: null,
    state_code: input.state_code,
    composition_scheme: input.composition_scheme,
  });
  memTax.config = {
    ...memTax.config,
    tax_regime_enabled: true,
    registration_number: input.registration_number,
    registration_date: input.registration_date,
    deregistration_date: null,
    state_code: input.state_code,
    composition_scheme: input.composition_scheme,
    filing_frequency: input.filing_frequency,
    legal_name: input.legal_name ?? null,
  };
}

/**
 * Close (or re-date) the latest registration period.
 *
 * Targets the most recent period starting on or before the given date rather
 * than only open-ended ones, so a cancellation date that was entered wrongly —
 * or set in the future and later brought forward — can still be corrected.
 */
export async function disableTaxRegime(deregistrationDate: string): Promise<void> {
  const sql = getSql();

  if (sql) {
    await ensureTaxTables();
    await sql`
      UPDATE tax_regime_periods SET to_date = ${deregistrationDate}
      WHERE id = (
        SELECT id FROM tax_regime_periods
        WHERE from_date <= ${deregistrationDate}
        ORDER BY from_date DESC LIMIT 1
      )`;
    await sql`UPDATE tax_config SET tax_regime_enabled = FALSE,
                deregistration_date = ${deregistrationDate}, updated_at = NOW() WHERE id = 1`;
    await logAudit("tax_config", "1", "disable_regime", { deregistration_date: deregistrationDate });
    return;
  }

  const target = [...memTax.periods]
    .filter((p) => p.from_date <= deregistrationDate)
    .sort((a, b) => b.from_date.localeCompare(a.from_date))[0];
  if (target) target.to_date = deregistrationDate;

  memTax.config = { ...memTax.config, tax_regime_enabled: false, deregistration_date: deregistrationDate };
}

/** The latest period start date, used to validate a proposed cancellation date. */
export async function getLatestPeriodStart(): Promise<string | null> {
  const periods = await getRegimePeriods();
  if (!periods.length) return null;
  return periods.map((p) => p.from_date).sort().slice(-1)[0];
}

// -----------------------------------------------------------------------------
// Rules
// -----------------------------------------------------------------------------
export async function getTaxRules(ruleType?: string): Promise<TaxRule[]> {
  const sql = getSql();
  if (!sql) {
    return memTax.rules.filter((r) => !ruleType || r.rule_type === ruleType);
  }
  await ensureTaxTables();
  const filter = ruleType ?? null;
  const rows = (await sql`
    SELECT id, rule_type, rule_key, numeric_value::float AS numeric_value, text_value,
           TO_CHAR(effective_from,'YYYY-MM-DD') AS effective_from,
           TO_CHAR(effective_to,'YYYY-MM-DD') AS effective_to,
           notes, verified_by_ca
    FROM tax_rules
    WHERE (${filter}::text IS NULL OR rule_type = ${filter})
    ORDER BY rule_type, rule_key`) as TaxRule[];
  return rows;
}

export async function updateTaxRule(
  id: number,
  patch: { numeric_value?: number; verified_by_ca?: boolean; notes?: string | null }
): Promise<void> {
  const sql = getSql();
  if (sql) {
    await ensureTaxTables();
    if (patch.numeric_value !== undefined) {
      await sql`UPDATE tax_rules SET numeric_value = ${patch.numeric_value}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (patch.verified_by_ca !== undefined) {
      await sql`UPDATE tax_rules SET verified_by_ca = ${patch.verified_by_ca}, updated_at = NOW() WHERE id = ${id}`;
    }
    await logAudit("tax_rule", String(id), "update", patch as Record<string, unknown>);
    return;
  }
  const rule = memTax.rules.find((r) => r.id === id);
  if (rule) Object.assign(rule, patch);
}

// -----------------------------------------------------------------------------
// Transitional credit report
//
// Section 2.3 rule 5: on the day of registration, credit may be claimed on
// inputs held in stock. This lists stock on hand with the tax embedded in its
// cost, and flags rows that cannot be claimed for want of a proper invoice.
// -----------------------------------------------------------------------------
export async function getTransitionalCreditReport(): Promise<{
  lines: TransitionalCreditLine[];
  claimable_total: number;
  blocked_total: number;
}> {
  const materials = await getMaterials();
  const lines: TransitionalCreditLine[] = [];

  for (const material of materials) {
    const batches = await getMaterialBatches(material.id);
    for (const batch of batches) {
      const qty = Number(batch.quantity);
      if (qty <= 0) continue;

      const taxRate = Number(batch.tax_rate ?? 0);
      const inclusiveValue = qty * Number(batch.rate);

      // Stock was costed GST-inclusive, so back the tax out of the held value.
      // Only stock still on hand is claimable, not the full original invoice.
      const embeddedTax =
        taxRate > 0 ? round2((inclusiveValue * taxRate) / (100 + taxRate)) : 0;
      const taxableValue = round2(inclusiveValue - embeddedTax);

      let blocker: string | null = null;
      if (!batch.supplier_invoice_no) blocker = "No supplier invoice on record";
      else if (!batch.supplier_gstin) blocker = "Supplier GSTIN missing";
      else if (taxRate <= 0) blocker = "No tax rate recorded";

      lines.push({
        material_id: material.id,
        material_code: material.code,
        material_name: material.name,
        batch_no: batch.batch_no,
        quantity: qty,
        stock_uom: material.stock_uom,
        supplier_name: batch.supplier_name ?? null,
        supplier_invoice_no: batch.supplier_invoice_no ?? null,
        supplier_invoice_date: batch.supplier_invoice_date ?? null,
        supplier_gstin: batch.supplier_gstin ?? null,
        taxable_value: taxableValue,
        tax_rate: taxRate,
        embedded_tax: embeddedTax,
        claimable: blocker === null,
        blocker,
      });
    }
  }

  const claimable_total = round2(
    lines.filter((l) => l.claimable).reduce((s, l) => s + l.embedded_tax, 0)
  );
  const blocked_total = round2(
    lines.filter((l) => !l.claimable).reduce((s, l) => s + l.embedded_tax, 0)
  );

  return { lines, claimable_total, blocked_total };
}
