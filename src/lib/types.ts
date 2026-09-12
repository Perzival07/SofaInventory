// =============================================================================
// The Sofa Studio & Manufacturing Co. - Core Type Definitions
// Barasat, North 24 Parganas, West Bengal
// =============================================================================

export type LanguageCode = "en" | "bn";

// -----------------------------------------------------------------------------
// 1. Tax Regime & Statutory Configuration (Section 2)
// -----------------------------------------------------------------------------
export type TaxRegimeState = "UNREGISTERED" | "REGISTERED";
export type FilingFrequency = "monthly" | "quarterly";

export interface TaxConfig {
  tax_regime_enabled: boolean; // Flag controlling active regime
  registration_number: string | null; // GSTIN (e.g. 19AAAAA0000A1Z5)
  registration_date: string | null; // Effective date (YYYY-MM-DD)
  deregistration_date: string | null; // Optional cancellation date
  state_code: string; // Default "19" (West Bengal)
  state_name: string; // West Bengal
  composition_scheme: boolean;
  filing_frequency: FilingFrequency;
  legal_name: string;
  trade_name: string;
  principal_place_of_business: string;
}

export interface TaxRule {
  id: string;
  rule_name: string;
  description: string;
  threshold_amount: number;
  is_active: boolean;
}

export interface HSNCodeDefinition {
  hsn_code: string;
  description: string;
  default_gst_rate: number; // e.g. 18 for 18% (9% CGST + 9% SGST)
  category: string;
}

// -----------------------------------------------------------------------------
// 2. The 4 Stock States (Section 1)
// -----------------------------------------------------------------------------
export type StockState =
  | "RAW_MATERIAL"
  | "IN_HOUSE_WIP"
  | "STOCK_WITH_VENDOR"
  | "FINISHED_GOODS";

export type CostBasis = "GST_INCLUSIVE" | "NET_TAXABLE";

export interface FourStockStatesReconciliation {
  raw_material_store_value: number;
  raw_material_items_count: number;
  in_house_wip_value: number;
  in_house_wip_units_count: number;
  stock_with_vendor_value: number;
  stock_with_vendor_items_count: number;
  finished_goods_value: number;
  finished_goods_units_count: number;
  total_enterprise_inventory_valuation: number;
}

// -----------------------------------------------------------------------------
// 3. Raw Materials & Multi-UOM (Section 4.1)
// -----------------------------------------------------------------------------
export type MaterialCategory =
  | "TIMBER"
  | "SHEET_GOODS"
  | "VENEER_LAMINATE"
  | "FOAM"
  | "FABRIC_LEATHER"
  | "HARDWARE"
  | "CONSUMABLES"
  | "PACKING";

export interface UOMConversion {
  purchase_uom: string; // e.g. CFT, Sheet, Roll
  stock_uom: string; // e.g. CFT, Sheet, Metres
  consumption_uom: string; // e.g. Running Feet, Sq. Ft., Metres, Pieces
  conversion_ratio: number; // 1 purchase_uom = X consumption_uom
}

export interface TimberAttributes {
  species: "Sal" | "Segun (Teak)" | "Mehogini" | "Pine" | "Other";
  grade: "Grade A" | "Grade B" | "Commercial";
  moisture_pct: number; // e.g. 11.5%
  seasoning_date: string;
  kiln_batch_no: string;
  is_monsoon_quarantined?: boolean;
}

export interface SheetGoodsAttributes {
  board_type: "Plywood" | "MDF" | "Particle Board" | "Blockboard";
  thickness_mm: number; // 6, 9, 12, 16, 18, 25
  grade: "MR (Commercial)" | "BWR (Boiling Water Resistant)" | "BWP (Marine)";
  sheet_size: "8x4" | "7x4" | "6x4" | "6x3";
}

export interface FoamAttributes {
  density_kg_m3: number; // e.g. 28, 32, 40, 50
  thickness_mm: number;
  ild_rating?: string; // Indentation Load Deflection
}

export interface FabricAttributes {
  width_inches: number;
  gsm: number;
  shade: string;
  dye_lot: string; // Mandatory for upholstery matching
}

