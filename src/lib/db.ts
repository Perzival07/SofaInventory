import { neon } from "@neondatabase/serverless";
import {
  InventoryItem,
  RestockHistoryEntry,
  AddItemInput,
  RestockInput,
  EditItemInput,
} from "./types";

// Detect connection string from standard Vercel Postgres / Neon environment variables
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;

export const isDbConfigured = Boolean(connectionString);

function getSql() {
  if (!connectionString) {
    return null;
  }
  return neon(connectionString);
}

// -----------------------------------------------------------------------------
// In-Memory Fallback Store (Used when running locally without POSTGRES_URL)
// -----------------------------------------------------------------------------
interface MemoryStore {
  items: InventoryItem[];
  history: RestockHistoryEntry[];
  nextItemId: number;
  nextHistoryId: number;
}

const memoryStore: MemoryStore = {
  items: [
    {
      id: 1,
      name: "3-Seater Chesterfield Sofa - Royal Navy Velvet",
      category: "Sofa",
      current_quantity: 6,
      current_cost_per_unit: 42000,
      total_value: 252000,
      last_restocked_at: "2026-09-01",
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-01T10:00:00Z",
    },
    {
      id: 2,
      name: "L-Shape Reversible Sectional - Warm Oat Fabric",
      category: "Sofa",
      current_quantity: 4,
      current_cost_per_unit: 58500,
      total_value: 234000,
      last_restocked_at: "2026-09-05",
      created_at: "2026-09-05T10:00:00Z",
      updated_at: "2026-09-05T10:00:00Z",
    },
    {
      id: 3,
      name: "Power Recliner Lounge Chair - Dark Cognac Leather",
      category: "Recliner",
      current_quantity: 8,
      current_cost_per_unit: 31000,
      total_value: 248000,
      last_restocked_at: "2026-09-08",
      created_at: "2026-08-15T10:00:00Z",
      updated_at: "2026-09-08T10:00:00Z",
    },
    {
      id: 4,
      name: "Solid Sheesham 6-Seater Dining Table & Chairs Set",
      category: "Dining Set",
      current_quantity: 3,
      current_cost_per_unit: 49000,
      total_value: 147000,
      last_restocked_at: "2026-08-28",
      created_at: "2026-08-28T10:00:00Z",
      updated_at: "2026-08-28T10:00:00Z",
    },
    {
      id: 5,
      name: "King Size Upholstered Platform Bed - Charcoal Grey",
      category: "Bed",
      current_quantity: 2,
      current_cost_per_unit: 36500,
      total_value: 73000,
      last_restocked_at: "2026-09-03",
      created_at: "2026-09-03T10:00:00Z",
      updated_at: "2026-09-03T10:00:00Z",
    },
    {
      id: 6,
      name: "Mid-Century Teak Wood Coffee Table with Storage",
      category: "Coffee Table",
      current_quantity: 11,
      current_cost_per_unit: 14200,
      total_value: 156200,
      last_restocked_at: "2026-09-09",
      created_at: "2026-09-09T10:00:00Z",
      updated_at: "2026-09-09T10:00:00Z",
    },
    {
      id: 7,
      name: "Nordic Accent Armchair - Mustard Bouclé",
      category: "Accent Chair",
      current_quantity: 0,
      current_cost_per_unit: 18500,
      total_value: 0,
      last_restocked_at: "2026-09-07",
      created_at: "2026-09-07T10:00:00Z",
      updated_at: "2026-09-07T10:00:00Z",
    },
  ],
  history: [
    {
      id: 1,
      item_id: 1,
      quantity_added: 6,
      cost_per_unit: 42000,
      restock_date: "2026-09-01",
      note: "Initial consignment batch from Heritage Furnishings (Inv #HF-8821)",
      created_at: "2026-09-01T10:00:00Z",
    },
    {
      id: 2,
      item_id: 2,
      quantity_added: 4,
      cost_per_unit: 58500,
      restock_date: "2026-09-05",
      note: "Festive season stock from Urban Weave Studio",
      created_at: "2026-09-05T10:00:00Z",
    },
    {
      id: 3,
      item_id: 3,
      quantity_added: 5,
      cost_per_unit: 29500,
      restock_date: "2026-08-15",
      note: "Initial stock from ComfortCraft Ltd",
      created_at: "2026-08-15T10:00:00Z",
    },
    {
      id: 4,
      item_id: 3,
      quantity_added: 3,
      cost_per_unit: 31000,
      restock_date: "2026-09-08",
      note: "Restock batch #2 - ComfortCraft Ltd (Supplier price increased)",
      created_at: "2026-09-08T10:00:00Z",
    },
    {
      id: 5,
      item_id: 4,
      quantity_added: 3,
      cost_per_unit: 49000,
      restock_date: "2026-08-28",
      note: "Direct shipment from Rajasthan Artisan Guild",
      created_at: "2026-08-28T10:00:00Z",
    },
    {
      id: 6,
      item_id: 5,
      quantity_added: 5,
      cost_per_unit: 36500,
      restock_date: "2026-09-03",
      note: "SlumberCraft Beds consignment",
      created_at: "2026-09-03T10:00:00Z",
    },
    {
      id: 7,
      item_id: 6,
      quantity_added: 11,
      cost_per_unit: 14200,
      restock_date: "2026-09-09",
      note: "Local artisan woodwork workshop delivery",
      created_at: "2026-09-09T10:00:00Z",
    },
    {
      id: 8,
      item_id: 7,
      quantity_added: 7,
      cost_per_unit: 18500,
      restock_date: "2026-09-07",
      note: "Studio Nordic launch order",
      created_at: "2026-09-07T10:00:00Z",
    },
  ],
  nextItemId: 8,
  nextHistoryId: 9,
};

