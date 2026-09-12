"use server";

import { requireSession } from "@/lib/require-session";


import { revalidatePath } from "next/cache";
import {
  getTaxConfig,
  getRegimePeriods,
  getCurrentRegime,
  enableTaxRegime,
  disableTaxRegime,
  getTaxRules,
  updateTaxRule,
  getTransitionalCreditReport,
  getLatestPeriodStart,
} from "@/lib/tax-db";
import { TaxConfig, TaxRegimePeriod, TaxRule, RegimeState, TransitionalCreditLine } from "@/lib/tax-types";

export interface TaxSettingsData {
  config: TaxConfig;
  periods: TaxRegimePeriod[];
  regime: RegimeState;
  rules: TaxRule[];
}

export async function fetchTaxSettingsAction(): Promise<TaxSettingsData> {
  await requireSession();
  const [config, periods, regime, rules] = await Promise.all([
    getTaxConfig(),
    getRegimePeriods(),
    getCurrentRegime(),
    getTaxRules(),
  ]);
  return { config, periods, regime, rules };
}

export async function fetchTransitionalCreditAction(): Promise<{
  lines: TransitionalCreditLine[];
  claimable_total: number;
  blocked_total: number;
}> {
  await requireSession();
  return getTransitionalCreditReport();
}

/** GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z', checksum char. */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function enableTaxRegimeAction(input: {
  registration_number: string;
  registration_date: string;
  state_code: string;
  composition_scheme: boolean;
  filing_frequency: "monthly" | "quarterly";
  legal_name?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    const gstin = input.registration_number.trim().toUpperCase();

    if (!GSTIN_PATTERN.test(gstin)) {
      return {
        success: false,
        error: "GSTIN format looks wrong. Expected 15 characters, e.g. 19ABCDE1234F1Z5.",
      };
    }
    if (gstin.slice(0, 2) !== input.state_code) {
      return {
        success: false,
        error: `GSTIN starts with ${gstin.slice(0, 2)} but the state code is set to ${input.state_code}. West Bengal is 19.`,
      };
    }
    if (!input.registration_date) {
      return { success: false, error: "Registration date is required — the switch is effective-dated." };
    }

    await enableTaxRegime({ ...input, registration_number: gstin });

    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Failed to enable tax regime:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to enable tax regime" };
  }
}

export async function disableTaxRegimeAction(
  deregistrationDate: string
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    if (!deregistrationDate) {
      return { success: false, error: "A deregistration date is required." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deregistrationDate)) {
      return { success: false, error: "Enter the date as YYYY-MM-DD." };
    }

    const periodStart = await getLatestPeriodStart();
    if (!periodStart) {
      return { success: false, error: "There is no registration period to cancel." };
    }
    if (deregistrationDate < periodStart) {
      return {
        success: false,
        error: `Cancellation cannot pre-date the registration it closes (${periodStart}).`,
      };
    }

    await disableTaxRegime(deregistrationDate);
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to disable tax regime" };
  }
}

export async function updateTaxRuleAction(
  id: number,
  patch: { numeric_value?: number; verified_by_ca?: boolean }
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    await updateTaxRule(id, patch);
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update rule" };
  }
}
