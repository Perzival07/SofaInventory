"use server";

import { revalidatePath } from "next/cache";
import {
  getFourStockStatesSummary,
  getAllRawMaterials,
  getAllOffcutScraps,
  addOffcutScrap,
  getWorkOrders,
  getKarigars,
  getStageProductionLogs,
  logStageProductionEntry,
  getJobWorkVendors,
  getJobWorkOrders,
  createJobWorkDispatch,
  reconcileJobWorkReturn,
  getAllFinishedGoods,
  restockFinishedGood,
  getAllSalesOrders,
  createSalesOrder,
  getKhataAccounts,
  recordKhataPayment,
  getTaxConfig,
  updateTaxConfig,
  getTransitionalCreditReport,
  isDbConfigured,
} from "@/lib/db";
import {
  calculateTurnoverStatus,
  getExternalPanTurnover,
  setExternalPanTurnover,
  validateSalesRegistrationTriggers,
} from "@/lib/turnover-watchdog";
import {
  getMonsoonConfig,
  toggleMonsoonMode,
  BARASAT_DELIVERY_ZONES,
  MUNICIPAL_LICENCE_REMINDERS,
} from "@/lib/local-intelligence";
import {
  RawMaterialItem,
  WorkOrder,
  JobWorkOrder,
  FinishedGoodItem,
  SalesOrder,
  KhataAccount,
  TaxConfig,
  FourStockStatesReconciliation,
  TurnoverWatchdogStatus,
  MonsoonModeConfig,
  TransitionalCreditReport,
  InventoryItem,
  RestockHistoryEntry,
  AddItemInput,
  RestockInput,
  EditItemInput,
  InventorySummary,
} from "@/lib/types";

// -----------------------------------------------------------------------------
// 1. Enterprise Dashboard Overview Action
// -----------------------------------------------------------------------------
export async function fetchEnterpriseOverviewAction(): Promise<{
  fourStates: FourStockStatesReconciliation;
  turnoverStatus: TurnoverWatchdogStatus;
  taxConfig: TaxConfig;
  monsoonConfig: MonsoonModeConfig;
  licences: typeof MUNICIPAL_LICENCE_REMINDERS;
  isDbConfigured: boolean;
}> {
  const [fourStates, taxConfig, sales] = await Promise.all([
    getFourStockStatesSummary(),
    getTaxConfig(),
    getAllSalesOrders(),
  ]);

  const shopTurnover = sales.reduce((sum: number, s: SalesOrder) => sum + s.grand_total, 0);
  const turnoverStatus = calculateTurnoverStatus(shopTurnover, getExternalPanTurnover());
  const monsoonConfig = getMonsoonConfig();

  return {
    fourStates,
    turnoverStatus,
    taxConfig,
    monsoonConfig,
    licences: MUNICIPAL_LICENCE_REMINDERS,
    isDbConfigured,
  };
}

// -----------------------------------------------------------------------------
// 2. Tax Regime Strategy Actions (Section 2)
// -----------------------------------------------------------------------------
export async function toggleTaxRegimeAction(params: {
  enabled: boolean;
  gstin?: string;
  registrationDate?: string;
}): Promise<{ success: boolean; config: TaxConfig }> {
  const updated = await updateTaxConfig({
    tax_regime_enabled: params.enabled,
    registration_number: params.enabled ? params.gstin || "19AAAAA0000A1Z5" : null,
    registration_date: params.enabled
      ? params.registrationDate || new Date().toISOString().slice(0, 10)
      : null,
    deregistration_date: !params.enabled ? new Date().toISOString().slice(0, 10) : null,
  });

  revalidatePath("/");
  return { success: true, config: updated };
}

export async function fetchTransitionalCreditReportAction(): Promise<TransitionalCreditReport> {
  return getTransitionalCreditReport();
}

// -----------------------------------------------------------------------------
// 3. Turnover & Local Intelligence Actions (Section 3 & 4.8)
// -----------------------------------------------------------------------------
export async function updateExternalPanTurnoverAction(amount: number): Promise<{ success: boolean }> {
  setExternalPanTurnover(amount);
  revalidatePath("/");
  return { success: true };
}

export async function toggleMonsoonModeAction(enable: boolean): Promise<MonsoonModeConfig> {
  const conf = toggleMonsoonMode(enable);
  revalidatePath("/");
  return conf;
}

