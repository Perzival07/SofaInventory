/**
 * Purchase and goods-receipt types.
 *
 * A GRN is where the dual cost basis actually bites: the regime in force on the
 * RECEIPT DATE decides whether supplier tax lands in inventory cost or in the
 * input credit ledger, and that decision is frozen onto the GRN record.
 */

export type PoStatus = "draft" | "approved" | "partial" | "received" | "cancelled";

export interface Supplier {
  id: number;
  code: string;
  name: string;
  gstin: string | null;
  state_code: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  payment_terms_days: number;
  is_active: boolean;
}

export interface SupplierInput {
  code: string;
  name: string;
  gstin?: string | null;
  state_code: string;
  contact_person?: string | null;
  phone?: string | null;
  address?: string | null;
  payment_terms_days: number;
}

export interface PurchaseOrderLine {
  id: number;
  po_id: number;
  material_id: number;
  material_code?: string;
  material_name?: string;
  /** Quantity in the material's PURCHASE uom */
  quantity: number;
  uom: string;
  /** Taxable rate per purchase uom, before tax */
  rate: number;
  tax_rate: number;
  hsn_code: string | null;
  received_quantity: number;
  sort_order: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name?: string;
  supplier_gstin?: string | null;
  order_date: string;
  expected_date: string | null;
  status: PoStatus;
  freight_amount: number;
  notes: string | null;
  line_count?: number;
  total_value?: number;
}

export interface PurchaseOrderInput {
  supplier_id: number;
  order_date: string;
  expected_date?: string | null;
  freight_amount: number;
  notes?: string | null;
  lines: {
    material_id: number;
    quantity: number;
    uom: string;
    rate: number;
    tax_rate: number;
    hsn_code?: string | null;
  }[];
}

/** One line as keyed in on the receiving screen. */
export interface GrnLineInput {
  po_line_id?: number | null;
  material_id: number;
  /** In the material's PURCHASE uom */
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  rejection_reason?: string | null;
  /** Taxable rate per purchase uom */
  rate: number;
  tax_rate: number;
  batch_no: string;
  dye_lot?: string | null;
  expiry_date?: string | null;
  moisture_pct?: number | null;
  kiln_batch?: string | null;
  location?: string | null;
}

export interface GrnInput {
  po_id?: number | null;
  supplier_id: number;
  receipt_date: string;
  supplier_invoice_no?: string | null;
  supplier_invoice_date?: string | null;
  freight_amount: number;
  notes?: string | null;
  lines: GrnLineInput[];
}

/** A GRN line after costing — what actually gets written to stock. */
export interface PostedGrnLine {
  material_id: number;
  material_code: string;
  material_name: string;
  batch_no: string;
  dye_lot: string | null;

  /** As received, in purchase uom */
  accepted_quantity: number;
  purchase_uom: string;
  /** Converted into stock uom — this is what the batch holds */
  stock_quantity: number;
  stock_uom: string;

  taxable_value: number;
  tax_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;

  freight_allocated: number;
  /** Value booked into stock, including freight and any unrecoverable tax */
  inventory_value: number;
  recoverable_tax: number;
  unrecoverable_tax: number;
  /** Landed cost per stock uom — what the batch rate becomes */
  landed_unit_cost: number;

  /** Purchase price variance against the material's standard rate */
  standard_rate: number;
  price_variance_per_unit: number;
  price_variance_total: number;
}

export interface PostedGrn {
  cost_basis: "inclusive" | "net";
  regime_at_receipt: boolean;
  gstin_at_receipt: string | null;
  lines: PostedGrnLine[];
  total_taxable: number;
  total_tax: number;
  total_recoverable_tax: number;
  total_freight: number;
  total_inventory_value: number;
  total_price_variance: number;
}

export interface Grn {
  id: number;
  grn_number: string;
  po_id: number | null;
  po_number?: string | null;
  supplier_id: number;
  supplier_name?: string;
  receipt_date: string;
  supplier_invoice_no: string | null;
  supplier_invoice_date: string | null;
  freight_amount: number;
  regime_at_receipt: boolean;
  cost_basis: "inclusive" | "net";
  gstin_at_receipt: string | null;
  total_taxable: number;
  total_tax: number;
  total_recoverable_tax: number;
  total_inventory_value: number;
  notes: string | null;
  line_count?: number;
}

/** One observation in a material's supplier price history. */
export interface PriceHistoryPoint {
  date: string;
  supplier_name: string;
  grn_number: string;
  rate: number;
  landed_unit_cost: number;
  stock_uom: string;
}
