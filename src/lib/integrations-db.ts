import { neon } from "@neondatabase/serverless";
import {
  INTEGRATIONS, IntegrationStatus, StoredCredential,
} from "./integrations-types";
import {
  encryptSecret, decryptSecret, maskSecret, hasAppSecret, MissingAppSecretError,
} from "./secret-crypto";

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

function getSql() {
  return connectionString ? neon(connectionString) : null;
}

import { currentActor } from "./actor";

interface StoredRow {
  service_code: string;
  field_key: string;
  encrypted_value: string;
  masked_value: string;
  is_secret: boolean;
  updated_at: string;
}

const memCreds: StoredRow[] = [];

let credTablesReady = false;

export async function ensureCredentialTables(): Promise<void> {
  const sql = getSql();
  if (!sql || credTablesReady) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS integration_credentials (
      id SERIAL PRIMARY KEY,
      service_code VARCHAR(40) NOT NULL,
      field_key VARCHAR(60) NOT NULL,
      encrypted_value TEXT NOT NULL,
      masked_value VARCHAR(80) NOT NULL,
      is_secret BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (service_code, field_key))`;
    credTablesReady = true;
  } catch (error) {
    console.error("Error initializing credential storage:", error);
  }
}

async function logAudit(action: string, details: Record<string, unknown>) {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`INSERT INTO audit_log (entity, entity_id, action, actor, details)
              VALUES ('integration_credential', ${String(details.service_code ?? "")},
                      ${action}, ${await currentActor()}, ${JSON.stringify(details)}::jsonb)`;
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

async function allRows(): Promise<StoredRow[]> {
  const sql = getSql();
  if (!sql) return [...memCreds];
  await ensureCredentialTables();
  return (await sql`
    SELECT service_code, field_key, encrypted_value, masked_value, is_secret,
           TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI') AS updated_at
    FROM integration_credentials`) as StoredRow[];
}

/**
 * Status for every service, with values masked.
 *
 * This is the ONLY function the UI layer calls to read credentials — it has no
 * path to the plaintext, so a rendering mistake cannot leak a key.
 */
export async function getIntegrationStatuses(): Promise<IntegrationStatus[]> {
  const rows = await allRows();

  return INTEGRATIONS.map((def) => {
    const mine = rows.filter((r) => r.service_code === def.code);
    const credentials: StoredCredential[] = mine.map((r) => ({
      service_code: r.service_code,
      field_key: r.field_key,
      masked_value: r.masked_value,
      is_secret: r.is_secret,
      updated_at: r.updated_at,
    }));

    // A service counts as configured only when every non-optional field is set.
    const required = def.fields.filter((f) => !f.hint?.startsWith("Optional"));
    const filled = required.filter((f) => mine.some((r) => r.field_key === f.key)).length;

    return {
      code: def.code,
      configured: filled === required.length && required.length > 0,
      filled,
      total: required.length,
      credentials,
    };
  });
}

export async function saveCredential(
  serviceCode: string, fieldKey: string, value: string
): Promise<void> {
  if (!hasAppSecret()) throw new MissingAppSecretError();

  const def = INTEGRATIONS.find((i) => i.code === serviceCode);
  const field = def?.fields.find((f) => f.key === fieldKey);
  if (!def || !field) throw new Error("Unknown credential field");

  const trimmed = value.trim();
  if (!trimmed) throw new Error("Value cannot be empty");

  const encrypted = encryptSecret(trimmed);
  // Non-secret fields (a UPI ID, an email) are shown in full; secrets are masked.
  const masked = field.kind === "secret" ? maskSecret(trimmed) : trimmed.slice(0, 60);
  const isSecret = field.kind === "secret";

  const sql = getSql();
  if (sql) {
    await ensureCredentialTables();
    await sql`
      INSERT INTO integration_credentials (service_code, field_key, encrypted_value, masked_value, is_secret)
      VALUES (${serviceCode}, ${fieldKey}, ${encrypted}, ${masked}, ${isSecret})
      ON CONFLICT (service_code, field_key)
      DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value,
                    masked_value = EXCLUDED.masked_value,
                    updated_at = NOW()`;
  } else {
    const existing = memCreds.find(
      (r) => r.service_code === serviceCode && r.field_key === fieldKey
    );
    const row: StoredRow = {
      service_code: serviceCode, field_key: fieldKey,
      encrypted_value: encrypted, masked_value: masked, is_secret: isSecret,
      updated_at: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    if (existing) Object.assign(existing, row);
    else memCreds.push(row);
  }

  // The value never enters the audit log — only the fact that it changed.
  await logAudit("save", { service_code: serviceCode, field_key: fieldKey });
}

export async function deleteCredential(serviceCode: string, fieldKey: string): Promise<void> {
  const sql = getSql();
  if (sql) {
    await ensureCredentialTables();
    await sql`DELETE FROM integration_credentials
              WHERE service_code = ${serviceCode} AND field_key = ${fieldKey}`;
  } else {
    const i = memCreds.findIndex(
      (r) => r.service_code === serviceCode && r.field_key === fieldKey
    );
    if (i >= 0) memCreds.splice(i, 1);
  }
  await logAudit("delete", { service_code: serviceCode, field_key: fieldKey });
}

/**
 * Server-side accessor for code that actually needs to call an external API.
 *
 * Deliberately not exported through any server action — nothing the browser can
 * invoke returns a decrypted value.
 */
export async function readCredential(
  serviceCode: string, fieldKey: string
): Promise<string | null> {
  const rows = await allRows();
  const row = rows.find((r) => r.service_code === serviceCode && r.field_key === fieldKey);
  if (!row) return null;
  try {
    return decryptSecret(row.encrypted_value);
  } catch {
    // A failed decrypt means APP_SECRET changed or the row was tampered with.
    console.error(`Cannot decrypt ${serviceCode}.${fieldKey} — APP_SECRET may have changed`);
    return null;
  }
}

/** Confirms a stored credential is still readable, without revealing it. */
export async function verifyCredential(
  serviceCode: string, fieldKey: string
): Promise<{ ok: boolean; length: number; reason?: string }> {
  if (!hasAppSecret()) return { ok: false, length: 0, reason: "APP_SECRET is not set" };
  const value = await readCredential(serviceCode, fieldKey);
  if (value === null) {
    return { ok: false, length: 0, reason: "Not stored, or cannot be decrypted" };
  }
  return { ok: true, length: value.length };
}