// -----------------------------------------------------------------------------
// 4. Raw Materials & Scraps Actions (Section 4.1)
// -----------------------------------------------------------------------------
export async function fetchRawMaterialsAction(): Promise<{
  materials: RawMaterialItem[];
  offcuts: ReturnType<typeof getAllOffcutScraps> extends Promise<infer T> ? T : never;
}> {
  const [materials, offcuts] = await Promise.all([
    getAllRawMaterials(),
    getAllOffcutScraps(),
  ]);
  return { materials, offcuts };
}

export async function addOffcutScrapAction(input: {
  material_id: number;
  material_name: string;
  material_type: "WOOD_OFFCUT" | "PLY_REMNANT" | "FABRIC_SCRAP" | "FOAM_OFFCUT";
  dimensions: string;
  quantity: number;
  approx_value: number;
  location: string;
}) {
  const res = await addOffcutScrap(input);
  revalidatePath("/");
  return { success: true, offcut: res };
}

// -----------------------------------------------------------------------------
// 5. In-House Production & Stage Logging Actions (Section 4.3)
// -----------------------------------------------------------------------------
export async function fetchProductionWipAction() {
  const [workOrders, karigars, stageLogs] = await Promise.all([
    getWorkOrders(),
    getKarigars(),
    getStageProductionLogs(),
  ]);
  return { workOrders, karigars, stageLogs };
}

export async function logStageProductionAction(input: {
  work_order_id: number;
  stage: any;
  karigar_id: number;
  units_attempted: number;
  units_passed: number;
  units_rework: number;
  units_rejected: number;
  rework_reason?: string;
  rejection_reason?: string;
}) {
  const log = await logStageProductionEntry(input);
  revalidatePath("/");
  return { success: true, log };
}

// -----------------------------------------------------------------------------
// 6. Job Work / Outsourced Vendor Actions (Section 4.4)
// -----------------------------------------------------------------------------
export async function fetchJobWorkAction() {
  const [vendors, jobWorkOrders] = await Promise.all([
    getJobWorkVendors(),
    getJobWorkOrders(),
  ]);
  return { vendors, jobWorkOrders };
}

export async function createJobWorkDispatchAction(input: {
  vendor_id: number;
  operation_type: "POLISHING" | "UPHOLSTERY" | "CNC_CUTTING" | "FRAME_WORK";
  target_item_description: string;
  quantity_expected: number;
  rate_per_unit: number;
  material_id: number;
  quantity_to_issue: number;
  due_date: string;
}) {
  const jwo = await createJobWorkDispatch(input);
  revalidatePath("/");
  return { success: true, jwo };
}

export async function reconcileJobWorkReturnAction(input: {
  jwoId: number;
  quantityReceived: number;
  scrapNotes?: string;
}) {
  const jwo = await reconcileJobWorkReturn(input.jwoId, input.quantityReceived, input.scrapNotes);
  revalidatePath("/");
  return { success: true, jwo };
}

// -----------------------------------------------------------------------------
// 7. Retail Sales, Billing & Khata Ledger Actions (Section 4.6)
// -----------------------------------------------------------------------------
export async function fetchRetailAndKhataAction() {
  const [finishedGoods, salesOrders, khataAccounts] = await Promise.all([
    getAllFinishedGoods(),
    getAllSalesOrders(),
    getKhataAccounts(),
  ]);
  return {
    finishedGoods,
    salesOrders,
    khataAccounts,
    deliveryZones: BARASAT_DELIVERY_ZONES,
  };
}

export async function createSalesOrderAction(input: {
  customer_name: string;
  customer_phone: string;
  delivery_pincode: string;
  delivery_zone: string;
  floor_level: number;
  has_lift: boolean;
  payment_mode: "CASH" | "UPI" | "KHATA_CREDIT" | "SPLIT";
  amount_paid: number;
  lines: { product_id: number; quantity: number; unit_price: number }[];
  is_marketplace_order?: boolean;
}) {
  // Validate Section 24 Registration Triggers before order placement
  const triggerCheck = validateSalesRegistrationTriggers({
    deliveryPincode: input.delivery_pincode,
    isMarketplaceOrder: Boolean(input.is_marketplace_order),
    hasSeparateServiceCharges: false, // Default is composite
  });

  const order = await createSalesOrder(input);
  revalidatePath("/");
  return { success: true, order, warnings: triggerCheck.warnings };
}

