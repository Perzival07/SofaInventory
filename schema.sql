-- =============================================================================
-- The Sofa Studio & Furniture Co. - Vercel Postgres (Neon) Database Schema
-- Barasat, North 24 Parganas, West Bengal, India
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TAX REGIME CONFIGURATION & STATUTORY COMPLIANCE (Section 2)
-- -----------------------------------------------------------------------------
-- Governs the entire tax strategy. The flag defaults to FALSE (unregistered).
CREATE TABLE IF NOT EXISTS tax_config (
    id SERIAL PRIMARY KEY,
    tax_regime_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    registration_number VARCHAR(30), -- GSTIN (e.g. 19AAAAA0000A1Z5)
    registration_date DATE,          -- Effective-from date
    deregistration_date DATE,        -- Optional cancellation date
    state_code VARCHAR(10) NOT NULL DEFAULT '19', -- 19 = West Bengal
    state_name VARCHAR(100) NOT NULL DEFAULT 'West Bengal',
    composition_scheme BOOLEAN NOT NULL DEFAULT FALSE,
    filing_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    legal_name VARCHAR(255) NOT NULL DEFAULT 'The Sofa Studio & Furniture Co.',
    trade_name VARCHAR(255) NOT NULL DEFAULT 'The Sofa Studio',
    principal_place_of_business TEXT NOT NULL DEFAULT 'Barasat, North 24 Parganas, West Bengal - 700124',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed single configuration record (Dormant by default)
INSERT INTO tax_config (id, tax_regime_enabled, state_code, state_name, legal_name, trade_name, principal_place_of_business)
VALUES (1, FALSE, '19', 'West Bengal', 'The Sofa Studio & Furniture Co.', 'The Sofa Studio', 'Barasat, North 24 Parganas, West Bengal - 700124')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. RAW MATERIAL STORE & MULTI-UOM (Section 4.1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_materials (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- TIMBER, SHEET_GOODS, VENEER_LAMINATE, FOAM, FABRIC_LEATHER, HARDWARE, CONSUMABLES, PACKING
    purchase_uom VARCHAR(20) NOT NULL,    -- e.g. CFT, Sheet, Roll
    stock_uom VARCHAR(20) NOT NULL,       -- e.g. CFT, Sheet, Metres
    consumption_uom VARCHAR(20) NOT NULL, -- e.g. Running Feet, Sq. Ft., Metres, Pieces
    uom_conversion_ratio NUMERIC(10, 4) NOT NULL DEFAULT 1.0, -- 1 purchase_uom = X consumption_uom
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.0 CHECK (current_stock >= 0),
    allocated_to_wip NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    issued_to_vendors NUMERIC(12, 2) NOT NULL DEFAULT 0.0, -- Stock with vendor (OUR ASSET)
    reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 5.0,
    current_cost_per_stock_uom NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost_basis VARCHAR(30) NOT NULL DEFAULT 'GST_INCLUSIVE', -- GST_INCLUSIVE (Flag OFF) or NET_TAXABLE (Flag ON)
    
    -- Nullable Tax Columns From Day One (Section 2.3 Rule 2)
    hsn_code VARCHAR(20) DEFAULT '4407',
    tax_rate NUMERIC(5, 2) DEFAULT 18.00,
    
    -- Type-specific attributes
    species VARCHAR(100),       -- For Timber: Sal, Segun (Teak), Mehogini, Pine
    moisture_pct NUMERIC(5, 2), -- Moisture %
    seasoning_date DATE,
    kiln_batch_no VARCHAR(100),
    board_type VARCHAR(50),     -- Plywood, MDF, Particle Board
    thickness_mm NUMERIC(5, 2),
    board_grade VARCHAR(50),    -- MR, BWR, BWP
    foam_density NUMERIC(5, 2), -- Foam density kg/m3
    fabric_shade VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Material batches and physical dye lots (Section 4.1)
CREATE TABLE IF NOT EXISTS material_stock_batches (
    id SERIAL PRIMARY KEY,
    material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    dye_lot VARCHAR(100),       -- CRITICAL: dye lot tracking for fabric and laminates
    quantity_remaining NUMERIC(12, 2) NOT NULL CHECK (quantity_remaining >= 0),
    uom VARCHAR(20) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    cost_basis VARCHAR(30) NOT NULL DEFAULT 'GST_INCLUSIVE',
    supplier_name VARCHAR(255),
    supplier_invoice_ref VARCHAR(100),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    embedded_tax_amount NUMERIC(12, 2) DEFAULT 0.00, -- For Section 18(1)(a) Transitional Credit Report
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Offcut and remnant inventory (usable scrap logged with dimensions)
CREATE TABLE IF NOT EXISTS offcut_scrap_inventory (
    id SERIAL PRIMARY KEY,
    material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    material_type VARCHAR(50) NOT NULL, -- WOOD_OFFCUT, PLY_REMNANT, FABRIC_SCRAP, FOAM_OFFCUT
    dimensions VARCHAR(100) NOT NULL,   -- e.g. "4.5 ft x 8 inch"
    quantity INT NOT NULL DEFAULT 1,
    approx_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    location VARCHAR(100) DEFAULT 'Factory Offcut Rack B',
    logged_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- -----------------------------------------------------------------------------
-- 3. IN-HOUSE WIP & PRODUCTION BY STAGE (Section 4.3)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS karigar_masters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(50) NOT NULL, -- FRAME, UPHOLSTERY, POLISH, CARPENTRY
    mobile_number VARCHAR(20),
    default_piece_rate NUMERIC(10, 2) NOT NULL DEFAULT 1200.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_work_orders (
    id SERIAL PRIMARY KEY,
    wo_number VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    target_completion_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PRODUCTION', -- DRAFT, MATERIAL_ISSUED, IN_PRODUCTION, QC_PASSED, COMPLETED
    current_stage VARCHAR(50) NOT NULL DEFAULT 'FRAME_ASSEMBLY',
    actual_material_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    actual_labour_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily stage-wise production logs capturing piece rates & QC (Section 4.3)
CREATE TABLE IF NOT EXISTS production_stage_logs (
    id SERIAL PRIMARY KEY,
    work_order_id INT NOT NULL REFERENCES production_work_orders(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL, -- CUTTING, FRAME_ASSEMBLY, SANDING, FOAMING, UPHOLSTERY, POLISHING, HARDWARE_FITTING, QC_INSPECTION, PACKING
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift VARCHAR(20) NOT NULL DEFAULT 'Morning',
    karigar_id INT REFERENCES karigar_masters(id),
    karigar_name VARCHAR(255),
    units_attempted INT NOT NULL DEFAULT 0,
    units_passed INT NOT NULL DEFAULT 0,
    units_rework INT NOT NULL DEFAULT 0,
    units_rejected INT NOT NULL DEFAULT 0,
    rework_reason TEXT,
    rejection_reason TEXT,
    piece_rate_earned NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. JOB WORK & OUTSOURCED VENDOR STOCK (Section 4.4)
-- Material issued remains OUR ASSET ("Stock with Vendor")
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_work_vendors (
    id SERIAL PRIMARY KEY,
    trade_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    agreed_wastage_pct NUMERIC(5, 2) NOT NULL DEFAULT 3.0,
    quality_rating NUMERIC(3, 1) NOT NULL DEFAULT 4.5,
    is_gst_registered BOOLEAN NOT NULL DEFAULT FALSE,
    vendor_gstin VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_work_orders (
    id SERIAL PRIMARY KEY,
    jwo_number VARCHAR(50) UNIQUE NOT NULL,
    vendor_id INT NOT NULL REFERENCES job_work_vendors(id) ON DELETE RESTRICT,
    operation_type VARCHAR(50) NOT NULL, -- POLISHING, UPHOLSTERY, CNC_CUTTING, FRAME_WORK
    target_item_description VARCHAR(255) NOT NULL,
    quantity_expected INT NOT NULL CHECK (quantity_expected > 0),
    rate_per_unit NUMERIC(10, 2) NOT NULL,
    
    -- Delivery Challan Details (Section 2.2)
    challan_number VARCHAR(50) NOT NULL,
    challan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    regime_at_creation VARCHAR(30) NOT NULL DEFAULT 'UNREGISTERED', -- IMMUTABLE
    statutory_return_deadline DATE NOT NULL, -- 1-year rule for inputs under Section 143
    status VARCHAR(50) NOT NULL DEFAULT 'CHALLAN_ISSUED', -- CHALLAN_ISSUED, MATERIAL_RECEIVED_BY_VENDOR, PARTIAL_RETURN, RECONCILED
    quantity_received INT NOT NULL DEFAULT 0,
    scrap_returned_description TEXT,
    actual_wastage_qty NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Line items of raw material issued to the vendor
CREATE TABLE IF NOT EXISTS job_work_challan_materials (
    id SERIAL PRIMARY KEY,
    job_work_order_id INT NOT NULL REFERENCES job_work_orders(id) ON DELETE CASCADE,
    material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
    material_name VARCHAR(255) NOT NULL,
    quantity_issued NUMERIC(12, 2) NOT NULL CHECK (quantity_issued > 0),
    uom VARCHAR(20) NOT NULL,
    unit_value NUMERIC(12, 2) NOT NULL,
    hsn_code VARCHAR(20) DEFAULT '4407',
    tax_rate NUMERIC(5, 2) DEFAULT 18.00
);

-- -----------------------------------------------------------------------------
-- 5. FINISHED GOODS, SKUS & UNIT IDENTITY (Section 4.5)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finished_goods (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    carton_count INT NOT NULL DEFAULT 1, -- Multi-carton validation
    current_quantity INT NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    current_cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Nullable Tax Columns From Day One (Section 2.3 Rule 2)
    hsn_code VARCHAR(20) DEFAULT '9401',
    tax_rate NUMERIC(5, 2) DEFAULT 18.00,
    
    -- Dimensional data
    assembled_length_cm NUMERIC(8, 2) DEFAULT 210.0,
    assembled_width_cm NUMERIC(8, 2) DEFAULT 90.0,
    assembled_height_cm NUMERIC(8, 2) DEFAULT 85.0,
    boxed_cubic_volume_cft NUMERIC(8, 2) DEFAULT 48.0,
    total_weight_kg NUMERIC(8, 2) DEFAULT 65.0,
    min_door_clearance_inches NUMERIC(8, 2) DEFAULT 32.0,
    
    floor_model_count INT NOT NULL DEFAULT 0,
    last_restocked_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unit-level identity serials and floor sample lifecycle (Section 4.5)
CREATE TABLE IF NOT EXISTS finished_unit_serials (
    serial_no VARCHAR(100) PRIMARY KEY,
    product_id INT NOT NULL REFERENCES finished_goods(id) ON DELETE CASCADE,
    condition_grade VARCHAR(50) NOT NULL DEFAULT 'NEW_IN_BOX', -- NEW_IN_BOX, FLOOR_MODEL, OPEN_BOX, MINOR_DAMAGE, CLEARANCE
    is_floor_sample BOOLEAN NOT NULL DEFAULT FALSE,
    floor_placement_date DATE,
    missing_carton_flag BOOLEAN NOT NULL DEFAULT FALSE, -- Multi-carton check: If missing, unsellable
    missing_carton_notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',   -- AVAILABLE, RESERVED, SOLD_DELIVERED, DAMAGED
    location VARCHAR(100) NOT NULL DEFAULT 'SHOWROOM_FLOOR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. SALES ORDERS & BILINGUAL BILLING (Section 4.6)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_orders (
    id SERIAL PRIMARY KEY,
    document_number VARCHAR(50) UNIQUE NOT NULL, -- CM-2026-XXXX or INV-2026-XXXX
    document_type VARCHAR(30) NOT NULL DEFAULT 'CASH_MEMO', -- CASH_MEMO (Flag OFF) or TAX_INVOICE (Flag ON)
    regime_at_creation VARCHAR(30) NOT NULL DEFAULT 'UNREGISTERED', -- IMMUTABLE: Records regime at creation time
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    delivery_pincode VARCHAR(10) NOT NULL,
    delivery_zone VARCHAR(100) NOT NULL,
    floor_level INT NOT NULL DEFAULT 0,
    has_lift BOOLEAN NOT NULL DEFAULT TRUE,
    floor_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_mode VARCHAR(30) NOT NULL DEFAULT 'CASH',
    
    -- Values & Tax Splits (Nullable when flag is off)
    subtotal NUMERIC(12, 2) NOT NULL,
    taxable_total NUMERIC(12, 2) DEFAULT 0.00,
    cgst_total NUMERIC(12, 2) DEFAULT 0.00,
    sgst_total NUMERIC(12, 2) DEFAULT 0.00,
    igst_total NUMERIC(12, 2) DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL,
    khata_balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    is_composite_priced BOOLEAN NOT NULL DEFAULT TRUE, -- Composite pricing default
    is_marketplace_order BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
    id SERIAL PRIMARY KEY,
    sales_order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES finished_goods(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    taxable_value NUMERIC(12, 2) DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) DEFAULT 18.00,
    hsn_code VARCHAR(20) DEFAULT '9401',
    line_total NUMERIC(12, 2) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 7. KHATA / UDHAAR CUSTOMER CREDIT LEDGER (Section 4.6)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS khata_accounts (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) UNIQUE NOT NULL,
    customer_address TEXT,
    total_credit_granted NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    last_payment_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS khata_transactions (
    id SERIAL PRIMARY KEY,
    khata_id INT NOT NULL REFERENCES khata_accounts(id) ON DELETE CASCADE,
    trans_date DATE NOT NULL DEFAULT CURRENT_DATE,
    trans_type VARCHAR(30) NOT NULL, -- DEBIT_PURCHASE or CREDIT_PAYMENT
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    reference_invoice VARCHAR(50),
    payment_mode VARCHAR(30) DEFAULT 'CASH',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. IMMUTABLE STOCK AUDIT LEDGER (Section 4.10)
-- Full audit trail on every quantity change: user, timestamp, reason code
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_audit_ledger (
    id SERIAL PRIMARY KEY,
    trans_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    item_type VARCHAR(50) NOT NULL, -- RAW_MATERIAL, WIP_UNIT, VENDOR_ASSET, FINISHED_GOOD
    item_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    change_quantity NUMERIC(12, 2) NOT NULL,
    stock_state_from VARCHAR(50),
    stock_state_to VARCHAR(50),
    reason_code VARCHAR(50) NOT NULL, -- PURCHASE_INWARD, WORK_ORDER_ISSUE, JOB_WORK_DISPATCH, VENDOR_RETURN, SCRAP_LOG, RETAIL_SALE, WRITE_OFF
    user_name VARCHAR(100) NOT NULL DEFAULT 'Shop Owner',
    device_info VARCHAR(100) DEFAULT 'Barasat Counter Terminal'
);

-- Indexes for lightning queries
CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);
CREATE INDEX IF NOT EXISTS idx_batches_material ON material_stock_batches(material_id);
CREATE INDEX IF NOT EXISTS idx_batches_dye_lot ON material_stock_batches(dye_lot);
CREATE INDEX IF NOT EXISTS idx_stage_logs_wo ON production_stage_logs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_job_work_vendor ON job_work_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_regime ON sales_orders(regime_at_creation);
CREATE INDEX IF NOT EXISTS idx_sales_orders_doc ON sales_orders(document_number);
CREATE INDEX IF NOT EXISTS idx_khata_phone ON khata_accounts(customer_phone);

-- -----------------------------------------------------------------------------
-- INITIAL REALISTIC SEED DATA (Barasat Workshop & Showroom)
-- -----------------------------------------------------------------------------

-- 1. Raw Materials
INSERT INTO raw_materials (id, sku, name, category, purchase_uom, stock_uom, consumption_uom, uom_conversion_ratio, current_stock, allocated_to_wip, issued_to_vendors, current_cost_per_stock_uom, species, moisture_pct, seasoning_date, hsn_code, tax_rate)
VALUES
    (1, 'RM-TIM-001', 'Seasoned Sal Wood Planks (১০ ফুট সাইজ)', 'TIMBER', 'CFT', 'CFT', 'Running Feet', 10.0, 45.0, 10.0, 8.0, 2400.00, 'Sal', 11.2, '2026-08-10', '4407', 18.0),
    (2, 'RM-TIM-002', 'Burma Segun (Teak) Timber Block (সেগুন কাঠ)', 'TIMBER', 'CFT', 'CFT', 'Running Feet', 12.0, 28.0, 5.0, 4.0, 4800.00, 'Segun (Teak)', 10.5, '2026-07-15', '4407', 18.0),
    (3, 'RM-PLY-001', 'BWP Marine 19mm Plywood (710 Grade, 8x4 Sheet)', 'SHEET_GOODS', 'Sheet', 'Sheet', 'Sq. Ft.', 32.0, 35.0, 12.0, 0.0, 2750.00, NULL, NULL, NULL, '4412', 18.0),
    (4, 'RM-FOAM-001', 'Sleepwell 40 Density PU Foam Sheet (4-inch)', 'FOAM', 'Sheet', 'Sheet', 'Pieces', 6.0, 20.0, 8.0, 0.0, 3100.00, NULL, NULL, NULL, '3921', 18.0),
    (5, 'RM-FAB-001', 'Royal Navy Velvet Upholstery Fabric (Lot #B-88)', 'FABRIC_LEATHER', 'Roll', 'Roll', 'Metres', 50.0, 3.5, 1.2, 0.8, 14500.00, NULL, NULL, NULL, '5407', 12.0)
ON CONFLICT (id) DO NOTHING;

-- 2. Material Batches with Dye Lots
INSERT INTO material_stock_batches (id, material_id, batch_number, dye_lot, quantity_remaining, uom, unit_cost, supplier_name, supplier_invoice_ref, purchase_date, embedded_tax_amount)
VALUES
    (1, 1, 'BATCH-SAL-01', NULL, 45.0, 'CFT', 2400.00, 'Kolkata Timber Mart, Nimtala', 'KTM-892', '2026-08-12', 16474.00),
    (2, 2, 'BATCH-TEAK-02', NULL, 28.0, 'CFT', 4800.00, 'Assam Forest Syndicate', 'AFS-441', '2026-07-20', 20512.00),
    (3, 5, 'BATCH-FAB-88A', 'LOT-NAVY-88', 1.8, 'Roll', 14500.00, 'Surat Velvet Mills', 'SVM-9901', '2026-08-25', 3107.00),
    (4, 5, 'BATCH-FAB-88B', 'LOT-NAVY-92', 1.7, 'Roll', 14500.00, 'Surat Velvet Mills', 'SVM-1044', '2026-09-02', 2935.00)
ON CONFLICT (id) DO NOTHING;

-- 3. Finished Goods
INSERT INTO finished_goods (id, sku, name, category, carton_count, current_quantity, current_cost_per_unit, selling_price, hsn_code, tax_rate)
VALUES
    (1, 'FG-SOFA-001', '3-Seater Chesterfield Sofa - Royal Navy Velvet', 'Sofa', 1, 6, 26500.00, 42000.00, '9401', 18.00),
    (2, 'FG-SOFA-002', 'L-Shape Modular Sectional Sofa (4-Carton Boxed)', 'Sofa', 4, 4, 38000.00, 58500.00, '9401', 18.00),
    (3, 'FG-REC-001', 'Dark Cognac Leatherette Manual Recliner', 'Recliner', 1, 8, 19500.00, 31000.00, '9401', 18.00),
    (4, 'FG-DIN-001', 'Solid Segun Wood 6-Seater Dining Set with Chairs', 'Dining Set', 3, 3, 32000.00, 49000.00, '9403', 18.00),
    (5, 'FG-BED-001', 'King Size Hydraulic Storage Bed - Charcoal Grey', 'Bed', 3, 2, 24000.00, 36500.00, '9403', 18.00)
ON CONFLICT (id) DO NOTHING;

-- 4. Job Work Vendors
INSERT INTO job_work_vendors (id, trade_name, contact_person, phone, address, agreed_wastage_pct, quality_rating, is_gst_registered, vendor_gstin)
VALUES
    (1, 'Maa Tara Polishing Workshop (মা তারা পলিশ)', 'Bikash Mondal', '9830112233', 'Champadali More, Barasat', 2.5, 4.8, FALSE, NULL),
    (2, 'Master Art Upholstery Works', 'Rahim Ali', '9831998877', 'Madhyamgram Chowmatha', 3.0, 4.6, TRUE, '19AABCM1122D1Z8'),
    (3, 'Swapan CNC & Woodcarving Studio', 'Swapan Paul', '9433445566', 'Duttapukur Station Road', 1.5, 4.9, FALSE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. Karigar Masters
INSERT INTO karigar_masters (id, name, specialty, mobile_number, default_piece_rate)
VALUES
    (1, 'Nirod Sutradhar (নিরোদ মিস্ত্রি)', 'CARPENTRY', '9836001122', 1500.00),
    (2, 'Babulal Das (বাবুলাল)', 'UPHOLSTERY', '9836112233', 1200.00),
    (3, 'Gouranga Paul (গৌরাঙ্গ)', 'POLISH', '9836223344', 1100.00)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('raw_materials', 'id'), COALESCE((SELECT MAX(id) FROM raw_materials), 1));
SELECT setval(pg_get_serial_sequence('finished_goods', 'id'), COALESCE((SELECT MAX(id) FROM finished_goods), 1));
