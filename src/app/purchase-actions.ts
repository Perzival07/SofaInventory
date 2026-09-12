"use server";

import { requireSession } from "@/lib/require-session";


import { revalidatePath } from "next/cache";
import {
  getSuppliers,
  createSupplier,
  getPurchaseOrders,
  getPurchaseOrderLines,
  createPurchaseOrder,
  receiveGrn,
  getGrns,
  getPriceHistory,
} from "@/lib/purchase-db";
import { getMaterials } from "@/lib/erp-db";
import { getCurrentRegime } from "@/lib/tax-db";
import {
  Supplier,
  SupplierInput,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderInput,
  Grn,
  GrnInput,
  PostedGrn,
  PriceHistoryPoint,
} from "@/lib/purchase-types";
import { Material } from "@/lib/erp-types";
import { RegimeState } from "@/lib/tax-types";

export interface PurchasePageData {
  purchaseOrders: PurchaseOrder[];
  grns: Grn[];
  suppliers: Supplier[];
  materials: Material[];
  regime: RegimeState;
}

export async function fetchPurchasePageDataAction(): Promise<PurchasePageData> {
  await requireSession();
  const [purchaseOrders, grns, suppliers, materials, regime] = await Promise.all([
    getPurchaseOrders(),
    getGrns(),
    getSuppliers(),
    getMaterials(),
    getCurrentRegime(),
  ]);
  return { purchaseOrders, grns, suppliers, materials, regime };
}

export async function fetchPoLinesAction(poId: number): Promise<PurchaseOrderLine[]> {
  await requireSession();
  return getPurchaseOrderLines(poId);
}

export async function fetchPriceHistoryAction(materialId: number): Promise<PriceHistoryPoint[]> {
  await requireSession();
  return getPriceHistory(materialId);
}

export async function createSupplierAction(
  input: SupplierInput
): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
  await requireSession();
  try {
    if (!input.code.trim() || !input.name.trim()) {
      return { success: false, error: "Supplier code and name are required." };
    }
    const supplier = await createSupplier(input);
    revalidatePath("/purchases");
    return { success: true, supplier };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create supplier" };
  }
}

export async function createPurchaseOrderAction(
  input: PurchaseOrderInput
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    if (!input.supplier_id) return { success: false, error: "Select a supplier." };

    const validLines = input.lines.filter((l) => l.material_id && l.quantity > 0);
    if (!validLines.length) {
      return { success: false, error: "Add at least one line with a material and quantity." };
    }

    await createPurchaseOrder({ ...input, lines: validLines });
    revalidatePath("/purchases");
    return { success: true };
  } catch (err) {
    console.error("Failed to create PO:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create purchase order" };
  }
}

export async function receiveGrnAction(
  input: GrnInput
): Promise<{ success: boolean; posted?: PostedGrn; grnNumber?: string; error?: string }> {
  await requireSession();
  try {
    if (!input.supplier_id) return { success: false, error: "Select a supplier." };
    if (!input.receipt_date) return { success: false, error: "Receipt date is required." };

    const lines = input.lines.filter((l) => l.material_id && l.received_quantity > 0);
    if (!lines.length) {
      return { success: false, error: "Enter a received quantity on at least one line." };
    }

    for (const line of lines) {
      if (line.accepted_quantity + line.rejected_quantity > line.received_quantity + 0.0001) {
        return {
          success: false,
          error: "Accepted plus rejected quantity cannot exceed the quantity received.",
        };
      }
      if (line.accepted_quantity > 0 && !line.batch_no.trim()) {
        return { success: false, error: "Every accepted line needs a batch number." };
      }
      if (line.rejected_quantity > 0 && !line.rejection_reason?.trim()) {
        return { success: false, error: "Rejected quantity needs a reason code." };
      }
    }

    const { grn, posted } = await receiveGrn({ ...input, lines });

    revalidatePath("/purchases");
    revalidatePath("/materials");
    return { success: true, posted, grnNumber: grn.grn_number };
  } catch (err) {
    console.error("Failed to receive GRN:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to record goods receipt" };
  }
}
