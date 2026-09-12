# The Sofa Studio - Inventory Management System

A simple, no-login, web-based Inventory Management System built specifically for furniture shops (sofas, recliners, dining sets, beds, and accent pieces).

Designed for native zero-config deployment on **Vercel** with **Next.js (App Router)** and **Vercel Postgres (Neon)**.

---

## 🛋️ Core Features

- **No-Login Access**: Shop staff immediately land on the inventory view with zero barrier to entry. Single-tenant, single-shop architecture.
- **Stock Dashboard**:
  - Live stock quantities with colored badges (In Stock, Low Stock ≤3, Out of Stock).
  - Current batch cost per unit in Indian Rupees (**₹**).
  - Automatic inventory valuation (`Quantity × Current Batch Cost`).
  - Search by furniture model, color, or category.
  - Horizontal scrolling category filter chips with live counts.
  - High-level KPI metrics bar (Total units, Total stock value in ₹, Active designs, Low stock alerts).
- **Batch Restocking ("Renew Stock")**:
  - Increase stock quantity by entered batch amount.
  - Automatically updates the item's current cost per unit to this batch's price.
  - Automatically appends a permanent, timestamped entry to the restock audit log.
- **Append-Only History Log**:
  - Chronological timeline (most recent first) tracking all restock events.
  - Shows date, quantity added, batch unit cost, total batch outlay, and supplier/invoice notes.
- **Touch-Optimized Responsive Design**:
  - **Mobile (phones, 320–480px)**: 1-column card view, prominent 44px+ tap targets, clear readable ₹ totals without horizontal scrolling.
  - **Tablet (counter-top screens, 600–1024px)**: 2-column card grid or compact table, comfortable modal dialogs.
  - **Desktop (1024px+)**: Full data table with instant sorting, column highlights, and quick action buttons.

---

## 🗄️ Database Architecture (Vercel Postgres / Neon)

The database schema consists of two tables linked via a foreign key with cascade deletion.

```sql
-- Table 1: items
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

-- Table 2: restock_history (Append-Only Log)
CREATE TABLE IF NOT EXISTS restock_history (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity_added INT NOT NULL CHECK (quantity_added > 0),
    cost_per_unit NUMERIC(12, 2) NOT NULL CHECK (cost_per_unit >= 0),
    restock_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_restock_history_item_id_date ON restock_history(item_id, restock_date DESC);
```

> The complete SQL file with seed data is located at [`schema.sql`](./schema.sql).

---

## 🚀 Step-by-Step Vercel Deployment Guide (Starting from Zero)

You can deploy this entire application (frontend, server actions, and Postgres database) to Vercel in less than 3 minutes.

### Step 1: Push Code to GitHub
Push this repository to your GitHub account:
```bash
git add .
git commit -m "feat: complete furniture inventory management system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/SofaInventory.git
git push -u origin main
```

### Step 2: Import Project on Vercel
1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **"Add New..."** > **"Project"**.
3. Select your GitHub repository (`SofaInventory`) and click **"Import"**.
4. Leave all build settings at their default values (Framework Preset: **Next.js**, Root Directory: `./`).
5. Click **"Deploy"**.

### Step 3: Provision Vercel Postgres (Neon)
1. Once the initial build finishes, open your project dashboard in Vercel.
2. Click the **"Storage"** tab in the top navigation.
3. Click **"Create Database"** and select **"Postgres"** (powered by Neon).
4. Choose a database name (e.g. `sofa-inventory-db`) and select the region closest to your shop (e.g., `Mumbai (bom1)` or your nearest region).
5. Click **"Create"**.

### Step 4: Connect Database to Your Project
1. In the database dashboard, click the **"Quickstart"** or **".env.local"** tab.
2. Select your `SofaInventory` project under **"Connect to Project"** and select **All Environments** (Production, Preview, Development).
3. Click **"Connect"**.
4. Vercel will automatically inject `POSTGRES_URL`, `DATABASE_URL`, and other credentials into your project environment variables with zero manual copying!

### Step 5: Redeploy
1. Go to the **"Deployments"** tab in Vercel.
2. Click the three dots `...` on the latest deployment and click **"Redeploy"** (or push any commit to `main`).
3. That's it! When the app loads for the first time, it automatically creates the tables and seeds initial furniture data if not already present.

---

## 💻 Local Development

1. **Clone the repository**:
   ```bash
   cd SofaInventory
   npm install
   ```

2. **Run locally (Instant Demo Mode)**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.
   > *Note: If `POSTGRES_URL` is not provided in `.env.local`, the application seamlessly runs in In-Memory Demo Mode with pre-populated furniture items so you can test all features immediately.*

3. **Connect Local Environment to Vercel Postgres (Optional)**:
   ```bash
   npx vercel link
   npx vercel env pull .env.local
   npm run dev
   ```

---

## 📁 Project Structure

```
SofaInventory/
├── schema.sql                     # Exact Vercel Postgres DDL & seed data
├── STAFF_GUIDE.md                 # 1-page printable cheat sheet for shop staff
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with Outfit & Inter typography
│   │   ├── page.tsx               # Main responsive dashboard
│   │   ├── actions.ts             # Next.js Server Actions (CRUD & Restock)
│   │   ├── globals.css            # Luxury showroom design system (Vanilla CSS)
│   │   └── api/
│   │       └── init/route.ts      # Health check and schema verification API
│   ├── components/
│   │   ├── Header.tsx             # Branding, DB status pill, Add Item CTA
│   │   ├── StatsOverview.tsx      # 4 KPI cards (Units, ₹ Valuation, Alert)
│   │   ├── FilterBar.tsx          # Real-time search, category chips, view toggle
│   │   ├── InventoryTable.tsx     # Desktop information-dense table view
│   │   ├── InventoryCardList.tsx  # Mobile & tablet touch-friendly card grid
│   │   ├── AddItemModal.tsx       # New furniture item creation dialog
│   │   ├── RestockModal.tsx       # Core batch restock dialog
│   │   ├── HistoryModal.tsx       # Append-only chronological audit log
│   │   ├── EditItemModal.tsx      # Quick name and category editor
│   │   └── DeleteItemModal.tsx    # Safe destructive action confirmation
│   ├── lib/
│   │   ├── db.ts                  # Neon / Vercel Postgres client + memory fallback
│   │   ├── formatters.ts          # Indian Rupee (₹) & date formatters
│   │   └── types.ts               # TypeScript interfaces
│   └── __tests__/
│       └── inventory.test.ts      # Automated end-to-end integration test suite
```
