-- =============================================================================
-- Loknath / SofaInventory - Manufacturing ERP Schema
-- STEP 1: Material master (multi-UOM, batch & dye-lot) + multi-level BOM
--
-- Runs alongside schema.sql (finished-goods tables). Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Unit of Measure master
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uoms (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(80) NOT NULL,
    dimension VARCHAR(20) NOT NULL,   -- length | area | volume | weight | liquid | count
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Material categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL,
    -- Drives which type-specific attributes apply to materials in this category
    material_type VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Materials (raw material master)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    code VARCHAR(40) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id INT NOT NULL REFERENCES material_categories(id),
    material_type VARCHAR(40) NOT NULL,

    -- Multi-UOM: bought in one unit, stocked in another, consumed in a third.
    -- e.g. timber bought in CFT, stocked in CFT, issued in RFT.
    purchase_uom VARCHAR(20) NOT NULL,
    stock_uom VARCHAR(20) NOT NULL,
    consumption_uom VARCHAR(20) NOT NULL,
    -- 1 purchase_uom = purchase_to_stock_factor x stock_uom
    purchase_to_stock_factor NUMERIC(16, 6) NOT NULL DEFAULT 1
        CHECK (purchase_to_stock_factor > 0),
    -- 1 stock_uom = stock_to_consumption_factor x consumption_uom
    stock_to_consumption_factor NUMERIC(16, 6) NOT NULL DEFAULT 1
        CHECK (stock_to_consumption_factor > 0),

    -- Traceability controls
    tracks_batch BOOLEAN NOT NULL DEFAULT FALSE,
    tracks_dye_lot BOOLEAN NOT NULL DEFAULT FALSE,
    shelf_life_days INT,                       -- NULL = does not expire
    is_hazardous BOOLEAN NOT NULL DEFAULT FALSE,

    -- Planning & costing
    reorder_level NUMERIC(16, 3) NOT NULL DEFAULT 0,
    standard_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- per stock UOM
    hsn_code VARCHAR(20),

    -- Offcut / remnant stock links back to the material it was cut from
    is_offcut BOOLEAN NOT NULL DEFAULT FALSE,
    parent_material_id INT REFERENCES materials(id),

    -- Type-specific attributes (species/grade/moisture, GSM/shade, density/ILD, ...)
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Material batches / dye lots
-- Shade-critical materials (fabric, laminate, veneer) must be reserved from a
-- single lot per order, so lot identity is tracked at batch level.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_batches (
    id SERIAL PRIMARY KEY,
    material_id INT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    batch_no VARCHAR(60) NOT NULL,
    dye_lot VARCHAR(60),

    quantity NUMERIC(16, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),  -- in stock UOM
    rate NUMERIC(14, 2) NOT NULL DEFAULT 0,

    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,                          -- FIFO enforcement for chemicals

    -- Timber-specific seasoning records
    moisture_pct NUMERIC(5, 2),
    seasoning_date DATE,
    kiln_batch VARCHAR(60),

    location VARCHAR(80),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (material_id, batch_no)
);

-- -----------------------------------------------------------------------------
-- Products: finished goods AND sub-assemblies (both can carry a BOM)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(40) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    product_type VARCHAR(20) NOT NULL DEFAULT 'finished',  -- finished | sub_assembly
    category VARCHAR(80),
    uom VARCHAR(20) NOT NULL DEFAULT 'NOS',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- BOM header, versioned with effective dates so old orders keep their recipe
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boms (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',   -- draft | active | archived
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    output_quantity NUMERIC(16, 3) NOT NULL DEFAULT 1 CHECK (output_quantity > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, version)
);

-- -----------------------------------------------------------------------------
-- BOM lines: either a raw material or a nested sub-assembly (multi-level)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bom_lines (
    id SERIAL PRIMARY KEY,
    bom_id INT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    line_type VARCHAR(20) NOT NULL,                -- material | sub_assembly
    material_id INT REFERENCES materials(id),
    child_product_id INT REFERENCES products(id),

    quantity NUMERIC(16, 4) NOT NULL CHECK (quantity > 0),
    uom VARCHAR(20) NOT NULL,
    -- Standard yield loss: fabric cutting, timber conversion, foam offcut.
    -- Actual vs standard variance is the key inefficiency/theft indicator.
    wastage_pct NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (wastage_pct >= 0),

    notes TEXT,
    sort_order INT NOT NULL DEFAULT 0,

    CONSTRAINT bom_line_target_valid CHECK (
        (line_type = 'material'     AND material_id IS NOT NULL AND child_product_id IS NULL) OR
        (line_type = 'sub_assembly' AND child_product_id IS NOT NULL AND material_id IS NULL)
    )
);

-- -----------------------------------------------------------------------------
-- Audit log: every quantity/master change. `actor` defaults to the owner today
-- and will carry the Google-authenticated email once sign-in is added.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    entity VARCHAR(60) NOT NULL,
    entity_id VARCHAR(60) NOT NULL,
    action VARCHAR(40) NOT NULL,
    actor VARCHAR(160) NOT NULL DEFAULT 'owner',
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(material_type);
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
CREATE INDEX IF NOT EXISTS idx_material_batches_material ON material_batches(material_id, received_date);
CREATE INDEX IF NOT EXISTS idx_material_batches_expiry ON material_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_boms_product ON boms(product_id, status);
CREATE INDEX IF NOT EXISTS idx_bom_lines_bom ON bom_lines(bom_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Seed: UOMs commonly used in an Indian furniture unit
-- -----------------------------------------------------------------------------
INSERT INTO uoms (code, name, dimension) VALUES
    ('CFT',   'Cubic Feet',    'volume'),
    ('RFT',   'Running Feet',  'length'),
    ('SQFT',  'Square Feet',   'area'),
    ('SHEET', 'Sheet',         'count'),
    ('MTR',   'Meter',         'length'),
    ('ROLL',  'Roll',          'count'),
    ('KG',    'Kilogram',      'weight'),
    ('LTR',   'Litre',         'liquid'),
    ('NOS',   'Numbers',       'count'),
    ('PCS',   'Pieces',        'count'),
    ('SET',   'Set',           'count')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: material categories
-- -----------------------------------------------------------------------------
INSERT INTO material_categories (name, material_type) VALUES
    ('Timber',            'timber'),
    ('Plywood & Boards',  'panel'),
    ('Veneer & Laminate', 'veneer_laminate'),
    ('Foam',              'foam'),
    ('Fabric & Leather',  'fabric_leather'),
    ('Webbing & Springs', 'hardware'),
    ('Hardware',          'hardware'),
    ('Adhesives & Polish','adhesive_chemical'),
    ('Packing Material',  'packing')
ON CONFLICT (name) DO NOTHING;
