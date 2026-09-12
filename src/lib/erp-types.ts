/**
 * Manufacturing ERP types - Step 1: material master + BOM.
 */

export type MaterialType =
  | "timber"
  | "panel"
  | "veneer_laminate"
  | "foam"
  | "fabric_leather"
  | "hardware"
  | "adhesive_chemical"
  | "packing"
  | "misc";

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  timber: "Timber",
  panel: "Plywood / Board",
  veneer_laminate: "Veneer / Laminate",
  foam: "Foam",
  fabric_leather: "Fabric / Leather",
  hardware: "Hardware",
  adhesive_chemical: "Adhesive / Chemical",
  packing: "Packing",
  misc: "Miscellaneous",
};

/**
 * Type-specific attribute fields. Which of these apply is driven by the
 * material type, so a timber record captures species/grade/moisture while a
 * fabric record captures GSM/width/shade.
 */
export interface AttributeField {
  key: string;
  label: string;
  type: "text" | "number";
  unit?: string;
  placeholder?: string;
}

export const TYPE_ATTRIBUTES: Record<MaterialType, AttributeField[]> = {
  timber: [
    { key: "species", label: "Species", type: "text", placeholder: "Sheesham, Teak, Mango" },
    { key: "grade", label: "Grade", type: "text", placeholder: "A / B / C" },
    { key: "moisture_pct", label: "Moisture", type: "number", unit: "%" },
    { key: "seasoning", label: "Seasoning", type: "text", placeholder: "Kiln dried / Air dried" },
  ],
  panel: [
    { key: "thickness_mm", label: "Thickness", type: "number", unit: "mm" },
    { key: "grade", label: "Grade", type: "text", placeholder: "MR / BWR / BWP" },
    { key: "sheet_size", label: "Sheet Size", type: "text", placeholder: "8x4 ft" },
  ],
  veneer_laminate: [
    { key: "shade_code", label: "Shade Code", type: "text", placeholder: "e.g. 1234 SF" },
    { key: "thickness_mm", label: "Thickness", type: "number", unit: "mm" },
    { key: "finish", label: "Finish", type: "text", placeholder: "Matt / Gloss / Suede" },
  ],
  foam: [
    { key: "density", label: "Density", type: "number", unit: "kg/m³" },
    { key: "thickness_mm", label: "Thickness", type: "number", unit: "mm" },
    { key: "ild", label: "ILD (Firmness)", type: "number" },
  ],
  fabric_leather: [
    { key: "width_inch", label: "Width", type: "number", unit: "inch" },
    { key: "gsm", label: "GSM", type: "number" },
    { key: "shade", label: "Shade", type: "text", placeholder: "Royal Navy" },
    { key: "composition", label: "Composition", type: "text", placeholder: "Velvet / Bouclé / PU" },
  ],
  hardware: [
    { key: "size", label: "Size", type: "text", placeholder: '4" / 12mm' },
    { key: "finish", label: "Finish", type: "text", placeholder: "SS / Brass / Black" },
    { key: "brand", label: "Brand", type: "text" },
  ],
  adhesive_chemical: [
    { key: "brand", label: "Brand", type: "text" },
    { key: "type", label: "Type", type: "text", placeholder: "PU / NC / Melamine" },
    { key: "coverage", label: "Coverage", type: "text", placeholder: "sq ft per litre" },
  ],
  packing: [
    { key: "size", label: "Size", type: "text" },
    { key: "material", label: "Material", type: "text", placeholder: "Corrugated / Bubble / Foam" },
  ],
  misc: [],
};

export interface Uom {
  id: number;
  code: string;
  name: string;
  dimension: string;
}

export interface MaterialCategory {
  id: number;
  name: string;
  material_type: MaterialType;
}

export interface Material {
  id: number;
  code: string;
  name: string;
  category_id: number;
  category_name?: string;
  material_type: MaterialType;

  purchase_uom: string;
  stock_uom: string;
  consumption_uom: string;
  purchase_to_stock_factor: number;
  stock_to_consumption_factor: number;

  tracks_batch: boolean;
  tracks_dye_lot: boolean;
  shelf_life_days: number | null;
  is_hazardous: boolean;

  reorder_level: number;
  standard_rate: number;
  hsn_code: string | null;

  is_offcut: boolean;
  parent_material_id: number | null;

  attributes: Record<string, string | number>;
  is_active: boolean;

