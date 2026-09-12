/**
 * Tax regime types.
 *
 * The shop is currently unregistered. Everything here is built and dormant.
 * The golden rule: a transaction's tax treatment is decided ONCE, at creation,
 * from the regime in force on its own date — never by reading the current flag
 * at render time.
 */

export type CostBasis = "inclusive" | "net";

export type SalesDocumentType = "cash_memo" | "bill_of_supply" | "tax_invoice";

export type ChallanType = "internal" | "rule_45";

export interface TaxConfig {
  tax_regime_enabled: boolean;
  registration_number: string | null;
  registration_date: string | null;
  deregistration_date: string | null;
  state_code: string;
  composition_scheme: boolean;
  filing_frequency: "monthly" | "quarterly";
  legal_name: string | null;
  trade_name: string | null;
  principal_place_of_business: string | null;
}

export interface TaxRegimePeriod {
  id: number;
  registration_number: string | null;
  from_date: string;
  to_date: string | null;
  state_code: string;
  composition_scheme: boolean;
}

/**
 * The resolved tax treatment for one point in time. This object is what gets
 * stamped onto a transaction record so the document renders identically forever.
 */
export interface RegimeState {
  registered: boolean;
  composition_scheme: boolean;
  registration_number: string | null;
  state_code: string;
  /** How purchases are booked into inventory */
  cost_basis: CostBasis;
  /** Which customer document is produced */
  sales_document_type: SalesDocumentType;
  /** Which numbering series that document draws from */
  sales_series_code: "CASH_MEMO" | "TAX_INVOICE";
  /** Job work dispatch document format */
  challan_type: ChallanType;
  /** Whether input tax is recoverable as credit */
  itc_available: boolean;
  /** Whether statutory returns must be produced */
  statutory_filing_required: boolean;
}

export interface TaxRule {
  id: number;
  rule_type: string;
  rule_key: string;
  numeric_value: number | null;
  text_value: string | null;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  verified_by_ca: boolean;
}

/** A purchase line as entered by the user: always gross-of-tax facts. */
export interface PurchaseLineFacts {
  quantity: number;
  /** Value before tax, as printed on the supplier invoice */
  taxable_value: number;
  /** Tax rate % as printed on the supplier invoice (0 if supplier is unregistered) */
  tax_rate: number;
  /** Supplier's state code, for intra vs inter-state determination */
  supplier_state_code?: string;
}

/** Result of costing a purchase line under the applicable regime. */
export interface CostedPurchaseLine {
  cost_basis: CostBasis;
  taxable_value: number;
  tax_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  /** Value booked into stock */
  inventory_value: number;
  /** Tax claimable as input credit (0 when unregistered or composition) */
  recoverable_tax: number;
  /** Tax that is a sunk cost and sits inside inventory_value */
  unrecoverable_tax: number;
  /** Per-unit rate to store on the batch */
  unit_cost: number;
}

export interface TaxSplit {
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  is_interstate: boolean;
}

/** One line of the transitional credit claim produced at registration. */
export interface TransitionalCreditLine {
  material_id: number;
  material_code: string;
  material_name: string;
  batch_no: string;
  quantity: number;
  stock_uom: string;
  supplier_name: string | null;
  supplier_invoice_no: string | null;
  supplier_invoice_date: string | null;
  supplier_gstin: string | null;
  taxable_value: number;
  tax_rate: number;
  /** Tax embedded in the cost of this stock, claimable on registration */
  embedded_tax: number;
  /** Flags rows that cannot be claimed without more information */
  claimable: boolean;
  blocker: string | null;
}
