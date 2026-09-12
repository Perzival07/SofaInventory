/**
 * Sales, delivery, khata and turnover logic — pure functions.
 *
 * The load-bearing rules here:
 *   - a unit with a missing carton is not sellable, however present it looks;
 *   - a floor model can never be billed as new;
 *   - the sales document type is decided by the regime on the ORDER DATE and
 *     frozen onto the order, so a 2026 cash memo still prints as one in 2030;
 *   - aggregate turnover is PAN-wide, not per shop, and a few situations force
 *     registration regardless of how far below the threshold the shop is.
 */

import { round2 } from "./tax-regime";
import { RegimeState } from "./tax-types";
import {
  AtpResult, ConditionGrade, DeliveryDetails, DELIVERY_ZONES, FinishedUnit,
  KhataAccount, KhataEntry, NON_NEW_GRADES, RegistrationTrigger, SalesChannel,
  TurnoverBand, TurnoverStatus,
} from "./sales-types";

/** How long a quote holds stock before the soft reservation lapses. */
export const SOFT_HOLD_HOURS = 48;
/** Days on the floor before a unit is flagged for markdown. */
export const FLOOR_MARKDOWN_DAYS = 90;

export function isSellable(unit: FinishedUnit): boolean {
  if (unit.status !== "available") return false;
  // A sectional shipping as 4 boxes is not a sofa if only 3 are on the floor.
  if (unit.cartons_present < unit.carton_total) return false;
  return true;
}

export function sellableReason(unit: FinishedUnit): string | null {
  if (unit.cartons_present < unit.carton_total) {
    return `Incomplete — ${unit.cartons_present} of ${unit.carton_total} cartons present`;
  }
  if (unit.status === "damaged") return "Marked damaged";
  if (unit.status === "sold") return "Already sold";
  if (unit.status === "soft_reserved") return "On a 48-hour quote hold";
  if (unit.status === "hard_reserved") return "Reserved against a confirmed order";
  return null;
}

/** A floor model or return must never leave as "new in box". */
export function canBillAsNew(grade: ConditionGrade): boolean {
  return !NON_NEW_GRADES.includes(grade);
}

export function daysOnFloor(floorSince: string | null, today: string): number {
  if (!floorSince) return 0;
  return Math.max(
    0,
    Math.round((new Date(today).getTime() - new Date(floorSince).getTime()) / 86400000)
  );
}

export function needsMarkdown(unit: FinishedUnit, today: string): boolean {
  if (unit.condition_grade !== "floor_model" || !unit.floor_since) return false;
  return daysOnFloor(unit.floor_since, today) >= FLOOR_MARKDOWN_DAYS;
}

/**
 * Available to promise.
 *
 * available_now deliberately excludes incomplete carton sets and anything held,
 * so a salesperson is never shown stock they cannot actually hand over.
 */
export function computeAtp(
  productId: number,
  productName: string,
  units: FinishedUnit[],
  inProduction: number,
  nextAvailableDate: string | null
): AtpResult {
  const mine = units.filter((u) => u.product_id === productId);

  const onHand = mine.filter((u) => u.status !== "sold").length;
  const softReserved = mine.filter((u) => u.status === "soft_reserved").length;
  const hardReserved = mine.filter((u) => u.status === "hard_reserved").length;
  const damaged = mine.filter((u) => u.status === "damaged").length;
  const incomplete = mine.filter(
    (u) => u.status === "available" && u.cartons_present < u.carton_total
  ).length;

  const availableNow = mine.filter(isSellable).length;

  return {
    product_id: productId,
    product_name: productName,
    on_hand: onHand,
    soft_reserved: softReserved,
    hard_reserved: hardReserved,
    damaged,
    incomplete,
    in_production: inProduction,
    available_now: availableNow,
    available_later: availableNow + inProduction,
    next_available_date: inProduction > 0 ? nextAvailableDate : null,
  };
}