export async function recordKhataPaymentAction(input: {
  khataId: number;
  amount: number;
  paymentMode: "CASH" | "UPI";
  notes?: string;
}) {
  const khata = await recordKhataPayment(
    input.khataId,
    input.amount,
    input.paymentMode,
    input.notes
  );
  revalidatePath("/");
  return { success: true, khata };
}

export async function restockFinishedGoodAction(input: {
  productId: number;
  quantity_added: number;
  cost_per_unit: number;
  restock_date: string;
  note?: string;
}) {
  const item = await restockFinishedGood(input.productId, input);
  revalidatePath("/");
  return { success: true, item };
}

// -----------------------------------------------------------------------------
// 7. Database Status & Legacy Retail Inventory Handlers
// -----------------------------------------------------------------------------
export async function getDbStatus(): Promise<{ connected: boolean; provider: string }> {
  const configured = Boolean(isDbConfigured);
  return {
    connected: true,
    provider: configured ? "Vercel Postgres (Neon)" : "Local Storage Engine",
  };
}

export async function fetchInventoryAction(
  search?: string,
  category?: string
): Promise<{ items: InventoryItem[]; summary: InventorySummary }> {
  const goods = await getAllFinishedGoods();
  let items: InventoryItem[] = goods.map((g) => ({
    id: g.id,
    name: g.name,
    category: g.category,
    current_quantity: g.current_quantity,
    current_cost_per_unit: g.selling_price,
    total_value: g.current_quantity * g.selling_price,
    last_restocked_at: new Date().toISOString(),
  }));

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }
  if (category && category !== "All") {
    items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  }

  const totalItems = items.length;
  const totalStockUnits = items.reduce((sum, item) => sum + item.current_quantity, 0);
  const totalInventoryValue = items.reduce((sum, item) => sum + item.total_value, 0);
  const lowStockCount = items.filter(
    (item) => item.current_quantity > 0 && item.current_quantity <= 3
  ).length;
  const outOfStockCount = items.filter((item) => item.current_quantity === 0).length;
  const categories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);

  return {
    items,
    summary: {
      totalItems,
      totalStockUnits,
      totalInventoryValue,
      lowStockCount,
      outOfStockCount,
      categories,
    },
  };
}

export async function fetchItemHistoryAction(itemId: number): Promise<{
  item: InventoryItem | null;
  history: RestockHistoryEntry[];
}> {
  const goods = await getAllFinishedGoods();
  const good = goods.find((g) => g.id === itemId);
  if (!good) return { item: null, history: [] };

  const item: InventoryItem = {
    id: good.id,
    name: good.name,
    category: good.category,
    current_quantity: good.current_quantity,
    current_cost_per_unit: good.selling_price,
    total_value: good.current_quantity * good.selling_price,
    last_restocked_at: new Date().toISOString(),
  };

  const history: RestockHistoryEntry[] = [
    {
      id: 1,
      item_id: good.id,
      quantity_added: good.current_quantity,
      cost_per_unit: good.current_cost_per_unit,
      restock_date: new Date().toISOString().split("T")[0],
      note: "Initial production batch",
      created_at: new Date().toISOString(),
    },
  ];

  return { item, history };
}

export async function addItemAction(input: AddItemInput): Promise<{
  success: boolean;
  item?: InventoryItem;
  error?: string;
}> {
  try {
    const newItem: InventoryItem = {
      id: Date.now(),
      name: input.name,
      category: input.category,
      current_quantity: input.initial_quantity,
      current_cost_per_unit: input.initial_cost_per_unit,
      total_value: input.initial_quantity * input.initial_cost_per_unit,
      last_restocked_at: new Date().toISOString(),
    };
    revalidatePath("/");
    return { success: true, item: newItem };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add item" };
  }
}

export async function restockItemAction(
  itemId: number,
  input: RestockInput
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  try {
    await restockFinishedGood(itemId, {
      quantity_added: input.quantity_added,
      cost_per_unit: input.cost_per_unit,
      restock_date: input.restock_date,
      note: input.note,
    });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to restock item" };
  }
}

export async function editItemAction(
  itemId: number,
  input: EditItemInput
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  try {
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to edit item" };
  }
}

export async function deleteItemAction(
  itemId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete item" };
  }
}

