/**
 * Sales, khata (credit) ledger, delivery, and the turnover watchdog.
 */

export type ConditionGrade =
  | "new_in_box"
  | "floor_model"
  | "open_box"
  | "minor_damage"
  | "as_is_clearance"
  | "customer_return";

export const CONDITION_LABELS: Record<ConditionGrade, string> = {
  new_in_box: "New in box",
  floor_model: "Floor model",
  open_box: "Open box",
  minor_damage: "Minor damage",
  as_is_clearance: "As-is clearance",
  customer_return: "Customer return",
};

/** Grades that may never be billed as new. */
export const NON_NEW_GRADES: ConditionGrade[] = [
  "floor_model", "open_box", "minor_damage", "as_is_clearance", "customer_return",
];

/** A physical, serial-tracked finished unit. */
export interface FinishedUnit {
  id: number;
  serial_no: string;
  product_id: number;
  product_name?: string;
  work_order_id: number | null;
  condition_grade: ConditionGrade;
  /** Actual production cost carried by this unit */
  cost: number;
  list_price: number;
  /** Cartons that make up this unit, and how many are present */
  carton_total: number;
  cartons_present: number;
  /** Date it went onto the showroom floor, if it did */
  floor_since: string | null;
  status: "available" | "soft_reserved" | "hard_reserved" | "sold" | "damaged";
  reserved_for_order_id: number | null;
  /** Soft holds lapse; hard holds do not */
  hold_expires_at: string | null;
  location: string | null;
  created_at: string;
}

export interface AtpResult {
  product_id: number;
  product_name: string;
  on_hand: number;
  soft_reserved: number;
  hard_reserved: number;
  damaged: number;
  /** Incomplete carton sets — physically present but not sellable */
  incomplete: number;
  in_production: number;
  /** Sellable right now */
  available_now: number;
  /** Available once current work orders finish */
  available_later: number;
  next_available_date: string | null;
}

// -----------------------------------------------------------------------------
// Delivery
// -----------------------------------------------------------------------------
export interface DeliveryZone {
  code: string;
  name: string;
  bengali_name: string;
  base_charge: number;
  vehicle: string;
  crew_size: number;
  /** Outside West Bengal — triggers a registration warning */
  outside_state: boolean;
}

/** Pre-set bands rather than free-text addresses. */
export const DELIVERY_ZONES: DeliveryZone[] = [
  { code: "BARASAT", name: "Barasat town / Champadali", bengali_name: "বারাসাত / চাঁপাডালি", base_charge: 250, vehicle: "Tempo", crew_size: 2, outside_state: false },
  { code: "MADHYAMGRAM", name: "Madhyamgram", bengali_name: "মধ্যমগ্রাম", base_charge: 350, vehicle: "Tempo", crew_size: 2, outside_state: false },
  { code: "NEWBARRACKPORE", name: "New Barrackpore", bengali_name: "নিউ ব্যারাকপুর", base_charge: 400, vehicle: "Tempo", crew_size: 2, outside_state: false },
  { code: "DUTTAPUKUR", name: "Duttapukur", bengali_name: "দত্তপুকুর", base_charge: 400, vehicle: "Tempo", crew_size: 2, outside_state: false },
  { code: "ASHOKNAGAR", name: "Ashoknagar–Habra", bengali_name: "অশোকনগর–হাবড়া", base_charge: 550, vehicle: "Pickup", crew_size: 3, outside_state: false },
  { code: "BARRACKPORE", name: "Barrackpore", bengali_name: "ব্যারাকপুর", base_charge: 500, vehicle: "Pickup", crew_size: 3, outside_state: false },
  { code: "RAJARHAT", name: "Rajarhat–New Town", bengali_name: "রাজারহাট–নিউ টাউন", base_charge: 650, vehicle: "Pickup", crew_size: 3, outside_state: false },
  { code: "SALTLAKE", name: "Salt Lake", bengali_name: "সল্ট লেক", base_charge: 650, vehicle: "Pickup", crew_size: 3, outside_state: false },
  { code: "KOLKATA", name: "Central Kolkata", bengali_name: "মধ্য কলকাতা", base_charge: 800, vehicle: "Truck", crew_size: 3, outside_state: false },
  { code: "OUTSIDE", name: "Outside the belt", bengali_name: "বেল্টের বাইরে", base_charge: 1200, vehicle: "Truck", crew_size: 4, outside_state: false },
  { code: "INTERSTATE", name: "Outside West Bengal", bengali_name: "পশ্চিমবঙ্গের বাইরে", base_charge: 2500, vehicle: "Truck", crew_size: 4, outside_state: true },
];

