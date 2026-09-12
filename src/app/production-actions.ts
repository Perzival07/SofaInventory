"use server";

import { revalidatePath } from "next/cache";
import {
  getOperations,
  getKarigars,
  getWorkOrders,
  createWorkOrder,
  checkAvailability,
  getWorkOrderOperations,
  issueMaterials,
  getIssuesForWorkOrder,
  recordProductionEntry,
  getProductionEntries,
  getStageWip,
  getKarigarWages,
  getConsumptionVariance,
} from "@/lib/production-db";
import { getProducts } from "@/lib/erp-db";
import {
  Operation, Karigar, WorkOrder, MaterialRequirement, StageWip,
  KarigarWage, ConsumptionVarianceLine, ProductionEntry, ProductionEntryInput,
  IssueLineInput, MaterialIssue,
} from "@/lib/production-types";
import { Product } from "@/lib/erp-types";

export interface ProductionPageData {
  workOrders: WorkOrder[];
  products: Product[];
  operations: Operation[];
  karigars: Karigar[];
  wages: KarigarWage[];
  recentEntries: ProductionEntry[];
}

export async function fetchProductionPageDataAction(): Promise<ProductionPageData> {
  const [workOrders, products, operations, karigars, wages, recentEntries] = await Promise.all([
    getWorkOrders(),
    getProducts(),
    getOperations(),
    getKarigars(),
    getKarigarWages(),
    getProductionEntries(),
  ]);
  return { workOrders, products, operations, karigars, wages, recentEntries: recentEntries.slice(0, 15) };
}

export async function checkAvailabilityAction(
  productId: number,
  quantity: number
): Promise<MaterialRequirement[]> {
  if (!productId || quantity <= 0) return [];
  return checkAvailability(productId, quantity);
}

export async function createWorkOrderAction(input: {
  product_id: number;
  quantity: number;
  source: "sales_order" | "forecast";
  order_date: string;
  due_date?: string | null;
  notes?: string | null;
}): Promise<{ success: boolean; woNumber?: string; shortages?: number; error?: string }> {
  try {
    if (!input.product_id) return { success: false, error: "Select a product." };
    if (input.quantity <= 0) return { success: false, error: "Quantity must be at least 1." };

    const { workOrder, requirements } = await createWorkOrder(input);
    const shortages = requirements.filter((r) => r.shortfall > 0).length;

    revalidatePath("/production");
    revalidatePath("/materials");
    return { success: true, woNumber: workOrder.wo_number, shortages };
  } catch (err) {
    console.error("Failed to create work order:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create work order" };
  }
}

export interface WorkOrderDetail {
  requirements: MaterialRequirement[];
  wip: StageWip[];
  issues: MaterialIssue[];
  variance: ConsumptionVarianceLine[];
  entries: ProductionEntry[];
}

export async function fetchWorkOrderDetailAction(woId: number): Promise<WorkOrderDetail> {
  const workOrders = await getWorkOrders();
  const wo = workOrders.find((w) => w.id === woId);

  const [requirements, wip, issues, variance, entries] = await Promise.all([
    wo ? checkAvailability(wo.product_id, wo.quantity, woId) : Promise.resolve([]),
    getStageWip(woId),
    getIssuesForWorkOrder(woId),
    getConsumptionVariance(woId),
    getProductionEntries(woId),
  ]);

  return { requirements, wip, issues, variance, entries };
}

export async function fetchWorkOrderOperationsAction(woId: number) {
  return getWorkOrderOperations(woId);
}

export async function issueMaterialsAction(input: {
  work_order_id: number;
  issue_date: string;
  issued_to?: string | null;
  lines: IssueLineInput[];
}): Promise<{ success: boolean; issueNumber?: string; warnings?: string[]; error?: string }> {
  try {
    const lines = input.lines.filter((l) => l.quantity > 0);
    if (!lines.length) return { success: false, error: "Enter a quantity on at least one line." };

    const { issue, warnings } = await issueMaterials({ ...input, lines });

    revalidatePath("/production");
    revalidatePath("/materials");
    return { success: true, issueNumber: issue.issue_number, warnings };
  } catch (err) {
    console.error("Failed to issue materials:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to issue materials" };
  }
}

export async function recordProductionAction(
  input: ProductionEntryInput
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!input.operation_id) return { success: false, error: "Select an operation." };
    if (input.completed_quantity < 0 || input.rejected_quantity < 0 || input.rework_quantity < 0) {
      return { success: false, error: "Quantities cannot be negative." };
    }
    if (input.completed_quantity + input.rejected_quantity + input.rework_quantity <= 0) {
      return { success: false, error: "Record at least one completed, rework or rejected unit." };
    }
    if (input.rejected_quantity > 0 && !input.rejection_reason?.trim()) {
      return { success: false, error: "Rejected units need a reason code." };
    }

    // Guard against booking more at a stage than the previous stage produced.
    const wip = await getStageWip(input.work_order_id);
    const stage = wip.find((w) => w.operation_id === input.operation_id);
    if (stage) {
      const booking = input.completed_quantity + input.rejected_quantity;
      if (booking > stage.wip + 0.0001) {
        return {
          success: false,
          error:
            `Only ${stage.wip} unit(s) are waiting at ${stage.operation_name}. ` +
            `Cannot book ${booking} — the previous stage has not produced them yet.`,
        };
      }
    }

    await recordProductionEntry(input);
    revalidatePath("/production");
    return { success: true };
  } catch (err) {
    console.error("Failed to record production:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to record production" };
  }
}
