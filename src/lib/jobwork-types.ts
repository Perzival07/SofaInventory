/**
 * Job work types.
 *
 * Two models are supported and must not be conflated:
 *
 *   Model A — full buyout: the vendor supplies material and labour and we buy
 *   finished goods. That is an ordinary purchase order and GRN.
 *
 *   Model B — job work: WE issue the raw material and the vendor charges for
 *   labour only. Material sent out is still OUR asset. It leaves the raw store
 *   but moves to a "stock with vendor" state — it is NOT consumed on dispatch.
 */

export type JobWorkStatus =
  | "draft"
  | "open"          // raised, nothing sent yet
  | "dispatched"    // material with vendor
  | "part_received"
  | "completed"
  | "cancelled";

export type ChallanType = "internal" | "rule_45";

export interface JobWorkVendor {
  id: number;
  code: string;
  name: string;
  gstin: string | null;
  state_code: string;
  phone: string | null;
  address: string | null;
  /** Operation codes this vendor can perform, e.g. ["POL","UPH"] */
  capabilities: string[];
  /** Units per month */
  monthly_capacity: number;
  standard_lead_days: number;
  /** Wastage the vendor is contractually allowed before recovery kicks in */
  agreed_wastage_pct: number;
  quality_rating: number;
  is_active: boolean;
}

export interface JobWorkOrder {
  id: number;
  jw_number: string;
  vendor_id: number;
  vendor_name?: string;
  vendor_gstin?: string | null;
  /** What the vendor is doing — matched to an operation where possible */
  operation_code: string | null;
  operation_name: string | null;
  /** Optional link back to the in-house work order this feeds */
  work_order_id: number | null;
  wo_number?: string | null;
  /** What comes back, when the output is a distinct item */
  output_product_id: number | null;
  output_product_name?: string | null;
  expected_output_qty: number;
  /** Labour charge per output unit */
  rate: number;
  tax_rate: number;
  agreed_wastage_pct: number;
  order_date: string;
  due_date: string | null;
  status: JobWorkStatus;
  notes: string | null;
  received_qty?: number;
  rejected_qty?: number;
}

export interface JobWorkOrderInput {
  vendor_id: number;
  operation_code?: string | null;
  work_order_id?: number | null;
  output_product_id?: number | null;
  expected_output_qty: number;
  rate: number;
  tax_rate: number;
  agreed_wastage_pct: number;
  order_date: string;
  due_date?: string | null;
  notes?: string | null;
}

/** A dispatch of our material to a job worker. */
export interface JobWorkChallan {
  id: number;
  challan_number: string;
  jw_order_id: number;
  jw_number?: string;
  vendor_id: number;
  vendor_name?: string;
  dispatch_date: string;
  /** Frozen at dispatch — an internal challan stays internal forever */
  challan_type: ChallanType;
  regime_at_dispatch: boolean;
  gstin_at_dispatch: string | null;
  /** Value of goods sent. Not a sale — this is our own stock moving out. */
  total_value: number;
  eway_bill_required: boolean;
  eway_bill_exempt_reason: string | null;
  notes: string | null;
  line_count?: number;
}

export interface ChallanLineInput {
  material_id: number;
  /** In stock uom */
  quantity: number;
}

export interface ChallanLine {
  id: number;
  challan_id: number;
  material_id: number;
  material_code?: string;
  material_name?: string;
  quantity: number;
  stock_uom?: string;
  rate: number;
  value: number;
  hsn_code: string | null;
  returned_quantity: number;
}

/** Material physically held by a vendor — still our asset. */
export interface VendorStockLine {
  vendor_id: number;
  vendor_name: string;
  material_id: number;
  material_code: string;
  material_name: string;
  stock_uom: string;
  quantity: number;
  value: number;
  /** Oldest outstanding dispatch for this material with this vendor */
  oldest_dispatch_date: string;
  days_out: number;
  deadline_status: DeadlineStatus;
}

export type DeadlineStatus = "ok" | "approaching" | "breached";

export interface ChallanReconciliation {
  challan_id: number;
  challan_number: string;
  vendor_name: string;
  dispatch_date: string;
  days_out: number;
  sent_value: number;
  sent_qty: number;
  returned_qty: number;
  balance_qty: number;
  deadline_status: DeadlineStatus;
  /** Months remaining before the dispatch is deemed a supply */
  months_remaining: number;
}

/** Receipt of finished work back from a vendor. */
export interface JobWorkReceiptInput {
  jw_order_id: number;
  receipt_date: string;
  good_qty: number;
  rejected_qty: number;
  rejection_reason?: string | null;
  /** Scrap the vendor sent back (wood offcuts, fabric remnants) */
  scrap_returned_value: number;
  /** Unused material returned to our store, by material */
  material_returns: { material_id: number; quantity: number }[];
  notes?: string | null;
}

export interface WastageAssessment {
  material_id: number;
  material_code: string;
  material_name: string;
  stock_uom: string;
  sent_qty: number;
  returned_qty: number;
  consumed_qty: number;
  /** What should have been consumed for the good output produced */
  standard_qty: number;
  actual_wastage_pct: number;
  agreed_wastage_pct: number;
  excess_wastage_qty: number;
  rate: number;
  /** Recoverable from the vendor at material cost */
  recovery_amount: number;
}

/** Three-way match: order vs goods received vs vendor invoice. */
export interface ThreeWayMatch {
  jw_order_id: number;
  jw_number: string;
  ordered_qty: number;
  ordered_rate: number;
  received_good_qty: number;
  invoice_qty: number | null;
  invoice_rate: number | null;
  invoice_amount: number | null;
  expected_amount: number;
  discrepancies: string[];
  matched: boolean;
  /** Payment must be blocked until every discrepancy is resolved */
  payment_blocked: boolean;
}

export interface VendorScorecard {
  vendor_id: number;
  vendor_name: string;
  orders_completed: number;
  units_received: number;
  units_rejected: number;
  rejection_pct: number;
  on_time_pct: number;
  avg_wastage_pct: number;
  agreed_wastage_pct: number;
  total_recovery: number;
  /** Labour cost per unit, for make-vs-buy */
  avg_rate: number;
}

/** Regime-aware comparison of in-house vs outsourced cost. */
export interface MakeVsBuyLine {
  operation: string;
  in_house_cost: number;
  job_work_labour: number;
  job_work_tax: number;
  job_work_recoverable_tax: number;
  job_work_effective_cost: number;
  cheaper: "make" | "buy";
  difference: number;
}
