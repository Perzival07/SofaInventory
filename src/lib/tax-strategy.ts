// =============================================================================
// Tax Strategy & Policy Engine (Section 2)
// Encapsulates the 6 areas governed by tax_config.tax_regime_enabled
// =============================================================================

import {
  TaxConfig,
  TaxRegimeState,
  SalesDocumentType,
  CostBasis,
  TransitionalCreditReport,
  TransitionalCreditItem,
  MaterialBatch,
  HSNCodeDefinition,
} from "./types";

// -----------------------------------------------------------------------------
// Default In-Memory Tax Configuration (OFF by default)
// -----------------------------------------------------------------------------
export let activeTaxConfig: TaxConfig = {
  tax_regime_enabled: false, // Dormant by default
  registration_number: null,
  registration_date: null,
  deregistration_date: null,
  state_code: "19", // West Bengal
  state_name: "West Bengal",
  composition_scheme: false,
  filing_frequency: "monthly",
  legal_name: "The Sofa Studio & Furniture Co.",
  trade_name: "The Sofa Studio",
  principal_place_of_business: "Barasat, North 24 Parganas, West Bengal - 700124",
};

export function getActiveTaxConfig(): TaxConfig {
  return { ...activeTaxConfig };
}

export function updateActiveTaxConfig(updates: Partial<TaxConfig>): TaxConfig {
  activeTaxConfig = {
    ...activeTaxConfig,
    ...updates,
  };
  return { ...activeTaxConfig };
}

// -----------------------------------------------------------------------------
// Pre-Seeded Common Furniture HSN Codes
// -----------------------------------------------------------------------------
export const COMMON_FURNITURE_HSN_CODES: HSNCodeDefinition[] = [
  {
    hsn_code: "9401",
    description: "Seats (sofas, recliners, chairs), whether or not convertible into beds",
    default_gst_rate: 18,
    category: "FINISHED_GOODS",
  },
  {
    hsn_code: "9403",
    description: "Other wooden furniture (beds, wardrobes, dining tables, cabinets)",
    default_gst_rate: 18,
    category: "FINISHED_GOODS",
  },
  {
    hsn_code: "9404",
    description: "Mattresses, cushions, upholstered supports",
    default_gst_rate: 18,
    category: "FINISHED_GOODS",
  },
  {
    hsn_code: "4407",
    description: "Wood sawn or chipped lengthwise (Sal, Segun, Teak, Pine timber)",
    default_gst_rate: 18,
    category: "RAW_MATERIAL",
  },
  {
    hsn_code: "4412",
    description: "Plywood, veneered panels and similar laminated wood (BWR, BWP, MR)",
    default_gst_rate: 18,
    category: "RAW_MATERIAL",
  },
  {
    hsn_code: "3921",
    description: "Polyurethane foam sheets & blocks (Cushioning & padding)",
    default_gst_rate: 18,
    category: "RAW_MATERIAL",
  },
  {
    hsn_code: "5407",
    description: "Woven fabrics of synthetic filament yarn (Velvet, chenille, linen blend)",
    default_gst_rate: 12,
    category: "RAW_MATERIAL",
  },
  {
    hsn_code: "8302",
    description: "Base metal mountings, fittings for furniture (hinges, telescopic channels)",
    default_gst_rate: 18,
    category: "HARDWARE",
  },
  {
    hsn_code: "3506",
    description: "Prepared glues and adhesives (wood adhesive, fevicol)",
    default_gst_rate: 18,
    category: "CONSUMABLES",
  },
  {
    hsn_code: "3208",
    description: "Paints, varnishes and lacquers (PU polish, melamine, thinner)",
    default_gst_rate: 18,
    category: "CONSUMABLES",
  },
];

// -----------------------------------------------------------------------------
// Strategy 1: Sales Document Policy
// -----------------------------------------------------------------------------
export interface SalesPricingCalculation {
  document_type: SalesDocumentType;
  numbering_prefix: string;
  regime_state: TaxRegimeState;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  grand_total: number;
  is_interstate: boolean;
}