/** Soft holds lapse after 48 hours; hard holds never do. */
export function isHoldExpired(unit: FinishedUnit, now: string): boolean {
  if (unit.status !== "soft_reserved" || !unit.hold_expires_at) return false;
  return new Date(unit.hold_expires_at).getTime() < new Date(now).getTime();
}

export function softHoldExpiry(from: string): string {
  const d = new Date(from);
  d.setHours(d.getHours() + SOFT_HOLD_HOURS);
  return d.toISOString();
}

// -----------------------------------------------------------------------------
// Delivery
// -----------------------------------------------------------------------------
/**
 * Third floor with no lift is constant in this housing stock, so it is captured
 * at order time rather than discovered by the crew on the doorstep.
 */
export function computeDelivery(
  zoneCode: string,
  floor: number,
  hasLift: boolean
): DeliveryDetails {
  const zone = DELIVERY_ZONES.find((z) => z.code === zoneCode) ?? DELIVERY_ZONES[0];

  // Ground and first floor carry no surcharge; above that, ₹150 per floor.
  const chargeableFloors = hasLift ? 0 : Math.max(0, floor - 1);
  const surcharge = chargeableFloors * 150;

  return {
    zone_code: zone.code,
    floor,
    has_lift: hasLift,
    floor_surcharge: surcharge,
    base_charge: zone.base_charge,
    total_charge: round2(zone.base_charge + surcharge),
    vehicle: zone.vehicle,
    crew_size: zone.crew_size,
  };
}

/** Vehicles are planned by cubic volume, not unit count. */
export function vehicleLoad(
  totalCubicFeet: number,
  vehicle: string
): { trips: number; capacity: number; utilisation_pct: number } {
  const capacities: Record<string, number> = { Tempo: 80, Pickup: 150, Truck: 350 };
  const capacity = capacities[vehicle] ?? 80;
  const trips = Math.max(1, Math.ceil(totalCubicFeet / capacity));
  return {
    trips,
    capacity,
    utilisation_pct: round2((totalCubicFeet / (capacity * trips)) * 100),
  };
}

// -----------------------------------------------------------------------------
// Registration triggers
// -----------------------------------------------------------------------------
/**
 * Situations that force registration regardless of turnover. These fire on the
 * order screen, not in a monthly report, because by then the supply has happened.
 */
export function registrationTriggers(args: {
  regime: RegimeState;
  zoneCode: string | null;
  channel: SalesChannel;
  servicesItemised: boolean;
  buyerGstin: string | null;
}): RegistrationTrigger[] {
  // Once registered, none of this is a warning any more.
  if (args.regime.registered) return [];

  const triggers: RegistrationTrigger[] = [];
  const zone = DELIVERY_ZONES.find((z) => z.code === args.zoneCode);

  if (zone?.outside_state) {
    triggers.push({
      severity: "blocking",
      code: "interstate_supply",
      message:
        "Delivery is outside West Bengal. Inter-state supply of goods requires GST " +
        "registration from the first rupee — the turnover threshold does not apply. Confirm with your CA before invoicing.",
    });
  }

  if (args.channel === "ecommerce") {
    triggers.push({
      severity: "blocking",
      code: "ecommerce_channel",
      message:
        "Sales through an e-commerce marketplace require registration regardless of turnover.",
    });
  }

  if (args.servicesItemised) {
    triggers.push({
      severity: "warning",
      code: "itemised_services",
      message:
        "Billing delivery or assembly as a separate line makes them a supply of services, " +
        "which carries a lower registration threshold than goods. The safe default is to " +
        "roll these into a single composite product price.",
    });
  }

  if (args.buyerGstin) {
    triggers.push({
      severity: "warning",
      code: "registered_buyer",
      message:
        "Buyer is GST-registered. No e-way bill is raised by an unregistered seller, but the " +
        "obligation may fall on the buyer as recipient.",
    });
  }

  return triggers;
}

