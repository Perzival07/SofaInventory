"use server";

import { requireSession } from "@/lib/require-session";


import { revalidatePath } from "next/cache";
import {
  getCustomers, createCustomer, getFinishedUnits, createFinishedUnit, getSellableUnits,
  getAtp, createSalesOrder, getSalesOrders, getOrderLines, updateOrderStatus,
  addKhataEntry, getKhataEntries, getKhataAccounts, getTurnoverStatus,
  getOtherPanTurnover, setOtherPanTurnover, getCashBook,
} from "@/lib/sales-db";
import { getProducts } from "@/lib/erp-db";
import { getCurrentRegime } from "@/lib/tax-db";
import {
  Customer, FinishedUnit, SalesOrder, SalesOrderInput, SalesOrderLine,
  KhataEntry, KhataAccount, TurnoverStatus, AtpResult, CashBookRow,
  RegistrationTrigger, ConditionGrade, PaymentMode, DELIVERY_ZONES, DeliveryZone,
} from "@/lib/sales-types";
import { Product } from "@/lib/erp-types";
import { RegimeState } from "@/lib/tax-types";
import { registrationTriggers, computeDelivery } from "@/lib/sales-logic";

export interface SalesPageData {
  orders: SalesOrder[];
  customers: Customer[];
  products: Product[];
  units: FinishedUnit[];
  sellableUnits: FinishedUnit[];
  atp: AtpResult[];
  khata: KhataAccount[];
  turnover: TurnoverStatus;
  cashBook: CashBookRow[];
  zones: DeliveryZone[];
  regime: RegimeState;
  otherPanTurnover: number;
}

export async function fetchSalesPageDataAction(): Promise<SalesPageData> {
  await requireSession();
  const [
    orders, customers, products, units, sellableUnits, atp,
    khata, turnover, cashBook, regime, otherPanTurnover,
  ] = await Promise.all([
    getSalesOrders(), getCustomers(), getProducts(), getFinishedUnits(),
    getSellableUnits(), getAtp(), getKhataAccounts(), getTurnoverStatus(),
    getCashBook(), getCurrentRegime(), getOtherPanTurnover(),
  ]);

  return {
    orders, customers, products, units, sellableUnits, atp, khata,
    turnover, cashBook, zones: DELIVERY_ZONES, regime, otherPanTurnover,
  };
}

export async function fetchOrderLinesAction(orderId: number): Promise<SalesOrderLine[]> {
  await requireSession();
  return getOrderLines(orderId);
}

export async function fetchKhataEntriesAction(customerId: number): Promise<KhataEntry[]> {
  await requireSession();
  return getKhataEntries(customerId);
}

/** Live preview of the warnings an order would raise, before it is committed. */
export async function previewTriggersAction(input: {
  zone_code: string | null;
  channel: string;
  services_itemised: boolean;
  customer_id: number;
}): Promise<{ triggers: RegistrationTrigger[]; delivery_charge: number }> {
  await requireSession();
  const [regime, customers] = await Promise.all([getCurrentRegime(), getCustomers()]);
  const customer = customers.find((c) => c.id === input.customer_id);

  return {
    triggers: registrationTriggers({
      regime,
      zoneCode: input.zone_code,
      channel: input.channel as "walk_in" | "phone" | "referral" | "ecommerce",
      servicesItemised: input.services_itemised,
      buyerGstin: customer?.gstin ?? null,
    }),
    delivery_charge: 0,
  };
}

export async function computeDeliveryAction(
  zoneCode: string, floor: number, hasLift: boolean
) {
  await requireSession();
  return computeDelivery(zoneCode, floor, hasLift);
}

export async function createCustomerAction(input: {
  name: string; phone: string; address?: string | null;
  zone_code?: string | null; gstin?: string | null; state_code: string;
}): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  await requireSession();
  try {
    if (!input.name.trim() || !input.phone.trim()) {
      return { success: false, error: "Name and phone are required." };
    }
    const customer = await createCustomer(input);
    revalidatePath("/sales");
    return { success: true, customer };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function createFinishedUnitAction(input: {
  product_id: number; condition_grade: ConditionGrade; cost: number;
  list_price: number; carton_total: number; cartons_present: number;
  floor_since?: string | null; location?: string | null;
}): Promise<{ success: boolean; serial?: string; error?: string }> {
  await requireSession();
  try {
    if (!input.product_id) return { success: false, error: "Select a product." };
    if (input.cartons_present > input.carton_total) {
      return { success: false, error: "Cartons present cannot exceed the total." };
    }
    const unit = await createFinishedUnit(input);
    revalidatePath("/sales");
    return { success: true, serial: unit.serial_no };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function createSalesOrderAction(
  input: SalesOrderInput
): Promise<{
  success: boolean; orderNumber?: string; documentType?: string;
  total?: number; triggers?: RegistrationTrigger[]; error?: string;
}> {
  await requireSession();
  try {
    if (!input.customer_id) return { success: false, error: "Select a customer." };
    const lines = input.lines.filter((l) => l.product_id && l.quantity > 0);
    if (!lines.length) return { success: false, error: "Add at least one line." };

    const { order, triggers } = await createSalesOrder({ ...input, lines });

    revalidatePath("/sales");
    revalidatePath("/");
    return {
      success: true, orderNumber: order.order_number,
      documentType: order.document_type, total: order.grand_total, triggers,
    };
  } catch (err) {
    console.error("Failed to create sales order:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create order" };
  }
}

export async function updateOrderStatusAction(
  orderId: number, status: string
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    await updateOrderStatus(orderId, status);
    revalidatePath("/sales");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function recordPaymentAction(input: {
  customer_id: number; order_id?: number | null; entry_date: string;
  amount: number; mode: PaymentMode; reference?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    if (input.amount <= 0) return { success: false, error: "Payment must be greater than zero." };
    // Stored as a negative entry: a payment reduces what the customer owes.
    await addKhataEntry({
      customer_id: input.customer_id, order_id: input.order_id ?? null,
      entry_date: input.entry_date, amount: -Math.abs(input.amount),
      mode: input.mode, reference: input.reference ?? null, notes: "Payment received",
    });
    revalidatePath("/sales");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function setOtherPanTurnoverAction(
  value: number
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    if (value < 0) return { success: false, error: "Turnover cannot be negative." };
    await setOtherPanTurnover(value);
    revalidatePath("/sales");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