// -----------------------------------------------------------------------------
// Auto-Initialization / Schema Migration
// -----------------------------------------------------------------------------
let tablesInitialized = false;

export async function ensureTablesExist(): Promise<void> {
  const sql = getSql();
  if (!sql || tablesInitialized) return;

  try {
    // 1. Create items table
    await sql`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        current_quantity INT NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
        current_cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_cost_per_unit >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_restocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    // 2. Create restock_history table
    await sql`
      CREATE TABLE IF NOT EXISTS restock_history (
        id SERIAL PRIMARY KEY,
        item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        quantity_added INT NOT NULL CHECK (quantity_added > 0),
        cost_per_unit NUMERIC(12, 2) NOT NULL CHECK (cost_per_unit >= 0),
        restock_date DATE NOT NULL DEFAULT CURRENT_DATE,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    // 3. Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_restock_history_item_id_date ON restock_history(item_id, restock_date DESC);`;

    tablesInitialized = true;
    console.log("✓ Vercel Postgres schema verified/initialized successfully.");
  } catch (error) {
    console.error("Error initializing Vercel Postgres schema:", error);
    // Don't throw fatal error on startup if already exists or permission issues
  }
}

// -----------------------------------------------------------------------------
// Data Access Methods
// -----------------------------------------------------------------------------

export async function getAllItems(search?: string, category?: string): Promise<InventoryItem[]> {
  const sql = getSql();

  if (sql) {
    await ensureTablesExist();

    const searchPattern = search && search.trim() !== "" ? `%${search.trim().toLowerCase()}%` : null;
    const categoryFilter = category && category !== "All" ? category : null;

    const rows = (await sql`
      SELECT 
        id,
        name,
        category,
        current_quantity,
        current_cost_per_unit::float AS current_cost_per_unit,
        (current_quantity * current_cost_per_unit)::float AS total_value,
        TO_CHAR(last_restocked_at, 'YYYY-MM-DD') AS last_restocked_at,
        created_at,
        updated_at
      FROM items
      WHERE 
        (${categoryFilter}::text IS NULL OR category = ${categoryFilter})
        AND (${searchPattern}::text IS NULL OR LOWER(name) LIKE ${searchPattern} OR LOWER(category) LIKE ${searchPattern})
      ORDER BY last_restocked_at DESC, id DESC
    `) as InventoryItem[];

    return rows.map((r) => ({
      ...r,
      current_quantity: Number(r.current_quantity),
      current_cost_per_unit: Number(r.current_cost_per_unit),
      total_value: Number(r.total_value),
    }));
  }

  // In-Memory Fallback
  let filtered = [...memoryStore.items];
  if (category && category !== "All") {
    filtered = filtered.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  }
  if (search && search.trim() !== "") {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }
  return filtered.sort(
    (a, b) => new Date(b.last_restocked_at).getTime() - new Date(a.last_restocked_at).getTime()
  );
}

export async function getItemById(id: number): Promise<InventoryItem | null> {
  const sql = getSql();
  if (sql) {
    await ensureTablesExist();
    const rows = (await sql`
      SELECT 
        id,
        name,
        category,
        current_quantity,
        current_cost_per_unit::float AS current_cost_per_unit,
        (current_quantity * current_cost_per_unit)::float AS total_value,
        TO_CHAR(last_restocked_at, 'YYYY-MM-DD') AS last_restocked_at,
        created_at,
        updated_at
      FROM items
      WHERE id = ${id}
      LIMIT 1
    `) as InventoryItem[];

    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      ...r,
      current_quantity: Number(r.current_quantity),
      current_cost_per_unit: Number(r.current_cost_per_unit),
      total_value: Number(r.total_value),
    };
  }

  const item = memoryStore.items.find((i) => i.id === id);
  return item ? { ...item } : null;
}

