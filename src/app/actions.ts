"use server";

import { revalidatePath } from "next/cache";
import {
  getAllItems,
  getItemById,
  getItemRestockHistory,
  createItem,
  restockItem,
  updateItem,
  deleteItem,
  isDbConfigured,
} from "@/lib/db";
import {
  AddItemInput,
  RestockInput,
  EditItemInput,
  InventoryItem,
  RestockHistoryEntry,
  InventorySummary,
} from "@/lib/types";

export async function getDbStatus(): Promise<{ connected: boolean; provider: string }> {
  return {
    connected: isDbConfigured,
    provider: isDbConfigured ? "Vercel Postgres (Neon)" : "In-Memory Demo Mode",
  };
}

export async function fetchInventoryAction(
  search?: string,
  category?: string
): Promise<{ items: InventoryItem[]; summary: InventorySummary }> {
  const items = await getAllItems(search, category);

  // Compute live summary metrics
  const totalItems = items.length;
  const totalStockUnits = items.reduce((sum, item) => sum + item.current_quantity, 0);
  const totalInventoryValue = items.reduce((sum, item) => sum + item.total_value, 0);
  const lowStockCount = items.filter((item) => item.current_quantity > 0 && item.current_quantity <= 3).length;
  const outOfStockCount = items.filter((item) => item.current_quantity === 0).length;

  // Extract distinct categories
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
  const [item, history] = await Promise.all([
    getItemById(itemId),
    getItemRestockHistory(itemId),
  ]);

  return { item, history };
}

export async function addItemAction(input: AddItemInput): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  try {
    if (!input.name || input.name.trim() === "") {
      return { success: false, error: "Item name is required." };
    }
    if (!input.category || input.category.trim() === "") {
      return { success: false, error: "Category is required." };
    }

    const item = await createItem(input);
    revalidatePath("/");
    return { success: true, item };
  } catch (err) {
    console.error("Failed to add item:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to add item" };
  }
}

export async function restockItemAction(
  itemId: number,
  input: RestockInput
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  try {
    if (!itemId || itemId <= 0) {
      return { success: false, error: "Invalid item selected for restocking." };
    }
    if (!input.quantity_added || input.quantity_added <= 0) {
      return { success: false, error: "Quantity added must be at least 1." };
    }
    if (input.cost_per_unit < 0) {
      return { success: false, error: "Cost per unit cannot be negative." };
    }

    const item = await restockItem(itemId, input);
    revalidatePath("/");
    return { success: true, item };
  } catch (err) {
    console.error("Failed to restock item:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to restock item" };
  }
}

export async function editItemAction(
  itemId: number,
  input: EditItemInput
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  try {
    if (!input.name || input.name.trim() === "") {
      return { success: false, error: "Item name is required." };
    }
    if (!input.category || input.category.trim() === "") {
      return { success: false, error: "Category is required." };
    }

    const item = await updateItem(itemId, input);
    revalidatePath("/");
    return { success: true, item };
  } catch (err) {
    console.error("Failed to update item:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update item" };
  }
}

export async function deleteItemAction(
  itemId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteItem(itemId);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete item:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete item" };
  }
}
