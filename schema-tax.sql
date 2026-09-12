-- =============================================================================
-- Loknath Sofa Center - Tax Regime Schema
--
-- The shop is currently UNREGISTERED (below the WB ₹40L goods threshold).
-- The tax regime is fully modelled here and switched OFF by default.
-- No migration is required to enable it later: every tax column exists now,
-- nullable, from this first migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Current tax configuration (single row, id = 1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_config (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    tax_regime_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    registration_number VARCHAR(20),          -- GSTIN
    registration_date DATE,
    deregistration_date DATE,
    state_code VARCHAR(2) NOT NULL DEFAULT '19',   -- 19 = West Bengal
    composition_scheme BOOLEAN NOT NULL DEFAULT FALSE,
    filing_frequency VARCHAR(10) NOT NULL DEFAULT 'quarterly'
        CHECK (filing_frequency IN ('monthly', 'quarterly')),
    legal_name VARCHAR(200),
    trade_name VARCHAR(200),
    principal_place_of_business TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Registration periods.
--
-- A single registration_date/deregistration_date pair cannot express a business
-- that was unregistered -> registered -> unregistered -> registered again.
-- Each enable/disable writes a period here, and the regime applicable to any
-- given date is resolved by looking up which period contains that date.
-- This is what makes historical documents render correctly forever.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_regime_periods (
    id SERIAL PRIMARY KEY,
    registration_number VARCHAR(20),
    from_date DATE NOT NULL,
    to_date DATE,                              -- NULL = currently active
    state_code VARCHAR(2) NOT NULL DEFAULT '19',
    composition_scheme BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (to_date IS NULL OR to_date >= from_date)
);

CREATE INDEX IF NOT EXISTS idx_tax_periods_dates ON tax_regime_periods(from_date, to_date);

-- -----------------------------------------------------------------------------
-- Tax rules as CONFIGURATION DATA, never hardcoded constants.
-- Thresholds, HSN rates, e-way bill exemptions and job-work return deadlines
-- all live here so they can be changed without a deployment.
--
-- verified_by_ca defaults FALSE: nothing here is authoritative until the
-- shop's chartered accountant has signed it off.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rules (
    id SERIAL PRIMARY KEY,
    rule_type VARCHAR(40) NOT NULL,   -- hsn_rate | threshold | eway_exemption | jobwork_deadline | alert_band
    rule_key VARCHAR(80) NOT NULL,
    numeric_value NUMERIC(16, 4),
    text_value TEXT,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    notes TEXT,
    verified_by_ca BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rule_type, rule_key, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_lookup ON tax_rules(rule_type, rule_key, effective_from DESC);

-- -----------------------------------------------------------------------------
-- Document numbering series.
-- Cash memo and tax invoice must use SEPARATE statutory series.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_series (
    id SERIAL PRIMARY KEY,
    series_code VARCHAR(30) NOT NULL,     -- CASH_MEMO | TAX_INVOICE | DC_INTERNAL | DC_RULE45
    financial_year VARCHAR(9) NOT NULL,   -- e.g. 2026-27
    prefix VARCHAR(20) NOT NULL DEFAULT '',
    next_number INT NOT NULL DEFAULT 1,
    requires_regime BOOLEAN,              -- TRUE = only when registered, FALSE = only when unregistered, NULL = any
    UNIQUE (series_code, financial_year)
);

-- -----------------------------------------------------------------------------
-- Tax fields on existing masters (nullable, dormant while the flag is off)
-- -----------------------------------------------------------------------------
ALTER TABLE materials ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2);
ALTER TABLE products  ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);
ALTER TABLE products  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2);

-- -----------------------------------------------------------------------------
-- Purchase / tax capture on received stock.
--
-- Tax amounts are recorded EVEN WHILE UNREGISTERED. While the flag is off the
-- tax forms part of item cost (unrecoverable), but it must still be stored
-- separately, because the transitional credit claim on the day of registration
-- depends on knowing the embedded tax in stock on hand.
-- -----------------------------------------------------------------------------
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(60);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE;
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS supplier_gstin VARCHAR(20);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(14, 2);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(14, 2);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(14, 2);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(14, 2);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS cess_amount NUMERIC(14, 2);
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(2);
-- 'inclusive' = tax sits inside rate (unregistered), 'net' = tax excluded, credited to ITC
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS cost_basis VARCHAR(10) NOT NULL DEFAULT 'inclusive';
-- Regime state captured AT RECEIPT, never re-read from the global flag later
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS regime_at_receipt BOOLEAN NOT NULL DEFAULT FALSE;