export interface RawMaterialItem {
  id: number;
  sku: string;
  name: string;
  category: MaterialCategory;
  uom: UOMConversion;
  current_stock: number; // In stock_uom
  allocated_to_wip: number;
  issued_to_vendors: number; // Stock with vendor
  available_free_stock: number;
  hsn_code: string;
  tax_rate: number; // e.g. 18
  reorder_level: number;
  current_cost_per_stock_uom: number; // Landed or Net depending on cost basis
  cost_basis: CostBasis;
  timber_attrs?: TimberAttributes;
  sheet_attrs?: SheetGoodsAttributes;
  foam_attrs?: FoamAttributes;
  fabric_attrs?: FabricAttributes;
  created_at: string;
}

export interface MaterialBatch {
  id: number;
  material_id: number;
  material_name: string;
  batch_number: string;
  dye_lot?: string;
  quantity_remaining: number;
  uom: string;
  unit_cost: number;
  cost_basis: CostBasis;
  supplier_name: string;
  supplier_invoice_ref: string;
  purchase_date: string;
  embedded_tax_amount: number; // For Section 18(1)(a) transitional credit claim
}

export interface OffcutScrapItem {
  id: number;
  material_id: number;
  material_name: string;
  material_type: "WOOD_OFFCUT" | "PLY_REMNANT" | "FABRIC_SCRAP" | "FOAM_OFFCUT";
  dimensions: string; // e.g. "4.5 ft x 8 inch" or "32 inch x 18 inch"
  quantity: number;
  approx_value: number;
  location: string;
  logged_date: string;
}

// -----------------------------------------------------------------------------
// 4. BOM, Routing & Dual Costing (Section 4.2)
// -----------------------------------------------------------------------------
export type ProductionStage =
  | "CUTTING"
  | "FRAME_ASSEMBLY"
  | "SANDING"
  | "FOAMING"
  | "UPHOLSTERY"
  | "POLISHING"
  | "HARDWARE_FITTING"
  | "QC_INSPECTION"
  | "PACKING";

export interface BOMMaterialLine {
  material_id: number;
  material_name: string;
  quantity: number;
  consumption_uom: string;
  standard_wastage_pct: number; // Standard yield buffer
  cost_per_unit: number;
  line_cost: number;
}

export interface BOMRoutingStep {
  stage: ProductionStage;
  standard_time_hours: number;
  labour_rate_per_hour_or_piece: number;
  is_outsourced: boolean;
  subcontract_rate?: number;
}

export interface BOMTemplate {
  id: number;
  product_id: number;
  product_name: string;
  version: string;
  effective_date: string;
  materials: BOMMaterialLine[];
  routing: BOMRoutingStep[];
  sub_assemblies: {
    name: string; // e.g. "Solid Timber Frame Sub-assembly", "High-resilience Cushion Set"
    materials: BOMMaterialLine[];
  }[];
  total_material_cost: number;
  total_labour_cost: number;
  overhead_cost: number;
  total_standard_cost: number;
}

// -----------------------------------------------------------------------------
// 5. In-House Production & WIP (Section 4.3)
// -----------------------------------------------------------------------------
export interface WorkOrder {
  id: number;
  wo_number: string;
  product_id: number;
  product_name: string;
  sales_order_id?: number | null; // Linked to made-to-order customer order
  quantity: number;
  target_completion_date: string;
  status: "DRAFT" | "MATERIAL_ISSUED" | "IN_PRODUCTION" | "QC_PASSED" | "COMPLETED";
  current_stage: ProductionStage;
  bom_id: number;
  created_at: string;
  actual_material_cost: number;
  actual_labour_cost: number;
}

export interface StageProductionLog {
  id: number;
  work_order_id: number;
  stage: ProductionStage;
  date: string;
  shift: "Morning" | "Evening";
  karigar_id: number;
  karigar_name: string;
  units_attempted: number;
  units_passed: number;
  units_rework: number;
  units_rejected: number;
  rework_reason?: string;
  rejection_reason?: string;
  piece_rate_earned: number;
  logged_at: string;
}

export interface KarigarMaster {
  id: number;
  name: string;
  specialty: "FRAME" | "UPHOLSTERY" | "POLISH" | "CARPENTRY" | "GENERAL";
  mobile_number: string;
  default_piece_rate: number;
  active_wip_units: number;
}

// -----------------------------------------------------------------------------
// 6. Job Work / Outsourced Manufacturing (Section 4.4)
// -----------------------------------------------------------------------------
export interface JobWorkVendor {
  id: number;
  trade_name: string;
  contact_person: string;
  phone: string;
  address: string;
  capabilities: ("POLISHING" | "UPHOLSTERY" | "CNC_CUTTING" | "FULL_UNIT")[];
  agreed_wastage_pct: number;
  quality_rating: number; // 1-5
  is_gst_registered: boolean;
  vendor_gstin?: string;
}