export interface DeliveryDetails {
  zone_code: string;
  floor: number;
  has_lift: boolean;
  /** Charge for carrying up stairs without a lift */
  floor_surcharge: number;
  base_charge: number;
  total_charge: number;
  vehicle: string;
  crew_size: number;
}

// -----------------------------------------------------------------------------
// Sales
// -----------------------------------------------------------------------------
export type SalesChannel = "walk_in" | "phone" | "referral" | "ecommerce";

export type OrderStatus =
  | "quote"          // soft hold
  | "confirmed"      // advance taken, hard hold
  | "in_production"
  | "ready"
  | "dispatched"
  | "delivered"
  | "cancelled";

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  zone_code: string | null;
  /** Present only for B2B buyers */
  gstin: string | null;
  state_code: string;
  created_at: string;
}

export interface SalesOrderLine {
  id: number;
  order_id: number;
  product_id: number;
  product_name?: string;
  finished_unit_id: number | null;
  serial_no?: string | null;
  condition_grade?: ConditionGrade;
  quantity: number;
  /** Composite price — delivery and assembly rolled in by default */
  unit_price: number;
  line_total: number;
  hsn_code: string | null;
  tax_rate: number;
  taxable_value: number | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  igst_amount: number | null;
  /** Actual production cost, for true margin */
  unit_cost: number;
}

export interface SalesOrder {
  id: number;
  order_number: string;
  /** cash_memo | bill_of_supply | tax_invoice — frozen at creation */
  document_type: string;
  /** Regime captured at creation; never re-read from the current flag */
  regime_at_sale: boolean;
  gstin_at_sale: string | null;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_gstin?: string | null;
  order_date: string;
  status: OrderStatus;
  channel: SalesChannel;

  zone_code: string | null;
  floor: number;
  has_lift: boolean;
  delivery_charge: number;
  /** TRUE when delivery/assembly are billed as separate lines rather than rolled in */
  services_itemised: boolean;

  subtotal: number;
  tax_total: number;
  grand_total: number;
  /** Advance or token taken at booking */
  advance_paid: number;
  balance_due: number;

  promised_date: string | null;
  notes: string | null;
  line_count?: number;
}

export interface SalesOrderInput {
  customer_id: number;
  order_date: string;
  channel: SalesChannel;
  zone_code: string | null;
  floor: number;
  has_lift: boolean;
  services_itemised: boolean;
  advance_paid: number;
  /**
   * TRUE only for a held quotation. Raising a bill is a sale — inferring
   * "quote" from a zero advance wrongly excluded counter sales from turnover.
   */
  is_quote?: boolean;
  promised_date?: string | null;
  notes?: string | null;
  lines: {
    product_id: number;
    finished_unit_id?: number | null;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    hsn_code?: string | null;
  }[];
}

/** A warning that could force GST registration regardless of turnover. */
export interface RegistrationTrigger {
  severity: "warning" | "blocking";
  code: string;
  message: string;
}

// -----------------------------------------------------------------------------
// Khata (running credit account)
// -----------------------------------------------------------------------------
export type PaymentMode = "cash" | "upi" | "card" | "bank" | "adjustment";

export interface KhataEntry {
  id: number;
  customer_id: number;
  customer_name?: string;
  order_id: number | null;
  order_number?: string | null;
  entry_date: string;
  /** Positive = customer owes more (a sale); negative = customer paid */
  amount: number;
  mode: PaymentMode | null;
  reference: string | null;
  notes: string | null;
  /** Running balance after this entry */
  balance?: number;
}

export interface KhataAccount {
  customer_id: number;
  customer_name: string;
  phone: string;
  total_billed: number;
  total_paid: number;
  balance: number;
  oldest_due_date: string | null;
  days_overdue: number;
  entry_count: number;
}

// -----------------------------------------------------------------------------
// Turnover watchdog
// -----------------------------------------------------------------------------
export type TurnoverBand = "safe" | "amber" | "red" | "blocking";

export interface TurnoverStatus {
  financial_year: string;
  /** Sales billed by this shop so far this FY */
  shop_turnover: number;
  /** Other businesses on the same PAN — aggregate turnover is PAN-wide */
  other_pan_turnover: number;
  aggregate_turnover: number;
  threshold: number;
  band: TurnoverBand;
  /** Straight-line run rate to year end */
  projected_year_end: number;
  /** Run rate adjusted for the festive concentration Oct–Dec */
  projected_seasonal: number;
  months_elapsed: number;
  headroom: number;
  message: string;
}

// -----------------------------------------------------------------------------
// Daily cash book
// -----------------------------------------------------------------------------
export interface CashBookRow {
  date: string;
  opening: number;
  cash_in: number;
  upi_in: number;
  other_in: number;
  total_in: number;
  closing: number;
}