-- -----------------------------------------------------------------------------
-- Seed: current config, unregistered
-- -----------------------------------------------------------------------------
INSERT INTO tax_config (id, tax_regime_enabled, state_code, filing_frequency, trade_name,
                        principal_place_of_business)
VALUES (1, FALSE, '19', 'quarterly', 'Loknath Sofa Center',
        'Barasat, North 24 Parganas, West Bengal')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: rules. ALL UNVERIFIED — the shop's CA must confirm before reliance.
-- -----------------------------------------------------------------------------
INSERT INTO tax_rules (rule_type, rule_key, numeric_value, text_value, notes) VALUES
    ('threshold', 'goods_registration_threshold', 4000000, NULL,
     'Aggregate turnover threshold for goods in West Bengal. Verify with CA.'),
    ('threshold', 'services_registration_threshold', 2000000, NULL,
     'Lower threshold applies if services are billed separately. Verify with CA.'),
    ('alert_band', 'turnover_amber', 3000000, NULL, 'Amber warning band'),
    ('alert_band', 'turnover_red', 3500000, NULL, 'Red warning band'),
    ('alert_band', 'turnover_blocking', 3800000, NULL, 'Blocking warning band'),
    ('jobwork_deadline', 'inputs_return_months', 12, NULL,
     'Inputs must return from job worker within 1 year or dispatch is deemed a supply'),
    ('jobwork_deadline', 'capital_goods_return_months', 36, NULL,
     'Capital goods must return within 3 years'),
    ('jobwork_deadline', 'alert_at_months', 9, NULL, 'Escalate before the deadline'),
    ('eway_exemption', 'intrastate_jobwork_wb', 1, 'exempt',
     'Intra-state job work movement within WB: principal->job worker, job worker->job worker, and return. Verify with CA.'),
    ('threshold', 'eway_bill_consignment_value', 50000, NULL,
     'Consignment value above which an e-way bill is required. Verify with CA.')
ON CONFLICT (rule_type, rule_key, effective_from) DO NOTHING;

-- Common furniture HSN codes as EDITABLE SUGGESTIONS. Rates change; unverified.
INSERT INTO tax_rules (rule_type, rule_key, numeric_value, text_value, notes) VALUES
    ('hsn_rate', '9401', 18, 'Seats — sofas, chairs, recliners', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '9403', 18, 'Other furniture — beds, wardrobes, tables', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '9404', 18, 'Mattresses, cushions, quilts', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '4407', 18, 'Wood sawn or chipped lengthwise', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '4412', 18, 'Plywood, veneered panels', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '3921', 18, 'Plastic sheets — PU foam', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '5801', 5,  'Woven pile fabrics, upholstery fabric', 'Rate varies by value. Verify with CA.'),
    ('hsn_rate', '3506', 18, 'Prepared adhesives', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '3208', 18, 'Varnishes, PU/NC polish', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '8302', 18, 'Base metal mountings, hinges, castors', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '9607', 12, 'Slide fasteners — zippers', 'Suggestion only. Verify with CA.'),
    ('hsn_rate', '9988', 18, 'Job work services — manufacturing on physical inputs', 'Rate varies. Verify with CA.')
ON CONFLICT (rule_type, rule_key, effective_from) DO NOTHING;

-- Numbering series for the current financial year
INSERT INTO document_series (series_code, financial_year, prefix, next_number, requires_regime) VALUES
    ('CASH_MEMO',   '2026-27', 'CM/26-27/', 1, FALSE),
    ('TAX_INVOICE', '2026-27', 'TI/26-27/', 1, TRUE),
    ('DC_INTERNAL', '2026-27', 'DC/26-27/', 1, FALSE),
    ('DC_RULE45',   '2026-27', 'JW/26-27/', 1, TRUE)
ON CONFLICT (series_code, financial_year) DO NOTHING;