export async function getItemRestockHistory(itemId: number): Promise<RestockHistoryEntry[]> {
  const sql = getSql();
  if (sql) {
    await ensureTablesExist();
    const rows = (await sql`
      SELECT 
        id,
        item_id,
        quantity_added,
        cost_per_unit::float AS cost_per_unit,
        TO_CHAR(restock_date, 'YYYY-MM-DD') AS restock_date,
        note,
        created_at
      FROM restock_history
      WHERE item_id = ${itemId}
      ORDER BY restock_date DESC, id DESC
    `) as RestockHistoryEntry[];

    return rows.map((r) => ({
      ...r,
      quantity_added: Number(r.quantity_added),
      cost_per_unit: Number(r.cost_per_unit),
    }));
  }

  return memoryStore.history
    .filter((h) => h.item_id === itemId)
    .sort((a, b) => new Date(b.restock_date).getTime() - new Date(a.restock_date).getTime());
}

export async function createItem(input: AddItemInput): Promise<InventoryItem> {
  const sql = getSql();
  const initialQty = Math.max(0, Number(input.initial_quantity) || 0);
  const initialCost = Math.max(0, Number(input.initial_cost_per_unit) || 0);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  if (sql) {
    await ensureTablesExist();

    // 1. Insert Item
    const inserted = (await sql`
      INSERT INTO items (name, category, current_quantity, current_cost_per_unit, last_restocked_at)
      VALUES (${input.name.trim()}, ${input.category.trim()}, ${initialQty}, ${initialCost}, ${today})
      RETURNING 
        id,
        name,
        category,
        current_quantity,
        current_cost_per_unit::float AS current_cost_per_unit,
        (current_quantity * current_cost_per_unit)::float AS total_value,
        TO_CHAR(last_restocked_at, 'YYYY-MM-DD') AS last_restocked_at,
        created_at,
        updated_at
    `) as InventoryItem[];

    const newItem = inserted[0];

    // 2. If initial quantity > 0, log initial history entry to preserve complete audit trail
    if (initialQty > 0) {
      const note = input.initial_note?.trim() || "Initial stock entry";
      await sql`
        INSERT INTO restock_history (item_id, quantity_added, cost_per_unit, restock_date, note)
        VALUES (${newItem.id}, ${initialQty}, ${initialCost}, ${today}, ${note})
      `;
    }

    return {
      ...newItem,
      current_quantity: Number(newItem.current_quantity),
      current_cost_per_unit: Number(newItem.current_cost_per_unit),
      total_value: Number(newItem.total_value),
    };
  }

  // Memory Fallback
  const newId = memoryStore.nextItemId++;
  const newItem: InventoryItem = {
    id: newId,
    name: input.name.trim(),
    category: input.category.trim(),
    current_quantity: initialQty,
    current_cost_per_unit: initialCost,
    total_value: initialQty * initialCost,
    last_restocked_at: today,
    created_at: now,
    updated_at: now,
  };
  memoryStore.items.unshift(newItem);

  if (initialQty > 0) {
    memoryStore.history.unshift({
      id: memoryStore.nextHistoryId++,
      item_id: newId,
      quantity_added: initialQty,
      cost_per_unit: initialCost,
      restock_date: today,
      note: input.initial_note?.trim() || "Initial stock entry",
      created_at: now,
    });
  }

  return newItem;
}

