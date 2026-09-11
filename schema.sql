-- =============================================================================
-- SofaInventory - Vercel Postgres (Neon) Database Schema
-- Furniture Inventory Management System
-- =============================================================================

-- Table 1: items
-- Represents each distinct furniture inventory item currently tracked in the shop.
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

-- Table 2: restock_history
-- Append-only audit trail logging every restock event and initial stock creation.
-- Historical records must never be overwritten or deleted on restocking.
CREATE TABLE IF NOT EXISTS restock_history (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity_added INT NOT NULL CHECK (quantity_added > 0),
    cost_per_unit NUMERIC(12, 2) NOT NULL CHECK (cost_per_unit >= 0),
    restock_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_restock_history_item_id_date ON restock_history(item_id, restock_date DESC);
CREATE INDEX IF NOT EXISTS idx_restock_history_item_id_created ON restock_history(item_id, created_at DESC);

-- Optional: Initial Seed Data for immediate demonstration (runs safely with ON CONFLICT / sample check)
-- This allows shop staff to see realistic furniture items on first launch.
INSERT INTO items (id, name, category, current_quantity, current_cost_per_unit, last_restocked_at)
VALUES 
    (1, '3-Seater Chesterfield Sofa - Royal Navy Velvet', 'Sofa', 6, 42000.00, '2026-09-01'),
    (2, 'L-Shape Reversible Sectional - Warm Oat Fabric', 'Sofa', 4, 58500.00, '2026-09-05'),
    (3, 'Power Recliner Lounge Chair - Dark Cognac Leather', 'Recliner', 8, 31000.00, '2026-09-08'),
    (4, 'Solid Sheesham 6-Seater Dining Table & Chairs Set', 'Dining Set', 3, 49000.00, '2026-08-28'),
    (5, 'King Size Upholstered Platform Bed - Charcoal Grey', 'Bed', 5, 36500.00, '2026-09-03'),
    (6, 'Mid-Century Teak Wood Coffee Table with Storage', 'Coffee Table', 11, 14200.00, '2026-09-09'),
    (7, 'Nordic Accent Armchair - Mustard Bouclé', 'Accent Chair', 7, 18500.00, '2026-09-07')
ON CONFLICT (id) DO NOTHING;

-- Reset serial sequence to continue after seeded IDs
SELECT setval(pg_get_serial_sequence('items', 'id'), COALESCE((SELECT MAX(id) FROM items), 1));

-- Seed Initial Restock History corresponding to seeded items
INSERT INTO restock_history (item_id, quantity_added, cost_per_unit, restock_date, note)
VALUES 
    (1, 6, 42000.00, '2026-09-01', 'Initial consignment batch from Heritage Furnishings (Inv #HF-8821)'),
    (2, 4, 58500.00, '2026-09-05', 'Festive season stock from Urban Weave Studio'),
    (3, 5, 29500.00, '2026-08-15', 'Initial stock from ComfortCraft Ltd'),
    (3, 3, 31000.00, '2026-09-08', 'Restock batch #2 - ComfortCraft Ltd (Supplier price increased)'),
    (4, 3, 49000.00, '2026-08-28', 'Direct shipment from Rajasthan Artisan Guild'),
    (5, 5, 36500.00, '2026-09-03', 'SlumberCraft Beds consignment'),
    (6, 11, 14200.00, '2026-09-09', 'Local artisan woodwork workshop delivery'),
    (7, 7, 18500.00, '2026-09-07', 'Studio Nordic launch order')
ON CONFLICT DO NOTHING;