export class SalesDocumentPolicy {
  static evaluate(
    price: number,
    destinationStateCode: string = "19",
    forcedRegimeState?: TaxRegimeState
  ): SalesPricingCalculation {
    const config = getActiveTaxConfig();
    // Use transaction's recorded regime if provided, otherwise check current config
    const isRegistered =
      forcedRegimeState !== undefined
        ? forcedRegimeState === "REGISTERED"
        : config.tax_regime_enabled;

    const isInterstate = destinationStateCode !== "19";

    if (!isRegistered) {
      // Flag OFF: Cash Memo / Bill of Supply. No tax columns.
      return {
        document_type: "CASH_MEMO",
        numbering_prefix: "CM-2026-",
        regime_state: "UNREGISTERED",
        taxable_value: price,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_tax: 0,
        grand_total: Math.round(price),
        is_interstate: isInterstate,
      };
    }

    // Flag ON: Statutory Tax Invoice with CGST/SGST or IGST split
    const gstRate = 18; // Standard furniture GST rate
    const taxableValue = Math.round((price / (1 + gstRate / 100)) * 100) / 100;
    const totalTax = Math.round((price - taxableValue) * 100) / 100;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterstate) {
      igst = totalTax;
    } else {
      cgst = Math.round((totalTax / 2) * 100) / 100;
      sgst = Math.round((totalTax - cgst) * 100) / 100;
    }

    return {
      document_type: "TAX_INVOICE",
      numbering_prefix: "INV-2026-",
      regime_state: "REGISTERED",
      taxable_value: taxableValue,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      total_tax: totalTax,
      grand_total: Math.round(taxableValue + totalTax),
      is_interstate: isInterstate,
    };
  }
}

// -----------------------------------------------------------------------------
// Strategy 2: Purchase Costing Policy
// -----------------------------------------------------------------------------
export interface PurchaseCostingResult {
  cost_basis: CostBasis;
  booked_item_cost: number;
  input_tax_credit_accrued: number;
  note: string;
}

export class PurchaseCostingPolicy {
  static evaluate(
    netTaxableValue: number,
    taxPaid: number,
    forcedRegimeState?: TaxRegimeState
  ): PurchaseCostingResult {
    const config = getActiveTaxConfig();
    const isRegistered =
      forcedRegimeState !== undefined
        ? forcedRegimeState === "REGISTERED"
        : config.tax_regime_enabled;

    if (!isRegistered) {
      // Flag OFF: GST-inclusive landed cost. Tax is unrecoverable expense.
      return {
        cost_basis: "GST_INCLUSIVE",
        booked_item_cost: netTaxableValue + taxPaid,
        input_tax_credit_accrued: 0,
        note: "Tax unrecoverable; added to item inventory landed cost.",
      };
    }

    // Flag ON: Net taxable value booked to inventory. Tax posted to ITC ledger.
    return {
      cost_basis: "NET_TAXABLE",
      booked_item_cost: netTaxableValue,
      input_tax_credit_accrued: taxPaid,
      note: "Net taxable cost booked to inventory; ₹" + taxPaid + " accrued to ITC ledger.",
    };
  }
}

// -----------------------------------------------------------------------------
// Strategy 3: Job Work Challan Policy
// -----------------------------------------------------------------------------
export interface JobWorkChallanMeta {
  challan_type: "INTERNAL_DELIVERY_CHALLAN" | "STATUTORY_RULE_45_CHALLAN";
  prefix: string;
  is_rule_45_compliant: boolean;
  statutory_return_deadline_months: number; // 12 months for inputs, 36 for capital goods
  e_way_bill_exempt: boolean;
  exemption_reason?: string;
}

export class JobWorkChallanPolicy {
  static evaluate(vendorStateCode: string = "19"): JobWorkChallanMeta {
    const config = getActiveTaxConfig();
    if (!config.tax_regime_enabled) {
      return {
        challan_type: "INTERNAL_DELIVERY_CHALLAN",
        prefix: "IDC-",
        is_rule_45_compliant: false,
        statutory_return_deadline_months: 12,
        e_way_bill_exempt: true,
        exemption_reason: "Unregistered internal inventory movement",
      };
    }

    // When registered: Intra-state West Bengal movement connected with job work is exempt!
    const isIntraStateWB = vendorStateCode === "19" && config.state_code === "19";

    return {
      challan_type: "STATUTORY_RULE_45_CHALLAN",
      prefix: "CH-R45-",
      is_rule_45_compliant: true,
      statutory_return_deadline_months: 12,
      e_way_bill_exempt: isIntraStateWB,
      exemption_reason: isIntraStateWB
        ? "Exempt under West Bengal intra-state job work notification (Principal <-> Job worker)"
        : undefined,
    };
  }
}

