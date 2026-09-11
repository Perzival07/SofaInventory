export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  current_quantity: number;
  current_cost_per_unit: number;
  total_value: number; // calculated: current_quantity * current_cost_per_unit
  last_restocked_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface RestockHistoryEntry {
  id: number;
  item_id: number;
  quantity_added: number;
  cost_per_unit: number;
  restock_date: string;
  note: string | null;
  created_at: string;
}

export interface AddItemInput {
  name: string;
  category: string;
  initial_quantity: number;
  initial_cost_per_unit: number;
  initial_note?: string;
}

export interface RestockInput {
  quantity_added: number;
  cost_per_unit: number;
  restock_date: string;
  note?: string;
}

export interface EditItemInput {
  name: string;
  category: string;
}

export interface InventorySummary {
  totalItems: number;
  totalStockUnits: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  categories: string[];
}

export const COMMON_CATEGORIES = [
  "All",
  "Sofa",
  "Recliner",
  "Dining Set",
  "Bed",
  "Sectional",
  "Accent Chair",
  "Coffee Table",
  "Wardrobe",
  "Office Chair",
  "Other",
] as const;
