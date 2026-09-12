// =============================================================================
// Unified Dual-Costing Engine & Make-vs-Buy Analyzer (Sections 4.2 & 4.4)
// =============================================================================

import { BOMTemplate, CostBasis } from "./types";
import { getActiveTaxConfig } from "./tax-strategy";

export interface MakeVsBuyAnalysis {
  item_name: string;
  in_house_material_cost: number;
  in_house_labour_cost: number;
  in_house_overhead_cost: number;
  total_in_house_cost: number;

  vendor_base_charge: number;
  vendor_gst_rate: number; // 18% on job work
  vendor_tax_amount: number;
  unrecoverable_tax_cost: number; // >0 if tax_regime_enabled is false!
  creditable_tax_amount: number; // >0 if tax_regime_enabled is true
  total_vendor_effective_cost: number;

  cost_difference: number; // Positive means in-house is cheaper
  recommendation: "MAKE_IN_HOUSE" | "OUTSOURCE_JOB_WORK";
  regime_impact_explanation: string;
}

export class CostingEngine {
  /**
   * Computes standard BOM cost roll-up under current active cost basis
   */
  static calculateBOMCostRollup(bom: BOMTemplate): {
    total_material_cost: number;
    total_labour_cost: number;
    total_overhead_cost: number;
    total_cost: number;
    cost_basis: CostBasis;
  } {
    const config = getActiveTaxConfig();
    const costBasis: CostBasis = config.tax_regime_enabled ? "NET_TAXABLE" : "GST_INCLUSIVE";

    const materialCost = bom.materials.reduce((sum, item) => {
      // Apply standard wastage buffer
      const effectiveQty = item.quantity * (1 + item.standard_wastage_pct / 100);
      return sum + effectiveQty * item.cost_per_unit;
    }, 0);

    const labourCost = bom.routing.reduce((sum, step) => {
      return sum + step.standard_time_hours * step.labour_rate_per_hour_or_piece;
    }, 0);

    const overheadCost = Math.round((materialCost + labourCost) * 0.08); // 8% factory power, shop floor rent, consumable allocation
    const totalCost = Math.round(materialCost + labourCost + overheadCost);

    return {
      total_material_cost: Math.round(materialCost),
      total_labour_cost: Math.round(labourCost),
      total_overhead_cost: overheadCost,
      total_cost: totalCost,
      cost_basis: costBasis,
    };
  }

  /**
   * Make-vs-Buy Comparison
   * Evaluates in-house manufacturing vs outsourcing to local Barasat job work karigars
   * Factors in GST on vendor labor (unrecoverable cost when flag is OFF vs creditable when ON!)
   */
  static evaluateMakeVsBuy(params: {
    itemName: string;
    inHouseMaterialCost: number;
    inHouseLabourCost: number;
    inHouseOverheadCost: number;
    vendorLabourCharge: number;
    vendorGstRegistered: boolean;
  }): MakeVsBuyAnalysis {
    const config = getActiveTaxConfig();
    const isTaxEnabled = config.tax_regime_enabled;

    const totalInHouseCost =
      params.inHouseMaterialCost + params.inHouseLabourCost + params.inHouseOverheadCost;

    const vendorGstRate = params.vendorGstRegistered ? 18 : 0;
    const vendorTaxAmount = Math.round((params.vendorLabourCharge * vendorGstRate) / 100);

    // CRITICAL: When the tax flag is OFF, a registered vendor's 18% GST is an UNRECOVERABLE cost to us!
    // When the tax flag is ON, that 18% GST is claimed back via ITC and does not increase cost!
    const unrecoverableTax = isTaxEnabled ? 0 : vendorTaxAmount;
    const creditableTax = isTaxEnabled ? vendorTaxAmount : 0;

    // Vendor effective cost includes our material (issued as our asset) + vendor charge + any unrecoverable tax
    const totalVendorEffectiveCost =
      params.inHouseMaterialCost + params.vendorLabourCharge + unrecoverableTax;

    const costDiff = totalVendorEffectiveCost - totalInHouseCost;
    const recommendation = costDiff >= 0 ? "MAKE_IN_HOUSE" : "OUTSOURCE_JOB_WORK";

    let explanation = "";
    if (!isTaxEnabled) {
      explanation = `Tax regime is OFF. The job worker's 18% GST (₹${vendorTaxAmount}) is an unrecoverable business expense and makes outsourcing more expensive. In-house cost: ₹${totalInHouseCost}, Outsource cost: ₹${totalVendorEffectiveCost}.`;
    } else {
      explanation = `Tax regime is ON. The job worker's 18% GST (₹${vendorTaxAmount}) is fully creditable as ITC. Effective outsource cost is reduced to ₹${totalVendorEffectiveCost}.`;
    }

    return {
      item_name: params.itemName,
      in_house_material_cost: params.inHouseMaterialCost,
      in_house_labour_cost: params.inHouseLabourCost,
      in_house_overhead_cost: params.inHouseOverheadCost,
      total_in_house_cost: totalInHouseCost,
      vendor_base_charge: params.vendorLabourCharge,
      vendor_gst_rate: vendorGstRate,
      vendor_tax_amount: vendorTaxAmount,
      unrecoverable_tax_cost: unrecoverableTax,
      creditable_tax_amount: creditableTax,
      total_vendor_effective_cost: totalVendorEffectiveCost,
      cost_difference: costDiff,
      recommendation,
      regime_impact_explanation: explanation,
    };
  }
}