export interface JobWorkChallanLine {
  material_id: number;
  material_name: string;
  quantity_issued: number;
  uom: string;
  unit_value: number;
  total_value: number;
  hsn_code?: string;
  tax_rate?: number;
}

export interface JobWorkOrder {
  id: number;
  jwo_number: string;
  vendor_id: number;
  vendor_name: string;
  operation_type: "POLISHING" | "UPHOLSTERY" | "CNC_CUTTING" | "FRAME_WORK";
  target_item_description: string;
  quantity_expected: number;
  rate_per_unit: number;
  materials_issued: JobWorkChallanLine[];
  challan_number: string;
  challan_date: string;
  regime_at_creation: TaxRegimeState;
  due_date: string;
  statutory_return_deadline: string; // 1-yr rule for inputs
  status: "CHALLAN_ISSUED" | "MATERIAL_RECEIVED_BY_VENDOR" | "PARTIAL_RETURN" | "RECONCILED";
  quantity_received: number;
  scrap_returned_description?: string;
  actual_wastage_qty?: number;
  challan_pdf_url?: string;
}

// -----------------------------------------------------------------------------
// 7. Finished Goods, SKUs & Serials (Section 4.5)
// -----------------------------------------------------------------------------
export type ConditionGrade =
  | "NEW_IN_BOX"
  | "FLOOR_MODEL"
  | "OPEN_BOX"
  | "MINOR_DAMAGE"
  | "CLEARANCE"
  | "CUSTOMER_RETURN";

export interface Dimensions {
  assembled_length_cm: number;
  assembled_width_cm: number;
  assembled_height_cm: number;
  boxed_cubic_volume_cft: number;
  total_weight_kg: number;
  min_door_clearance_inches: number;
}

export interface FinishedGoodItem {
  id: number;
  name: string;
  category: string;
  sku: string;
  dimensions: Dimensions;
  carton_count: number; // e.g. 4 boxes for an L-shape sofa
  current_quantity: number;
  current_cost_per_unit: number; // Latest batch production/purchase cost
  total_value: number;
  selling_price: number;
  last_restocked_at: string;
  hsn_code: string;
  tax_rate: number;
  floor_model_count: number;
}

export interface FinishedUnitSerial {
  serial_no: string;
  product_id: number;
  product_name: string;
  condition_grade: ConditionGrade;
  is_floor_sample: boolean;
  floor_placement_date?: string;
  days_on_floor?: number;
  is_markdown_eligible?: boolean;
  missing_carton_flag: boolean;
  missing_carton_notes?: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD_DELIVERED" | "DAMAGED";
  location: "BARASAT_GODOWN" | "SHOWROOM_FLOOR" | "IN_TRANSIT";
  work_order_id?: number;
  created_at: string;
}

// -----------------------------------------------------------------------------
// 8. Sales, Billing & Khata Ledger (Section 4.6)
// -----------------------------------------------------------------------------
export type SalesDocumentType = "CASH_MEMO" | "TAX_INVOICE";
export type PaymentMode = "CASH" | "UPI" | "KHATA_CREDIT" | "SPLIT";

export interface SalesOrderLine {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number; // Composite price (includes delivery & assembly by default)
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  tax_rate?: number;
  hsn_code?: string;
  line_total: number;
  serial_numbers?: string[];
}

export interface SalesOrder {
  id: number;
  document_number: string; // CM-2026-0001 (Flag OFF) or INV-2026-0001 (Flag ON)
  document_type: SalesDocumentType;
  regime_at_creation: TaxRegimeState; // IMMUTABLE: Records regime at creation time
  order_date: string;
  customer_name: string;
  customer_phone: string;
  delivery_pincode: string;
  delivery_zone: string;
  floor_level: number;
  has_lift: boolean;
  floor_surcharge: number;
  payment_mode: PaymentMode;
  subtotal: number;
  taxable_total?: number;
  cgst_total?: number;
  sgst_total?: number;
  igst_total?: number;
  grand_total: number;
  amount_paid: number;
  khata_balance_due: number;
  status: "CONFIRMED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  lines: SalesOrderLine[];
  is_composite_priced: boolean;
  is_marketplace_order: boolean;
  created_at: string;
}