// -----------------------------------------------------------------------------
// Strategy 4: E-Way Bill Policy
// -----------------------------------------------------------------------------
export interface EWayBillRequirement {
  required: boolean;
  threshold: number;
  reason: string;
  warning_to_buyer?: string;
}

export class EWayBillPolicy {
  static evaluate(
    consignmentValue: number,
    destinationStateCode: string,
    isJobWorkMovement: boolean = false,
    buyerIsGstRegistered: boolean = false
  ): EWayBillRequirement {
    const config = getActiveTaxConfig();
    const threshold = 50000;

    if (!config.tax_regime_enabled) {
      if (buyerIsGstRegistered && consignmentValue >= threshold) {
        return {
          required: false,
          threshold,
          reason: "Shop is unregistered. The legal obligation to generate E-Way bill falls on the registered buyer.",
          warning_to_buyer:
            "Warning: As an unregistered seller, the registered recipient must generate an inward E-Way Bill under Rule 138.",
        };
      }
      return {
        required: false,
        threshold,
        reason: "Unregistered shop below statutory threshold",
      };
    }

    // Flag ON:
    if (isJobWorkMovement && destinationStateCode === "19") {
      return {
        required: false,
        threshold,
        reason: "Exempt: Intra-state West Bengal movement between principal and job worker",
      };
    }

    if (consignmentValue >= threshold) {
      return {
        required: true,
        threshold,
        reason: "Consignment value exceeds ₹50,000 threshold",
      };
    }

    return {
      required: false,
      threshold,
      reason: "Consignment value is under ₹50,000 threshold",
    };
  }
}

// -----------------------------------------------------------------------------
// Strategy 5: Transitional Credit Service (Section 2.3 Rule 5)
// Section 18(1)(a) allows claiming ITC on inputs held in stock on date of registration
// -----------------------------------------------------------------------------
export class TransitionalCreditService {
  static generateReport(stockBatches: MaterialBatch[]): TransitionalCreditReport {
    const config = getActiveTaxConfig();
    const today = new Date().toISOString().slice(0, 10);
    const regDate = config.registration_date || today;

    const eligibleItems: TransitionalCreditItem[] = stockBatches.map((batch) => {
      // If purchased under unregistered mode, embedded tax is approx 18% (standard rate)
      const taxRate = 18;
      const unitCost = batch.unit_cost;
      const taxablePortion = unitCost / (1 + taxRate / 100);
      const embeddedTaxPerUnit = unitCost - taxablePortion;
      const totalClaimableITC = Math.round(embeddedTaxPerUnit * batch.quantity_remaining);

      return {
        material_id: batch.material_id,
        material_name: batch.material_name,
        hsn_code: "4408", // Common lumber/timber/sheet HSN
        quantity_on_hand: batch.quantity_remaining,
        uom: batch.uom,
        supplier_invoice_ref: batch.supplier_invoice_ref || "INV-SUP-DEFAULT",
        supplier_name: batch.supplier_name || "Local Timber Merchant",
        purchase_date: batch.purchase_date,
        gst_inclusive_unit_cost: batch.unit_cost,
        tax_rate: taxRate,
        eligible_input_tax_credit: totalClaimableITC,
      };
    });

    const totalClaimable = eligibleItems.reduce((s, i) => s + i.eligible_input_tax_credit, 0);
    const totalValuation = eligibleItems.reduce(
      (s, i) => s + i.quantity_on_hand * i.gst_inclusive_unit_cost,
      0
    );

    return {
      generated_date: today,
      effective_registration_date: regDate,
      gstin: config.registration_number || "PENDING_REGISTRATION",
      legal_name: config.legal_name,
      total_stock_items_count: eligibleItems.length,
      total_inventory_value_inclusive: totalValuation,
      total_claimable_itc: totalClaimable,
      items: eligibleItems,
    };
  }
}
