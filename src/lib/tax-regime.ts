/**
 * Regime resolution and the dual-basis costing service.
 *
 * These are pure functions with no database or React dependency, so the
 * switchover behaviour can be tested directly.
 */

import {
  CostBasis,
  CostedPurchaseLine,
  PurchaseLineFacts,
  RegimeState,
  TaxRegimePeriod,
  TaxSplit,
} from "./tax-types";

export const UNREGISTERED_STATE: RegimeState = {
  registered: false,
  composition_scheme: false,
  registration_number: null,
  state_code: "19",
  cost_basis: "inclusive",
  sales_document_type: "cash_memo",
  sales_series_code: "CASH_MEMO",
  challan_type: "internal",
  itc_available: false,
  statutory_filing_required: false,
};

/**
 * Resolve the regime in force on a given date.
 *
 * Reads the period history, not the current flag, so a cash memo raised in 2026
 * still resolves as a cash memo in 2030 — and a business that registered,
 * deregistered and registered again resolves correctly in every window.
 */
export function resolveRegimeForDate(
  periods: TaxRegimePeriod[],
  date: string,
  fallbackStateCode = "19"
): RegimeState {
  const period = periods.find((p) => {
    if (date < p.from_date) return false;
    if (p.to_date && date > p.to_date) return false;
    return true;
  });

  if (!period) {
    return { ...UNREGISTERED_STATE, state_code: fallbackStateCode };
  }

  // A composition dealer is registered but cannot claim input credit and issues
  // a bill of supply rather than a tax invoice.
  const composition = period.composition_scheme;

  return {
    registered: true,
    composition_scheme: composition,
    registration_number: period.registration_number,
    state_code: period.state_code || fallbackStateCode,
    cost_basis: composition ? "inclusive" : "net",
    sales_document_type: composition ? "bill_of_supply" : "tax_invoice",
    sales_series_code: "TAX_INVOICE",
    challan_type: "rule_45",
    itc_available: !composition,
    statutory_filing_required: true,
  };
}

/**
 * Split a tax amount into CGST/SGST (intra-state) or IGST (inter-state).
 * Place of supply drives this, not the seller's location alone.
 */
export function splitTax(
  taxableValue: number,
  taxRate: number,
  sellerStateCode: string,
  placeOfSupplyStateCode: string
): TaxSplit {
  const totalTax = round2((taxableValue * taxRate) / 100);
  const isInterstate = Boolean(
    placeOfSupplyStateCode && placeOfSupplyStateCode !== sellerStateCode
  );

  if (isInterstate) {
    return { cgst_amount: 0, sgst_amount: 0, igst_amount: totalTax, total_tax: totalTax, is_interstate: true };
  }

  const half = round2(totalTax / 2);
  // Assign any rounding remainder to CGST so the two halves always sum exactly.
  return {
    cgst_amount: round2(totalTax - half),
    sgst_amount: half,
    igst_amount: 0,
    total_tax: totalTax,
    is_interstate: false,
  };
}

/**
 * The single costing service. Both regimes call this; the strategy is selected
 * by cost basis rather than by branching call sites.
 *
 *   inclusive (unregistered / composition)
 *     Supplier tax is unrecoverable and becomes part of item cost.
 *   net (registered, regular scheme)
 *     Supplier tax is stripped out of item cost and posted to input credit.
 *
 * In BOTH cases the tax amount is recorded, because the transitional credit
 * claim on the day of registration depends on knowing the tax embedded in
 * stock bought while unregistered.
 */
export function costPurchaseLine(
  facts: PurchaseLineFacts,
  regime: RegimeState
): CostedPurchaseLine {
  const taxableValue = round2(facts.taxable_value);
  const split = splitTax(
    taxableValue,
    facts.tax_rate,
    facts.supplier_state_code ?? regime.state_code,
    regime.state_code
  );
  const taxAmount = split.total_tax;

  const strategy = COST_STRATEGIES[regime.cost_basis];
  const { inventoryValue, recoverableTax, unrecoverableTax } = strategy(taxableValue, taxAmount);

  const quantity = facts.quantity > 0 ? facts.quantity : 1;

  return {
    cost_basis: regime.cost_basis,
    taxable_value: taxableValue,
    tax_amount: taxAmount,
    cgst_amount: split.cgst_amount,
    sgst_amount: split.sgst_amount,
    igst_amount: split.igst_amount,
    inventory_value: round2(inventoryValue),
    recoverable_tax: round2(recoverableTax),
    unrecoverable_tax: round2(unrecoverableTax),
    unit_cost: round4(inventoryValue / quantity),
  };
}

type StrategyResult = {
  inventoryValue: number;
  recoverableTax: number;
  unrecoverableTax: number;
};

const COST_STRATEGIES: Record<CostBasis, (taxable: number, tax: number) => StrategyResult> = {
  inclusive: (taxable, tax) => ({
    inventoryValue: taxable + tax,
    recoverableTax: 0,
    unrecoverableTax: tax,
  }),
  net: (taxable, tax) => ({
    inventoryValue: taxable,
    recoverableTax: tax,
    unrecoverableTax: 0,
  }),
};

/**
 * Make-vs-buy comparison must be regime-aware: a registered job worker's tax on
 * labour is a sunk cost while we are unregistered, and creditable once we
 * register. The comparison therefore flips on its own at switchover.
 */
export function jobWorkEffectiveCost(
  labourCharge: number,
  taxRate: number,
  regime: RegimeState
): { gross: number; effective_cost: number; recoverable_tax: number } {
  const tax = round2((labourCharge * taxRate) / 100);
  const recoverable = regime.itc_available ? tax : 0;
  return {
    gross: round2(labourCharge + tax),
    effective_cost: round2(labourCharge + tax - recoverable),
    recoverable_tax: recoverable,
  };
}

/** Financial year label for a date, e.g. 2026-27 (April–March). */
export function financialYearOf(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? year : year - 1; // April = month 3
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
