// =============================================================================
// Four Stock States Reconciliation & Inventory Intelligence (Sections 1, 4.1, 4.5)
// =============================================================================

import {
  RawMaterialItem,
  MaterialBatch,
  FinishedUnitSerial,
  UOMConversion,
} from "./types";

export interface FourStockStatesReconciliation {
  raw_material_store_value: number;
  raw_material_items_count: number;

  in_house_wip_value: number;
  in_house_wip_units_count: number;

  stock_with_vendor_value: number; // OUR ASSET! Never consumed on issue
  stock_with_vendor_items_count: number;

  finished_goods_value: number;
  finished_goods_units_count: number;

  total_enterprise_inventory_valuation: number;
}

export class InventoryStatesEngine {
  /**
   * Converts between purchase UOM, stock UOM, and consumption UOM
   */
  static convertUOM(
    quantity: number,
    fromType: "PURCHASE" | "STOCK" | "CONSUMPTION",
    toType: "PURCHASE" | "STOCK" | "CONSUMPTION",
    uom: UOMConversion
  ): number {
    if (fromType === toType) return quantity;

    // Standard conversion ratio: 1 purchase_uom = conversion_ratio consumption_uom
    if (fromType === "PURCHASE" && toType === "CONSUMPTION") {
      return quantity * uom.conversion_ratio;
    }
    if (fromType === "CONSUMPTION" && toType === "PURCHASE") {
      return quantity / uom.conversion_ratio;
    }
    // Assume stock_uom maps directly or via proportional ratio
    return quantity;
  }

  /**
   * Dye-Lot Safety Check
   * When reserving fabric or laminate for a single sofa or dining set,
   * warns if pulling from two distinct dye lots to prevent customer rejections.
   */
  static validateDyeLotAssignment(
    allocatedBatches: { batch: MaterialBatch; quantityToTake: number }[]
  ): {
    isValid: boolean;
    distinctDyeLots: string[];
    warningMessage?: string;
  } {
    const dyeLots = Array.from(
      new Set(
        allocatedBatches
          .map((b) => b.batch.dye_lot)
          .filter((lot): lot is string => Boolean(lot && lot.trim() !== ""))
      )
    );

    if (dyeLots.length > 1) {
      return {
        isValid: false,
        distinctDyeLots: dyeLots,
        warningMessage: `⚠️ DYE-LOT MISMATCH DETECTED: This requisition pulls from ${dyeLots.length} different dye lots (${dyeLots.join(
          ", "
        )}). Upholstering a single sofa set from mixed dye lots causes visible shade mismatch and guaranteed customer rejection!`,
      };
    }

    return {
      isValid: true,
      distinctDyeLots: dyeLots,
    };
  }

  /**
   * ATP (Available To Promise) Calculation
   * ATP = on hand − reserved − damaged + in-transit + in production (by date)
   */
  static calculateATP(params: {
    onHandUnits: number;
    hardReservedUnits: number;
    damagedUnits: number;
    inTransitUnits: number;
    inProductionUnits: number;
  }): {
    currentlyAvailable: number;
    totalProjectedATP: number;
    displayText: string;
  } {
    const currentlyAvailable = Math.max(
      0,
      params.onHandUnits - params.hardReservedUnits - params.damagedUnits
    );
    const totalProjectedATP =
      currentlyAvailable + params.inTransitUnits + params.inProductionUnits;

    return {
      currentlyAvailable,
      totalProjectedATP,
      displayText: `${currentlyAvailable} units ready in showroom/godown; ${totalProjectedATP} available including production pipeline`,
    };
  }

  /**
   * Multi-Carton Integrity Check
   * A sectional sofa or modular bed shipping in multiple boxes.
   * If any box is missing or damaged, the entire unit MUST automatically become unsellable.
   */
  static checkMultiCartonIntegrity(unit: FinishedUnitSerial): {
    isSellable: boolean;
    reason?: string;
  } {
    if (unit.missing_carton_flag) {
      return {
        isSellable: false,
        reason: `Blocked from retail sale: ${
          unit.missing_carton_notes || "Missing one or more required cartons/boxes."
        } Cannot sell incomplete set.`,
      };
    }

    if (unit.condition_grade === "MINOR_DAMAGE") {
      return {
        isSellable: true,
        reason: "Sellable only under As-Is Clearance / Floor Model Markdown (Condition: Minor Damage).",
      };
    }

    return { isSellable: true };
  }
}
