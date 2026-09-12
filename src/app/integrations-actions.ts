"use server";

import { requireSession } from "@/lib/require-session";


import { revalidatePath } from "next/cache";
import {
  getIntegrationStatuses, saveCredential, deleteCredential, verifyCredential,
} from "@/lib/integrations-db";
import { INTEGRATIONS, IntegrationDef, IntegrationStatus } from "@/lib/integrations-types";
import { hasAppSecret, generateAppSecret } from "@/lib/secret-crypto";

export interface IntegrationsPageData {
  definitions: IntegrationDef[];
  statuses: IntegrationStatus[];
  app_secret_configured: boolean;
  /** No login exists yet, so this page is reachable by anyone with the URL. */
  auth_configured: boolean;
  database_configured: boolean;
}

export async function fetchIntegrationsAction(): Promise<IntegrationsPageData> {
  await requireSession();
  const statuses = await getIntegrationStatuses();
  const google = statuses.find((s) => s.code === "google_oauth");

  return {
    definitions: INTEGRATIONS,
    statuses,
    app_secret_configured: hasAppSecret(),
    // Even fully configured, sign-in is not enforced until the login flow is built.
    auth_configured: false && Boolean(google?.configured),
    database_configured: Boolean(
      process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL
    ),
  };
}

export async function saveCredentialAction(
  serviceCode: string, fieldKey: string, value: string
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    await saveCredential(serviceCode, fieldKey, value);
    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save credential",
    };
  }
}

export async function deleteCredentialAction(
  serviceCode: string, fieldKey: string
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    await deleteCredential(serviceCode, fieldKey);
    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

/** Reports only whether the value is readable and how long it is. */
export async function verifyCredentialAction(
  serviceCode: string, fieldKey: string
): Promise<{ ok: boolean; length: number; reason?: string }> {
  await requireSession();
  return verifyCredential(serviceCode, fieldKey);
}

/** Generates a candidate APP_SECRET for the owner to paste into Vercel. */
export async function generateAppSecretAction(): Promise<{ secret: string }> {
  await requireSession();
  return { secret: generateAppSecret() };
}
