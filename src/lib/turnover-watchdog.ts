// =============================================================================
// Turnover Watchdog & Registration Trigger Engine (Section 3)
// Monitors aggregate PAN turnover against the ₹40 Lakh goods exemption threshold
// =============================================================================

import { TurnoverWatchdogStatus } from "./types";

let externalPanTurnover = 450000; // Default sample from another small business on same PAN

export function getExternalPanTurnover(): number {
  return externalPanTurnover;
}

export function setExternalPanTurnover(amount: number): number {
  externalPanTurnover = Math.max(0, amount);
  return externalPanTurnover;
}

/**
 * Evaluates current turnover against statutory limits and computes festive projections
 */
export function calculateTurnoverStatus(
  currentShopSalesTurnover: number,
  otherPanTurnover: number = externalPanTurnover
): TurnoverWatchdogStatus {
  const thresholdLimit = 4000000; // ₹40 Lakhs (West Bengal Goods Threshold)
  const amberLevel = 3000000; // ₹30 Lakhs
  const redLevel = 3500000; // ₹35 Lakhs
  const blockingLevel = 3800000; // ₹38 Lakhs

  const aggregatePanTurnover = currentShopSalesTurnover + otherPanTurnover;

  let status: TurnoverWatchdogStatus["status"] = "SAFE";
  if (aggregatePanTurnover >= thresholdLimit) {
    status = "EXCEEDED";
  } else if (aggregatePanTurnover >= blockingLevel) {
    status = "BLOCKING_WARNING";
  } else if (aggregatePanTurnover >= redLevel) {
    status = "RED_ALERT";
  } else if (aggregatePanTurnover >= amberLevel) {
    status = "AMBER_WARNING";
  }

  // Bengali Calendar Seasonal Uplift Calculation:
  // In Bengal, Q3 (Durga Puja, Kali Puja, Diwali) and wedding season (Agrahayan, Magh)
  // historically see a 40-50% surge in furniture retail.
  const festiveSeasonUpliftPct = 45;
  const daysInYear = 365;
  const currentDayOfYear = 160; // Prototypical mid-year calculation
  const simpleRunRate = (aggregatePanTurnover / currentDayOfYear) * daysInYear;
  // Apply seasonal festive weighting
  const projectedTurnover = Math.round(simpleRunRate * (1 + festiveSeasonUpliftPct / 200));

  return {
    fy_label: "FY 2026-27",
    shop_turnover: currentShopSalesTurnover,
    other_pan_businesses_turnover: otherPanTurnover,
    aggregate_pan_turnover: aggregatePanTurnover,
    threshold_limit: thresholdLimit,
    amber_alert_level: amberLevel,
    red_alert_level: redLevel,
    blocking_alert_level: blockingLevel,
    status,
    projected_yearend_turnover: projectedTurnover,
    festival_season_uplift_pct: festiveSeasonUpliftPct,
    registration_triggers: {
      interstate_supply_attempted: false,
      ecommerce_order_detected: false,
      unbundled_services_billed: false,
    },
  };
}

/**
 * Hard validation warnings on the sales screen that trigger mandatory GST registration
 * regardless of turnover under Section 24 of the CGST Act.
 */
export interface RegistrationTriggerValidation {
  hasBlockingTrigger: boolean;
  warnings: {
    code: "INTERSTATE_SUPPLY" | "ECOMMERCE_MARKETPLACE" | "ITEMIZED_SERVICES";
    title: string;
    message: string;
    severity: "BLOCKING" | "CRITICAL_WARNING";
  }[];
}

export function validateSalesRegistrationTriggers(params: {
  deliveryPincode: string;
  isMarketplaceOrder: boolean;
  hasSeparateServiceCharges: boolean;
}): RegistrationTriggerValidation {
  const warnings: RegistrationTriggerValidation["warnings"] = [];

  // 1. Check Interstate Supply (West Bengal pincodes begin with 70 to 74)
  const pin = params.deliveryPincode.trim();
  const isWestBengal = pin.length === 6 && (pin.startsWith("70") || pin.startsWith("71") || pin.startsWith("72") || pin.startsWith("73") || pin.startsWith("74"));

  if (!isWestBengal && pin.length === 6) {
    warnings.push({
      code: "INTERSTATE_SUPPLY",
      title: "Interstate Supply Trigger (Section 24)",
      message:
        `Delivery Pincode ${pin} is outside West Bengal. Under Section 24(i) of the CGST Act, making ANY interstate taxable supply of goods revokes the ₹40 Lakh exemption and mandates IMMEDIATE compulsory GST registration before dispatch.`,
      severity: "BLOCKING",
    });
  }

  // 2. Check E-Commerce Marketplace Channel
  if (params.isMarketplaceOrder) {
    warnings.push({
      code: "ECOMMERCE_MARKETPLACE",
      title: "E-Commerce Operator Supply Trigger (Section 24)",
      message:
        "Selling furniture through an e-commerce operator requiring TCS (e.g. Amazon, Flipkart, Pepperfry) revokes the threshold exemption and requires mandatory GST registration.",
      severity: "BLOCKING",
    });
  }

  // 3. Separate Service Charges (Assembly, Delivery, Polishing)
  if (params.hasSeparateServiceCharges) {
    warnings.push({
      code: "ITEMIZED_SERVICES",
      title: "Mixed / Separate Service Charge Risk (Lower ₹20L Threshold)",
      message:
        "Itemising delivery, assembly, or repair charges as separate line items may classify this as a supply of services, pulling the business down to the much lower ₹20 Lakh service threshold! Recommendation: Keep pricing composite (all delivery and installation included in sofa/furniture unit price).",
      severity: "CRITICAL_WARNING",
    });
  }

  return {
    hasBlockingTrigger: warnings.some((w) => w.severity === "BLOCKING"),
    warnings,
  };
}