export async function restockItem(itemId: number, input: RestockInput): Promise<InventoryItem> {
  const sql = getSql();
  const addedQty = Math.max(1, Number(input.quantity_added) || 1);
  const newCost = Math.max(0, Number(input.cost_per_unit) || 0);
  const restockDate = input.restock_date || new Date().toISOString().slice(0, 10);
  const note = input.note?.trim() || null;

  if (sql) {
    await ensureTablesExist();

    // 1. Insert into history (append-only log)
    await sql`
      INSERT INTO restock_history (item_id, quantity_added, cost_per_unit, restock_date, note)
      VALUES (${itemId}, ${addedQty}, ${newCost}, ${restockDate}, ${note})
    `;

    // 2. Update item quantity and current cost per unit
    const updated = (await sql`
      UPDATE items
      SET 
        current_quantity = current_quantity + ${addedQty},
        current_cost_per_unit = ${newCost},
        last_restocked_at = ${restockDate},
        updated_at = NOW()
      WHERE id = ${itemId}
      RETURNING 
        id,
        name,
        category,
        current_quantity,
        current_cost_per_unit::float AS current_cost_per_unit,
        (current_quantity * current_cost_per_unit)::float AS total_value,
        TO_CHAR(last_restocked_at, 'YYYY-MM-DD') AS last_restocked_at,
        created_at,
        updated_at
    `) as InventoryItem[];

    if (!updated || updated.length === 0) {
      throw new Error(`Item with id ${itemId} not found`);
    }

    const r = updated[0];
    return {
      ...r,
      current_quantity: Number(r.current_quantity),
      current_cost_per_unit: Number(r.current_cost_per_unit),
      total_value: Number(r.total_value),
    };
  }

  // Memory Fallback
  const itemIndex = memoryStore.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) {
    throw new Error(`Item with id ${itemId} not found`);
  }

  const item = memoryStore.items[itemIndex];
  const updatedQty = item.current_quantity + addedQty;

  memoryStore.items[itemIndex] = {
    ...item,
    current_quantity: updatedQty,
    current_cost_per_unit: newCost,
    total_value: updatedQty * newCost,
    last_restocked_at: restockDate,
    updated_at: new Date().toISOString(),
  };

  memoryStore.history.unshift({
    id: memoryStore.nextHistoryId++,
    item_id: itemId,
    quantity_added: addedQty,
    cost_per_unit: newCost,
    restock_date: restockDate,
    note: note,
    created_at: new Date().toISOString(),
  });

  return memoryStore.items[itemIndex];
}

export async function updateItem(itemId: number, input: EditItemInput): Promise<InventoryItem> {
  const sql = getSql();
  if (sql) {
    await ensureTablesExist();
    const updated = (await sql`
      UPDATE items
      SET 
        name = ${input.name.trim()},
        category = ${input.category.trim()},
        updated_at = NOW()
      WHERE id = ${itemId}
      RETURNING 
        id,
        name,
        category,
        current_quantity,
        current_cost_per_unit::float AS current_cost_per_unit,
        (current_quantity * current_cost_per_unit)::float AS total_value,
        TO_CHAR(last_restocked_at, 'YYYY-MM-DD') AS last_restocked_at,
        created_at,
        updated_at
    `) as InventoryItem[];

    if (!updated || updated.length === 0) {
      throw new Error(`Item with id ${itemId} not found`);
    }
    const r = updated[0];
    return {
      ...r,
      current_quantity: Number(r.current_quantity),
      current_cost_per_unit: Number(r.current_cost_per_unit),
      total_value: Number(r.total_value),
    };
  }

  // Memory Fallback
  const itemIndex = memoryStore.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) {
    throw new Error(`Item with id ${itemId} not found`);
  }
  memoryStore.items[itemIndex] = {
    ...memoryStore.items[itemIndex],
    name: input.name.trim(),
    category: input.category.trim(),
    updated_at: new Date().toISOString(),
  };
  return memoryStore.items[itemIndex];
}

export async function deleteItem(itemId: number): Promise<boolean> {
  const sql = getSql();
  if (sql) {
    await ensureTablesExist();
    await sql`DELETE FROM items WHERE id = ${itemId}`;
    return true;
  }

  // Memory Fallback
  memoryStore.items = memoryStore.items.filter((i) => i.id !== itemId);
  memoryStore.history = memoryStore.history.filter((h) => h.item_id !== itemId);
  return true;
}
