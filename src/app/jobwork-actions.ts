"use server";

import { requireSession } from "@/lib/require-session";


import { revalidatePath } from "next/cache";
import {
  getJobWorkVendors, getJobWorkOrders, createJobWorkOrder, dispatchChallan,
  getChallans, getVendorStock, getChallanReconciliation, receiveJobWork,
  recordVendorInvoice, getThreeWayMatches, getVendorScorecards, getMakeVsBuy,
} from "@/lib/jobwork-db";
import { getMaterials, getProducts } from "@/lib/erp-db";
import { getWorkOrders } from "@/lib/production-db";
import { getCurrentRegime } from "@/lib/tax-db";
import {
  JobWorkVendor, JobWorkOrder, JobWorkOrderInput, JobWorkChallan, VendorStockLine,
  ChallanReconciliation, JobWorkReceiptInput, ThreeWayMatch, VendorScorecard,
  MakeVsBuyLine, ChallanLineInput, WastageAssessment,
} from "@/lib/jobwork-types";
import { Material, Product } from "@/lib/erp-types";
import { RegimeState } from "@/lib/tax-types";

export interface JobWorkPageData {
  vendors: JobWorkVendor[];
  orders: JobWorkOrder[];
  challans: JobWorkChallan[];
  vendorStock: VendorStockLine[];
  reconciliation: ChallanReconciliation[];
  matches: ThreeWayMatch[];
  scorecards: VendorScorecard[];
  makeVsBuy: MakeVsBuyLine[];
  materials: Material[];
  products: Product[];
  workOrders: { id: number; wo_number: string; product_name?: string }[];
  regime: RegimeState;
}

export async function fetchJobWorkPageDataAction(): Promise<JobWorkPageData> {
  await requireSession();
  const [
    vendors, orders, challans, vendorStock, reconciliation, matches,
    scorecards, mvb, materials, products, workOrders, regime,
  ] = await Promise.all([
    getJobWorkVendors(), getJobWorkOrders(), getChallans(), getVendorStock(),
    getChallanReconciliation(), getThreeWayMatches(), getVendorScorecards(),
    getMakeVsBuy(), getMaterials(), getProducts(), getWorkOrders(), getCurrentRegime(),
  ]);

  return {
    vendors, orders, challans, vendorStock, reconciliation, matches, scorecards,
    makeVsBuy: mvb, materials, products,
    workOrders: workOrders.map((w) => ({
      id: w.id, wo_number: w.wo_number, product_name: w.product_name,
    })),
    regime,
  };
}

export async function createJobWorkOrderAction(
  input: JobWorkOrderInput
): Promise<{ success: boolean; jwNumber?: string; error?: string }> {
  await requireSession();
  try {
    if (!input.vendor_id) return { success: false, error: "Select a vendor." };
    if (input.expected_output_qty <= 0) {
      return { success: false, error: "Expected output quantity must be at least 1." };
    }
    const order = await createJobWorkOrder(input);
    revalidatePath("/jobwork");
    return { success: true, jwNumber: order.jw_number };
  } catch (err) {
    console.error("Failed to create job work order:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create order" };
  }
}

export async function dispatchChallanAction(input: {
  jw_order_id: number;
  dispatch_date: string;
  lines: ChallanLineInput[];
}): Promise<{
  success: boolean; challanNumber?: string; challanType?: string;
  value?: number; ewayRequired?: boolean; ewayReason?: string | null;
  warnings?: string[]; error?: string;
}> {
  await requireSession();
  try {
    const lines = input.lines.filter((l) => l.quantity > 0);
    if (!lines.length) return { success: false, error: "Add at least one material to dispatch." };

    const { challan, warnings } = await dispatchChallan({ ...input, lines });

    revalidatePath("/jobwork");
    revalidatePath("/materials");
    return {
      success: true,
      challanNumber: challan.challan_number,
      challanType: challan.challan_type,
      value: challan.total_value,
      ewayRequired: challan.eway_bill_required,
      ewayReason: challan.eway_bill_exempt_reason,
      warnings,
    };
  } catch (err) {
    console.error("Failed to dispatch:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to dispatch" };
  }
}

export async function receiveJobWorkAction(
  input: JobWorkReceiptInput
): Promise<{
  success: boolean; wastage?: WastageAssessment[]; recovery?: number;
  warnings?: string[]; error?: string;
}> {
  await requireSession();
  try {
    if (input.good_qty < 0 || input.rejected_qty < 0) {
      return { success: false, error: "Quantities cannot be negative." };
    }
    if (input.good_qty + input.rejected_qty <= 0) {
      return { success: false, error: "Record at least one good or rejected unit." };
    }
    if (input.rejected_qty > 0 && !input.rejection_reason?.trim()) {
      return { success: false, error: "Rejected units need a reason." };
    }

    const { wastage, recovery, warnings } = await receiveJobWork(input);

    revalidatePath("/jobwork");
    revalidatePath("/materials");
    return { success: true, wastage, recovery, warnings };
  } catch (err) {
    console.error("Failed to receive job work:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to record receipt" };
  }
}

export async function recordVendorInvoiceAction(input: {
  jw_order_id: number; invoice_no: string; invoice_date: string;
  qty: number; rate: number; amount: number;
}): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    if (!input.invoice_no.trim()) return { success: false, error: "Invoice number is required." };
    await recordVendorInvoice(input);
    revalidatePath("/jobwork");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record invoice" };
  }
}