// -----------------------------------------------------------------------------
// Turnover watchdog
// -----------------------------------------------------------------------------
/**
 * Seasonal weighting for a Bengali festive trade: roughly a third of the year's
 * business lands in the Durga Puja to Kali Puja window. A straight-line run rate
 * from a quiet monsoon quarter badly understates the year, and from a festive
 * quarter badly overstates it — so the projection is weighted by month.
 */
const MONTH_WEIGHTS: Record<number, number> = {
  3: 1.15,  // April — Poila Boishakh
  4: 0.85,  // May
  5: 0.7,   // June
  6: 0.6,   // July — monsoon
  7: 0.7,   // August
  8: 1.0,   // September
  9: 2.0,   // October — Durga Puja
  10: 1.8,  // November — Kali Puja, wedding season
  11: 1.3,  // December — Agrahayan weddings
  0: 1.1,   // January — Magh
  1: 1.2,   // February — Falgun weddings
  2: 0.9,   // March
};

/** Financial-year months in order, April (3) to March (2). */
const FY_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

export function seasonalProjection(
  turnoverSoFar: number,
  monthsElapsed: number
): number {
  if (monthsElapsed <= 0) return 0;
  const elapsed = FY_MONTHS.slice(0, Math.min(12, monthsElapsed));
  const remaining = FY_MONTHS.slice(Math.min(12, monthsElapsed));

  const elapsedWeight = elapsed.reduce((s, m) => s + (MONTH_WEIGHTS[m] ?? 1), 0);
  const remainingWeight = remaining.reduce((s, m) => s + (MONTH_WEIGHTS[m] ?? 1), 0);
  if (elapsedWeight === 0) return turnoverSoFar;

  const perWeight = turnoverSoFar / elapsedWeight;
  return round2(turnoverSoFar + perWeight * remainingWeight);
}

export function computeTurnoverStatus(args: {
  financial_year: string;
  shop_turnover: number;
  other_pan_turnover: number;
  threshold: number;
  amber: number;
  red: number;
  blocking: number;
  months_elapsed: number;
}): TurnoverStatus {
  const aggregate = round2(args.shop_turnover + args.other_pan_turnover);

  let band: TurnoverBand = "safe";
  if (aggregate >= args.blocking) band = "blocking";
  else if (aggregate >= args.red) band = "red";
  else if (aggregate >= args.amber) band = "amber";

  const straightLine =
    args.months_elapsed > 0
      ? round2((aggregate / args.months_elapsed) * 12)
      : 0;

  // Only the shop's own trade is seasonal; other-PAN turnover is added flat.
  const seasonal = round2(
    seasonalProjection(args.shop_turnover, args.months_elapsed) + args.other_pan_turnover
  );

  const messages: Record<TurnoverBand, string> = {
    safe: "Comfortably below the registration threshold.",
    amber: "Approaching the threshold. Start planning for registration.",
    red: "Close to the threshold. Speak to your CA about registering now.",
    blocking: "At the threshold. Registration is likely already required — act immediately.",
  };

  let message = messages[band];
  // Warn against the blocking band, not the threshold itself. A projection of
  // ₹39.9L against a ₹40L threshold is not "safe" — by the time the shortfall
  // is that small there is no time left to prepare for registration.
  if (band !== "blocking" && seasonal >= args.blocking) {
    message +=
      ` Projected festive-season trade reaches ${Math.round(seasonal).toLocaleString("en-IN")}` +
      ` before year end, which would cross the threshold.`;
  }

  return {
    financial_year: args.financial_year,
    shop_turnover: round2(args.shop_turnover),
    other_pan_turnover: round2(args.other_pan_turnover),
    aggregate_turnover: aggregate,
    threshold: args.threshold,
    band,
    projected_year_end: straightLine,
    projected_seasonal: seasonal,
    months_elapsed: args.months_elapsed,
    headroom: round2(args.threshold - aggregate),
    message,
  };
}

/** Months elapsed in the financial year containing `date`, April = 1. */
export function fyMonthsElapsed(date: string): number {
  const d = new Date(date);
  const m = d.getMonth();
  return m >= 3 ? m - 3 + 1 : m + 9 + 1;
}

