# The Sofa Studio & Manufacturing Co. — Barasat ERP & Inventory System

A complete, production-grade Furniture Manufacturing, Job Work, and Retail Management System built specifically for furniture businesses operating in **Barasat, North 24 Parganas, West Bengal, India**.

Built with **Next.js 16 (App Router)**, **TypeScript**, and **Vanilla CSS**, deployed natively on **Vercel** with **Vercel Postgres (Neon)** with zero-config in-memory fallback for local demo and offline use.

---

## 🏛️ Business Architecture & Core Capabilities

The system models the complete end-to-end furniture business:

```
Purchase → [1] Raw Material Store ──► [2] In-House Factory WIP ──► [4] Finished Goods Showroom
                                 └──► [3] Stock with Vendor   ──► (Retail & Home Delivery)
```

### 1. The 4 Stock States Reconciled
- **[1] Raw Material Store**: Tracks timber (Sal, Teak/Segun, Mehogini in CFT with moisture % and seasoning dates), sheet goods (plywood/MDF/blockboard by thickness), foam (PU foam sheets by density 28D–50D), fabrics/leatherette with dye-lot shade matching, and scrap offcuts salvage.
- **[2] In-House WIP**: 9 sequential production stages (Carpentry Frame, Webbing & Springing, Foam Profiling, Cushion Core, Pattern Cutting, Sewing, Upholstery & Tufting, Wood Polishing, QC & Final Packaging). Tracks karigar piece-rate wages and gate pass approvals.
- **[3] Stock with Vendor (Our Legal Asset)**: Material issued to local job workers (polishing, CNC carving, specialized stitching) remains our legal inventory asset at all times. Tracks job work orders, Rule 45 / Internal Delivery Challans, return reconciliation, scrap allowances, and 3-way matching.
- **[4] Finished Goods & Retail**: Multi-box carton tracking (e.g. 4 boxes for an L-shape sofa), floor model display age tracking with markdown eligibility, and bilingual Cash Memo / Tax Invoice issuance.

---

### 2. Dormant Tax Regime Strategy Engine (Section 2)
The business currently operates **below the ₹40 Lakh GST exemption threshold**. The GST engine is completely built and operates behind the dormant switch `tax_regime_enabled = false`:

- **Unregistered Mode (`false`)**:
  - Issues non-tax **Cash Memos** with `CM-YYYY-XXXX` numbering and zero tax columns.
  - Purchases are capitalized at **landed cost (cost + GST)** with ₹0 ITC.
  - Job work dispatches use **Internal Delivery Challans** with `IDC-YYYY-XXXX` numbering.
  - E-way bill requirement: Not applicable for intra-state below ₹1,00,000 in West Bengal.
- **Registered Mode (`true`)**:
  - Issues statutory **Tax Invoices** with `INV-YYYY-XXXX` numbering, showing HSN codes and automated **CGST + SGST (Intra-state WB)** or **IGST (Interstate)** tax split.
  - Purchases are split into **net taxable cost + creditable Input Tax Credit (ITC)**.
  - Job work dispatches generate statutory **Rule 45 Job Work Challans** with Annexure B format.
- **Historical Immutability & Reversibility (Section 2.3 Rules 1–6)**:
  - Switching between regimes **never** alters historical documents. A Cash Memo issued under unregistered status remains a Cash Memo forever with zero tax breakdown.
  - **Section 18(1)(a) Transitional Credit Service**: Automatically compiles an audit report of raw material and finished goods stock lots purchased from GST-registered vendors within the prior 12 months, calculating claimable ITC.
  - Fully tested and certified by the automated Section 2.4 Acceptance Suite.

---

### 3. FY Aggregate Turnover Watchdog & Section 24 Triggers
- **Aggregate PAN Tracking**: Aggregates local showroom turnover with other businesses registered on the same proprietor/firm PAN.
- **Color-Coded Alert Thresholds**:
  - **Safe Zone (Green)**: Turnover < ₹30,00,000.
  - **Amber Alert (Yellow)**: Turnover ≥ ₹30,00,000 (Warning to prepare GST registration).
  - **Red Alert (Orange)**: Turnover ≥ ₹35,00,000 (Mandatory registration alert).
  - **Blocking Alert (Red)**: Turnover ≥ ₹38,00,000 (System blocks unregistered sales until GSTIN is configured).
- **Bengali Festive Season Uplift**: Projects year-end turnover factoring in 40–50% festive surges ahead of Durga Puja and Diwali (Bhadra–Ashwin).
- **Section 24 Hard Triggers**: Warns or blocks sales if interstate delivery (outside WB PIN 700001–743711), e-commerce fulfillment, or unbundled service charges mandate compulsory registration regardless of turnover.

---

### 4. Barasat Local Intelligence & Regional Operations
- **Delivery Zones & Staircase Surcharges**:
  - Zone 1: Barasat Town & Champadali More (₹500 flat)
  - Zone 2: Madhyamgram & Hridaypur (₹800 flat)
  - Zone 3: Habra & Ashoknagar (₹1,200 flat)
  - Zone 4: North Kolkata (Dum Dum, Salt Lake, New Town, Airport) (₹1,800 flat)
  - Floor Surcharge: ₹150 per floor from 2nd floor upwards when no service elevator is available.