  /** Derived: sum of batch quantities, in stock UOM. */
  stock_quantity?: number;
  /**
   * Derived: stock valued at ACTUAL batch cost, not standard rate. Valuing at
   * standard misstates the balance sheet and breaks reconciliation against
   * stock held with vendors, which is carried at real cost.
   */
  stock_value?: number;
  batch_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MaterialBatch {
  id: number;
  material_id: number;
  batch_no: string;
  dye_lot: string | null;
  quantity: number;
  rate: number;
  received_date: string;
  expiry_date: string | null;
  moisture_pct: number | null;
  seasoning_date: string | null;
  kiln_batch: string | null;
  location: string | null;
  notes: string | null;

  /**
   * Supplier and tax capture. Recorded even while unregistered: the tax sits
   * inside `rate` as unrecoverable cost, but the amount must be known to claim
   * transitional credit on the day of registration.
   */
  supplier_name?: string | null;
  supplier_invoice_no?: string | null;
  supplier_invoice_date?: string | null;
  supplier_gstin?: string | null;
  taxable_value?: number | null;
  tax_rate?: number | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  /** 'inclusive' while unregistered, 'net' once registered */
  cost_basis?: "inclusive" | "net";
  /** Regime captured AT RECEIPT — never re-read from the global flag */
  regime_at_receipt?: boolean;
}

export interface MaterialInput {
  code: string;
  name: string;
  category_id: number;
  material_type: MaterialType;
  purchase_uom: string;
  stock_uom: string;
  consumption_uom: string;
  purchase_to_stock_factor: number;
  stock_to_consumption_factor: number;
  tracks_batch: boolean;
  tracks_dye_lot: boolean;
  shelf_life_days: number | null;
  is_hazardous: boolean;
  reorder_level: number;
  standard_rate: number;
  hsn_code?: string | null;
  attributes: Record<string, string | number>;
}

export interface BatchInput {
  batch_no: string;
  dye_lot?: string | null;
  quantity: number;
  rate: number;
  received_date: string;
  expiry_date?: string | null;
  moisture_pct?: number | null;
  seasoning_date?: string | null;
  kiln_batch?: string | null;
  location?: string | null;
  notes?: string | null;

  /** Supplier and tax capture, populated when the batch arrives via a GRN. */
  supplier_name?: string | null;
  supplier_invoice_no?: string | null;
  supplier_invoice_date?: string | null;
  supplier_gstin?: string | null;
  taxable_value?: number | null;
  tax_rate?: number | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  cost_basis?: "inclusive" | "net";
  regime_at_receipt?: boolean;
}

export type ProductType = "finished" | "sub_assembly";

export interface Product {
  id: number;
  code: string;
  name: string;
  product_type: ProductType;
  category: string | null;
  uom: string;
  is_active: boolean;
}

export type BomStatus = "draft" | "active" | "archived";

export interface Bom {
  id: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  version: number;
  status: BomStatus;
  effective_from: string;
  effective_to: string | null;
  output_quantity: number;
  notes: string | null;
  line_count?: number;
}

export interface BomLine {
  id: number;
  bom_id: number;
  line_type: "material" | "sub_assembly";
  material_id: number | null;
  child_product_id: number | null;
  /** Resolved display fields */
  item_code?: string;
  item_name?: string;
  quantity: number;
  uom: string;
  wastage_pct: number;
  notes: string | null;
  sort_order: number;
  /** Resolved rate for costing, per consumption UOM */
  rate?: number;
}

export interface BomLineInput {
  line_type: "material" | "sub_assembly";
  material_id: number | null;
  child_product_id: number | null;
  quantity: number;
  uom: string;
  wastage_pct: number;
  notes?: string | null;
}

export interface BomInput {
  product_id: number;
  version?: number;
  status: BomStatus;
  effective_from: string;
  output_quantity: number;
  notes?: string | null;
  lines: BomLineInput[];
}

/**
 * One flattened material requirement produced by exploding a multi-level BOM.
 */
export interface ExplodedRequirement {
  material_id: number;
  code: string;
  name: string;
  uom: string;
  /** Quantity before wastage allowance */
  net_quantity: number;
  /** Quantity including standard wastage % */
  gross_quantity: number;
  wastage_pct: number;
  /** Gross quantity converted into the material's stock UOM, which the rate is priced in */
  stock_equivalent: number;
  stock_uom: string;
  /** Standard rate per stock UOM */
  rate: number;
  cost: number;
  /** Sub-assembly path, e.g. "Frame Assembly > Cushion" */
  path: string;
}
