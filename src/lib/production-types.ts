/**
 * Production types — work orders, material issue, stage-wise output.
 */

export type WorkOrderStatus =
  | "draft"
  | "released"      // material reserved, ready for the floor
  | "in_progress"
  | "completed"
  | "cancelled";

export type WorkOrderSource = "sales_order" | "forecast";

export interface Operation {
  id: number;
  code: string;
  name: string;
  sequence: number;
  /** Standard minutes per unit, for efficiency measurement */
  standard_minutes: number;
  /** Paid per unit completed — the usual arrangement for karigars */
  piece_rate: number;
  machine_required: boolean;
  is_active: boolean;
}

export interface Karigar {
  id: number;
  code: string;
  name: string;
  /** Primary skill, matched against operation codes */
  skill: string | null;
  phone: string | null;
  daily_wage: number;
  is_piece_rate: boolean;
  is_active: boolean;
}

export interface WorkOrder {
  id: number;
  wo_number: string;
  product_id: number;
  product_name?: string;
  product_code?: string;
  quantity: number;
  source: WorkOrderSource;
  status: WorkOrderStatus;
  order_date: string;
  due_date: string | null;
  notes: string | null;
  /** BOM version frozen at release, so a later recipe change cannot rewrite history */
  bom_id: number | null;
  completed_quantity?: number;
}

export interface WorkOrderOperation {
  id: number;
  work_order_id: number;
  operation_id: number;
  operation_code?: string;
  operation_name?: string;
  sequence: number;
  piece_rate: number;
  standard_minutes: number;
  completed_quantity: number;
  rejected_quantity: number;
  rework_quantity: number;
}

/** What a work order needs, checked against what is actually free. */
export interface MaterialRequirement {
  material_id: number;
  material_code: string;
  material_name: string;
  /** Required quantity converted into the STOCK uom */
  required_qty: number;
  stock_uom: string;
  on_hand: number;
  /** Already committed to other work orders */
  reserved_elsewhere: number;
  free: number;
  shortfall: number;
  purchase_uom: string;
  /** Shortfall expressed in the purchase uom, ready for an indent */
  shortfall_purchase_qty: number;
}

export interface StockReservation {
  id: number;
  work_order_id: number;
  material_id: number;
  /** In stock uom */
  quantity: number;
  issued_quantity: number;
  status: "reserved" | "issued" | "released";
}

/** One batch picked to satisfy an issue. */
export interface BatchAllocation {
  batch_id: number;
  batch_no: string;
  dye_lot: string | null;
  quantity: number;
  rate: number;
  value: number;
  expiry_date: string | null;
}

export interface AllocationResult {
  allocations: BatchAllocation[];
  allocated_qty: number;
  shortfall: number;
  total_value: number;
  warnings: string[];
}

export interface MaterialIssue {
  id: number;
  issue_number: string;
  work_order_id: number;
  wo_number?: string;
  issue_date: string;
  issued_to: string | null;
  notes: string | null;
  total_value: number;
  line_count?: number;
}

export interface IssueLineInput {
  material_id: number;
  /** In stock uom */
  quantity: number;
}

export interface ProductionEntryInput {
  work_order_id: number;
  operation_id: number;
  karigar_id: number | null;
  entry_date: string;
  shift: string;
  completed_quantity: number;
  rework_quantity: number;
  rejected_quantity: number;
  rejection_reason?: string | null;
  hours_worked?: number | null;
  notes?: string | null;
}

export interface ProductionEntry extends ProductionEntryInput {
  id: number;
  wo_number?: string;
  operation_code?: string;
  operation_name?: string;
  karigar_name?: string;
  sequence?: number;
  piece_rate?: number;
  /** completed_quantity x piece_rate */
  piece_wage?: number;
}

/** WIP sitting at one stage of a work order. */
export interface StageWip {
  operation_id: number;
  operation_code: string;
  operation_name: string;
  sequence: number;
  /** Units that have reached this stage (output of the previous stage) */
  available_to_work: number;
  completed: number;
  rejected: number;
  rework: number;
  /** Units finished at the previous stage but not yet at this one */
  wip: number;
  /** Days since the last entry at this stage; null if never worked */
  days_since_last_entry: number | null;
  is_stalled: boolean;
}

export interface KarigarWage {
  karigar_id: number;
  karigar_name: string;
  units_completed: number;
  units_rejected: number;
  piece_wage: number;
  hours_worked: number;
  /** Rejected as a share of everything produced */
  rejection_rate: number;
  /** Units per hour */
  output_per_hour: number | null;
}

/** Standard vs actual material consumption for a work order. */
export interface ConsumptionVarianceLine {
  material_id: number;
  material_code: string;
  material_name: string;
  stock_uom: string;
  standard_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_pct: number;
  rate: number;
  variance_value: number;
  is_overconsumption: boolean;
}