- **Monsoon Mode**:
  - Monsoons in North 24 Parganas cause extreme humidity (>80%).
  - Automatically raises timber moisture threshold, quarantines unseasoned timber with >14% moisture, and doubles foam/wood clamping and drying times.
- **Bilingual Interface**: Seamless 1-click toggle between **English** and **বাংলা (Bengali)** across the entire ERP, receipts, and challans.
- **Khata / Udhaar Ledger**: Local customer credit accounts, installment payment logging, outstanding balance tracking, and cash/UPI receipt generation.

---

## 💻 Tech Stack

- **Framework**: [Next.js 16.3.4 (App Router)](https://nextjs.org/)
- **Language**: TypeScript 5.7+
- **Styling**: Vanilla CSS (Tailored Design System with Dark Mode, Glassmorphism, and HSL tokens)
- **Database**: [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) powered by [Neon Serverless](https://neon.tech/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: Node test runner with `tsx` for TypeScript execution

---

## 🛠️ Project Structure

```
SofaInventory/
├── schema.sql                         # Complete PostgreSQL DDL (4 states, tax config, serials, Khata)
├── src/
│   ├── app/
│   │   ├── actions.ts                 # Server Actions (Overview, tax toggle, sales, WIP, job work)
│   │   ├── page.tsx                   # Main Enterprise ERP Dashboard
│   │   ├── globals.css                # Enterprise design system & theme variables
│   │   ├── materials/page.tsx         # Raw Materials management route
│   │   ├── production/page.tsx        # In-House WIP tracking route
│   │   ├── jobwork/page.tsx           # Stock-with-vendor route
│   │   ├── purchases/page.tsx         # GRN & Purchase orders route
│   │   ├── bom/page.tsx               # Bill of Materials route
│   │   └── settings/page.tsx          # Tax & statutory settings route
│   ├── components/
│   │   ├── FourStockStatesOverview.tsx# Visual 4-state inventory reconciliation
│   │   ├── TurnoverWatchdogCard.tsx   # FY Turnover gauge & Section 24 alert panel
│   │   ├── TaxRegimeSettingsModal.tsx # GST switchover & Sec 18(1)(a) credit report modal
│   │   ├── RetailSalesAndKhata.tsx    # POS, Billing, Zone delivery & Khata ledger
│   │   ├── ProductionStageTracker.tsx # 9-stage WIP tracker & karigar piece-rate logger
│   │   ├── JobWorkVendorManager.tsx   # Vendor challans, reconciliation & Make-vs-Buy analyzer
│   │   ├── RawMaterialStoreView.tsx   # Timber moisture, dye lots & offcut scrap store
│   │   ├── MonsoonModeBanner.tsx      # Monsoon humidity control banner
│   │   ├── Header.tsx                 # Regional branding, tax badge, and language switcher
│   │   └── LanguageToggle.tsx         # English / বাংলা switcher
│   ├── lib/
│   │   ├── types.ts                   # Domain TypeScript models
│   │   ├── tax-strategy.ts            # Strategy pattern governing sales, purchases, challans & credit
│   │   ├── turnover-watchdog.ts       # Turnover calculation, festival uplift & trigger checks
│   │   ├── costing-engine.ts          # Dual-costing roll-up & Make-vs-Buy analyzer
│   │   ├── local-intelligence.ts      # Barasat delivery zones, floor fees & monsoon thresholds
│   │   ├── inventory-states.ts        # UOM conversions, dye lots, ATP & carton integrity
│   │   ├── i18n.ts                    # English and Bengali (বাংলা) translations
│   │   └── db.ts                      # Postgres client & in-memory fallback store
│   └── __tests__/
│       ├── tax-regime-toggle.test.ts  # Section 2.4 Acceptance Test Suite (20 sales, toggle, credit)
│       └── inventory.test.ts          # Core inventory unit tests
```

---

## 🧪 Testing & Verification

### Running Acceptance Tests

Run the Section 2.4 Tax Regime & Immutability Acceptance Suite:
```bash
npx tsx src/__tests__/tax-regime-toggle.test.ts
```
Expected output:
```
===============================================================================
  ALL SECTION 2.4 ACCEPTANCE CRITERIA PASSED 100% SUCCESSFULLY!
===============================================================================
```

Run the Core Inventory Unit Tests:
```bash
npx tsx src/__tests__/inventory.test.ts
```

### Production Build

Verify the Next.js production build:
```bash
npm run build
```

---

## 🚀 Deployment to Vercel

1. Push this repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/), import the repository.
3. In the **Storage** tab, create a **Vercel Postgres (Neon)** instance in `Mumbai (bom1)`.
4. Connect the database to the project (injects `POSTGRES_URL`).
5. Run [`schema.sql`](./schema.sql) in the Vercel Query Console to initialize the database tables.
6. The app will automatically connect to Postgres and display the active database indicator!

---

## 📄 Licencing & Local Compliance

Designed for compliance with:
- **West Bengal GST Act, 2017 & CGST Act, 2017**
- **Section 22**: ₹40 Lakh threshold limit for suppliers of goods in West Bengal.
- **Section 18(1)(a)**: Input tax credit on stock held at the date of registration.
- **Rule 45**: Conditions and restrictions in respect of inputs and capital goods sent to job worker.
- **Barasat Municipality**: Trade Licence & West Bengal Fire and Emergency Services (WBFES) tracking.