export interface KhataAccount {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_credit_granted: number;
  total_paid: number;
  current_balance: number;
  last_payment_date?: string;
  status: "ACTIVE" | "SETTLED" | "OVERDUE";
}

export interface KhataTransaction {
  id: number;
  khata_id: number;
  date: string;
  type: "DEBIT_PURCHASE" | "CREDIT_PAYMENT";
  amount: number;
  balance_after: number;
  reference_invoice: string;
  payment_mode?: "CASH" | "UPI";
  notes?: string;
}

// -----------------------------------------------------------------------------
// 9. Delivery Zones & Logistics (Section 4.7)
// -----------------------------------------------------------------------------
export interface DeliveryZone {
  id: string;
  name: string;
  bengali_name: string;
  default_charge: number;
  standard_crew_size: number;
  lead_time_days: number;
}

// -----------------------------------------------------------------------------
// 10. Turnover Watchdog & Local Intelligence (Sections 3 & 4.8)
// -----------------------------------------------------------------------------
export interface TurnoverWatchdogStatus {
  fy_label: string; // e.g. "FY 2026-27"
  shop_turnover: number;
  other_pan_businesses_turnover: number;
  aggregate_pan_turnover: number;
  threshold_limit: number; // ₹40,00,000 for WB Goods
  amber_alert_level: number; // ₹30,00,000
  red_alert_level: number; // ₹35,00,000
  blocking_alert_level: number; // ₹38,00,000
  status: "SAFE" | "AMBER_WARNING" | "RED_ALERT" | "BLOCKING_WARNING" | "EXCEEDED";
  projected_yearend_turnover: number;
  festival_season_uplift_pct: number;
  registration_triggers: {
    interstate_supply_attempted: boolean;
    ecommerce_order_detected: boolean;
    unbundled_services_billed: boolean;
  };
}

export interface MonsoonModeConfig {
  is_active: boolean;
  humidity_pct: number;
  timber_moisture_max_threshold: number; // Normally 12%, raised to 15% in monsoon
  polish_curing_extra_hours: number; // Added to scheduling
  adhesive_curing_extra_hours: number;
}

export interface LicenceReminder {
  id: string;
  licence_name: string;
  issuing_authority: string; // e.g. "Barasat Municipality", "WBFES"
  expiry_date: string;
  days_remaining: number;
  status: "VALID" | "RENEWAL_DUE" | "EXPIRED";
}

// -----------------------------------------------------------------------------
// 11. Transitional Credit Report (Section 2.3 Rule 5)
// -----------------------------------------------------------------------------
export interface TransitionalCreditItem {
  material_id: number;
  material_name: string;
  hsn_code: string;
  quantity_on_hand: number;
  uom: string;
  supplier_invoice_ref: string;
  supplier_name: string;
  purchase_date: string;
  gst_inclusive_unit_cost: number;
  tax_rate: number;
  eligible_input_tax_credit: number; // Section 18(1)(a) claimable ITC
}

export interface TransitionalCreditReport {
  generated_date: string;
  effective_registration_date: string;
  gstin: string;
  legal_name: string;
  total_stock_items_count: number;
  total_inventory_value_inclusive: number;
  total_claimable_itc: number;
  items: TransitionalCreditItem[];
}

// -----------------------------------------------------------------------------
// 12. Retail / Legacy Finished Goods Inventory Types
// -----------------------------------------------------------------------------
export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  current_quantity: number;
  current_cost_per_unit: number;
  total_value: number; // calculated: current_quantity * current_cost_per_unit
  last_restocked_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface RestockHistoryEntry {
  id: number;
  item_id: number;
  quantity_added: number;
  cost_per_unit: number;
  restock_date: string;
  note: string | null;
  created_at: string;
}

export interface AddItemInput {
  name: string;
  category: string;
  initial_quantity: number;
  initial_cost_per_unit: number;
  initial_note?: string;
}

export interface RestockInput {
  quantity_added: number;
  cost_per_unit: number;
  restock_date: string;
  note?: string;
}

export interface EditItemInput {
  name: string;
  category: string;
}

export interface InventorySummary {
  totalItems: number;
  totalStockUnits: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  categories: string[];
}

export const COMMON_CATEGORIES = [
  "All",
  "Sofa",
  "Recliner",
  "Dining Set",
  "Bed",
  "Sectional",
  "Accent Chair",
  "Coffee Table",
  "Wardrobe",
  "Office Chair",
  "Other",
] as const;