// -----------------------------------------------------------------------------
// Khata
// -----------------------------------------------------------------------------
/**
 * A running credit account. Entries are chronological; a sale increases the
 * balance and a payment reduces it. The balance is derived, never stored, so it
 * cannot drift from the entries that justify it.
 */
export function computeKhataBalance(entries: KhataEntry[]): KhataEntry[] {
  const sorted = [...entries].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.id - b.id
  );
  let running = 0;
  return sorted.map((e) => {
    running = round2(running + e.amount);
    return { ...e, balance: running };
  });
}

export function summariseKhata(
  customerId: number,
  customerName: string,
  phone: string,
  entries: KhataEntry[],
  today: string
): KhataAccount {
  const mine = entries.filter((e) => e.customer_id === customerId);
  const billed = round2(mine.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0));
  const paid = round2(Math.abs(mine.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0)));
  const balance = round2(billed - paid);

  // The oldest unpaid charge, found by walking payments against charges FIFO.
  let remaining = paid;
  let oldestDue: string | null = null;
  for (const e of mine.filter((x) => x.amount > 0).sort((a, b) => a.entry_date.localeCompare(b.entry_date))) {
    if (remaining >= e.amount) {
      remaining = round2(remaining - e.amount);
      continue;
    }
    oldestDue = e.entry_date;
    break;
  }

  return {
    customer_id: customerId,
    customer_name: customerName,
    phone,
    total_billed: billed,
    total_paid: paid,
    balance,
    oldest_due_date: balance > 0 ? oldestDue : null,
    days_overdue:
      balance > 0 && oldestDue
        ? Math.max(0, Math.round((new Date(today).getTime() - new Date(oldestDue).getTime()) / 86400000))
        : 0,
    entry_count: mine.length,
  };
}

// -----------------------------------------------------------------------------
// Order pricing
// -----------------------------------------------------------------------------
export interface PricedOrder {
  document_type: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  balance_due: number;
  lines: {
    product_id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
    taxable_value: number | null;
    tax_rate: number;
    cgst_amount: number | null;
    sgst_amount: number | null;
    igst_amount: number | null;
  }[];
}

/**
 * Price an order under the regime in force on its own date.
 *
 * Unregistered: the price the customer sees IS the total. No tax lines exist.
 * Registered: the same price is treated as tax-inclusive and broken out, so the
 * customer-facing figure does not jump the day the shop registers.
 */
export function priceOrder(
  lines: { product_id: number; quantity: number; unit_price: number; tax_rate: number }[],
  deliveryCharge: number,
  advancePaid: number,
  regime: RegimeState,
  buyerStateCode: string
): PricedOrder {
  const priced = lines.map((l) => {
    const lineTotal = round2(l.quantity * l.unit_price);

    if (!regime.registered || regime.composition_scheme) {
      return {
        ...l, line_total: lineTotal,
        taxable_value: null, cgst_amount: null, sgst_amount: null, igst_amount: null,
      };
    }

    const taxable = round2(lineTotal / (1 + l.tax_rate / 100));
    const tax = round2(lineTotal - taxable);
    const interstate = buyerStateCode !== regime.state_code;
    const half = round2(tax / 2);

    return {
      ...l,
      line_total: lineTotal,
      taxable_value: taxable,
      cgst_amount: interstate ? 0 : round2(tax - half),
      sgst_amount: interstate ? 0 : half,
      igst_amount: interstate ? tax : 0,
    };
  });

  const subtotal = round2(priced.reduce((s, l) => s + l.line_total, 0) + deliveryCharge);
  const taxTotal = round2(
    priced.reduce(
      (s, l) => s + (l.cgst_amount ?? 0) + (l.sgst_amount ?? 0) + (l.igst_amount ?? 0),
      0
    )
  );

  return {
    document_type: regime.sales_document_type,
    subtotal,
    tax_total: taxTotal,
    grand_total: subtotal,
    balance_due: round2(subtotal - advancePaid),
    lines: priced,
  };
}
