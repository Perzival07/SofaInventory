// =============================================================================
// The Sofa Studio - Data Access Layer (Vercel Postgres + In-Memory Fallback)
// Barasat, North 24 Parganas, West Bengal
// =============================================================================

import { neon } from "@neondatabase/serverless";
import {
  RawMaterialItem,
  MaterialBatch,
  OffcutScrapItem,
  WorkOrder,
  StageProductionLog,
  KarigarMaster,
  JobWorkVendor,
  JobWorkOrder,
  FinishedGoodItem,
  FinishedUnitSerial,
  SalesOrder,
  KhataAccount,
  KhataTransaction,
  TaxConfig,
  TransitionalCreditReport,
  FourStockStatesReconciliation,
  InventoryItem,
  RestockHistoryEntry,
  AddItemInput,
  RestockInput,
  EditItemInput,
} from "./types";
import {
  getActiveTaxConfig,
  updateActiveTaxConfig,
  SalesDocumentPolicy,
  TransitionalCreditService,
} from "./tax-strategy";
import { calculateDeliveryAndFloorSurcharge } from "./local-intelligence";

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
// In-Memory Database Store (Complete offline / zero-config demo store)
// -----------------------------------------------------------------------------
interface EnterpriseMemoryStore {
  rawMaterials: RawMaterialItem[];
  batches: MaterialBatch[];
  offcuts: OffcutScrapItem[];
  workOrders: WorkOrder[];
  stageLogs: StageProductionLog[];
  karigars: KarigarMaster[];
  vendors: JobWorkVendor[];
  jobWorkOrders: JobWorkOrder[];
  finishedGoods: FinishedGoodItem[];
  unitSerials: FinishedUnitSerial[];
  salesOrders: SalesOrder[];
  khataAccounts: KhataAccount[];
  khataTransactions: KhataTransaction[];
  items: InventoryItem[];
  history: RestockHistoryEntry[];
  nextId: { [key: string]: number };
}

const memoryStore: EnterpriseMemoryStore = {
  rawMaterials: [
    {
      id: 1,
      sku: "RM-TIM-001",
      name: "Seasoned Sal Wood Planks (১০ ফুট সাইজ)",
      category: "TIMBER",
      uom: {
        purchase_uom: "CFT",
        stock_uom: "CFT",
        consumption_uom: "Running Feet",
        conversion_ratio: 10,
      },
      current_stock: 45.0,
      allocated_to_wip: 10.0,
      issued_to_vendors: 8.0, // Stock with vendor (OUR ASSET)
      available_free_stock: 27.0,
      hsn_code: "4407",
      tax_rate: 18.0,
      reorder_level: 15.0,
      current_cost_per_stock_uom: 2400.0,
      cost_basis: "GST_INCLUSIVE",
      timber_attrs: {
        species: "Sal",
        grade: "Grade A",
        moisture_pct: 11.2,
        seasoning_date: "2026-08-10",
        kiln_batch_no: "KILN-SAL-88",
      },
      created_at: "2026-08-10T10:00:00Z",
    },
    {
      id: 2,
      sku: "RM-TIM-002",
      name: "Burma Segun (Teak) Timber Block (সেগুন কাঠ)",
      category: "TIMBER",
      uom: {
        purchase_uom: "CFT",
        stock_uom: "CFT",
        consumption_uom: "Running Feet",
        conversion_ratio: 12,
      },
      current_stock: 28.0,
      allocated_to_wip: 5.0,
      issued_to_vendors: 4.0,
      available_free_stock: 19.0,
      hsn_code: "4407",
      tax_rate: 18.0,
      reorder_level: 10.0,
      current_cost_per_stock_uom: 4800.0,
      cost_basis: "GST_INCLUSIVE",
      timber_attrs: {
        species: "Segun (Teak)",
        grade: "Grade A",
        moisture_pct: 10.5,
        seasoning_date: "2026-07-15",
        kiln_batch_no: "TEAK-02",
      },
      created_at: "2026-07-15T10:00:00Z",
    },
    {
      id: 3,
      sku: "RM-PLY-001",
      name: "BWP Marine 19mm Plywood (710 Grade, 8x4 Sheet)",
      category: "SHEET_GOODS",
      uom: {
        purchase_uom: "Sheet",
        stock_uom: "Sheet",
        consumption_uom: "Sq. Ft.",
        conversion_ratio: 32,
      },
      current_stock: 35.0,
      allocated_to_wip: 12.0,
      issued_to_vendors: 0.0,
      available_free_stock: 23.0,
      hsn_code: "4412",
      tax_rate: 18.0,
      reorder_level: 10.0,
      current_cost_per_stock_uom: 2750.0,
      cost_basis: "GST_INCLUSIVE",
      sheet_attrs: {
        board_type: "Plywood",
        thickness_mm: 19,
        grade: "BWP (Marine)",
        sheet_size: "8x4",
      },
      created_at: "2026-08-01T10:00:00Z",
    },
    {
      id: 4,
      sku: "RM-FOAM-001",
      name: "Sleepwell 40 Density PU Foam Sheet (4-inch)",
      category: "FOAM",
      uom: {
        purchase_uom: "Sheet",
        stock_uom: "Sheet",
        consumption_uom: "Pieces",
        conversion_ratio: 6,
      },
      current_stock: 20.0,
      allocated_to_wip: 8.0,
      issued_to_vendors: 0.0,
      available_free_stock: 12.0,
      hsn_code: "3921",
      tax_rate: 18.0,
      reorder_level: 8.0,
      current_cost_per_stock_uom: 3100.0,
      cost_basis: "GST_INCLUSIVE",
      foam_attrs: {
        density_kg_m3: 40,
        thickness_mm: 100,
        ild_rating: "Medium Firm",
      },
      created_at: "2026-08-05T10:00:00Z",
    },
    {
      id: 5,
      sku: "RM-FAB-001",
      name: "Royal Navy Velvet Upholstery Fabric (Lot #B-88)",
      category: "FABRIC_LEATHER",
      uom: {
        purchase_uom: "Roll",
        stock_uom: "Roll",
        consumption_uom: "Metres",
        conversion_ratio: 50,
      },
      current_stock: 3.5,
      allocated_to_wip: 1.2,
      issued_to_vendors: 0.8,
      available_free_stock: 1.5,
      hsn_code: "5407",
      tax_rate: 12.0,
      reorder_level: 2.0,
      current_cost_per_stock_uom: 14500.0,
      cost_basis: "GST_INCLUSIVE",
      fabric_attrs: {
        width_inches: 54,
        gsm: 380,
        shade: "Royal Navy",
        dye_lot: "LOT-NAVY-88",
      },
      created_at: "2026-08-20T10:00:00Z",
    },
  ],
  batches: [
    {
      id: 1,
      material_id: 1,
      material_name: "Seasoned Sal Wood Planks (১০ ফুট সাইজ)",
      batch_number: "BATCH-SAL-01",
      dye_lot: undefined,
      quantity_remaining: 45.0,
      uom: "CFT",
      unit_cost: 2400.0,
      cost_basis: "GST_INCLUSIVE",
      supplier_name: "Kolkata Timber Mart, Nimtala",
      supplier_invoice_ref: "KTM-892",
      purchase_date: "2026-08-12",
      embedded_tax_amount: 16474.0,
    },
    {
      id: 2,
      material_id: 2,
      material_name: "Burma Segun (Teak) Timber Block (সেগুন কাঠ)",
      batch_number: "BATCH-TEAK-02",
      dye_lot: undefined,
      quantity_remaining: 28.0,
      uom: "CFT",
      unit_cost: 4800.0,
      cost_basis: "GST_INCLUSIVE",
      supplier_name: "Assam Forest Syndicate",
      supplier_invoice_ref: "AFS-441",
      purchase_date: "2026-07-20",
      embedded_tax_amount: 20512.0,
    },
    {
      id: 3,
      material_id: 5,
      material_name: "Royal Navy Velvet Upholstery Fabric (Lot #B-88)",
      batch_number: "BATCH-FAB-88A",
      dye_lot: "LOT-NAVY-88",
      quantity_remaining: 1.8,
      uom: "Roll",
      unit_cost: 14500.0,
      cost_basis: "GST_INCLUSIVE",
      supplier_name: "Surat Velvet Mills",
      supplier_invoice_ref: "SVM-9901",
      purchase_date: "2026-08-25",
      embedded_tax_amount: 3107.0,
    },
    {
      id: 4,
      material_id: 5,
      material_name: "Royal Navy Velvet Upholstery Fabric (Lot #B-88)",
      batch_number: "BATCH-FAB-88B",
      dye_lot: "LOT-NAVY-92", // Different dye lot!
      quantity_remaining: 1.7,
      uom: "Roll",
      unit_cost: 14500.0,
      cost_basis: "GST_INCLUSIVE",
      supplier_name: "Surat Velvet Mills",
      supplier_invoice_ref: "SVM-1044",
      purchase_date: "2026-09-02",
      embedded_tax_amount: 2935.0,
    },
  ],
  offcuts: [
    {
      id: 1,
      material_id: 1,
      material_name: "Sal Wood Offcut Plank",
      material_type: "WOOD_OFFCUT",
      dimensions: "4.5 ft x 6 inch x 2 inch",
      quantity: 12,
      approx_value: 2400.0,
      location: "Offcut Rack A-1",
      logged_date: "2026-09-01",
    },
    {
      id: 2,
      material_id: 3,
      material_name: "Marine Ply Remnant Piece",
      material_type: "PLY_REMNANT",
      dimensions: "36 inch x 24 inch",
      quantity: 8,
      approx_value: 1600.0,
      location: "Sheet Rack Scrap Box",
      logged_date: "2026-09-03",
    },
  ],
  workOrders: [
    {
      id: 1,
      wo_number: "WO-2026-001",
      product_id: 1,
      product_name: "3-Seater Chesterfield Sofa - Royal Navy Velvet",
      sales_order_id: null,
      quantity: 5,
      target_completion_date: "2026-09-20",
      status: "IN_PRODUCTION",
      current_stage: "UPHOLSTERY",
      bom_id: 1,
      created_at: "2026-09-01T10:00:00Z",
      actual_material_cost: 82500.0,
      actual_labour_cost: 18000.0,
    },
    {
      id: 2,
      wo_number: "WO-2026-002",
      product_id: 4,
      product_name: "Solid Segun Wood 6-Seater Dining Set with Chairs",
      sales_order_id: null,
      quantity: 3,
      target_completion_date: "2026-09-25",
      status: "IN_PRODUCTION",
      current_stage: "FRAME_ASSEMBLY",
      bom_id: 2,
      created_at: "2026-09-05T10:00:00Z",
      actual_material_cost: 58000.0,
      actual_labour_cost: 9500.0,
    },
  ],
  stageLogs: [
    {
      id: 1,
      work_order_id: 1,
      stage: "CUTTING",
      date: "2026-09-02",
      shift: "Morning",
      karigar_id: 1,
      karigar_name: "Nirod Sutradhar (নিরোদ মিস্ত্রি)",
      units_attempted: 5,
      units_passed: 5,
      units_rework: 0,
      units_rejected: 0,
      piece_rate_earned: 4500.0,
      logged_at: "2026-09-02T16:00:00Z",
    },
    {
      id: 2,
      work_order_id: 1,
      stage: "FRAME_ASSEMBLY",
      date: "2026-09-04",
      shift: "Morning",
      karigar_id: 1,
      karigar_name: "Nirod Sutradhar (নিরোদ মিস্ত্রি)",
      units_attempted: 5,
      units_passed: 5,
      units_rework: 0,
      units_rejected: 0,
      piece_rate_earned: 7500.0,
      logged_at: "2026-09-04T17:00:00Z",
    },
  ],
  karigars: [
    {
      id: 1,
      name: "Nirod Sutradhar (নিরোদ মিস্ত্রি)",
      specialty: "CARPENTRY",
      mobile_number: "9836001122",
      default_piece_rate: 1500.0,
      active_wip_units: 5,
    },
    {
      id: 2,
      name: "Babulal Das (বাবুলাল)",
      specialty: "UPHOLSTERY",
      mobile_number: "9836112233",
      default_piece_rate: 1200.0,
      active_wip_units: 4,
    },
    {
      id: 3,
      name: "Gouranga Paul (গৌরাঙ্গ)",
      specialty: "POLISH",
      mobile_number: "9836223344",
      default_piece_rate: 1100.0,
      active_wip_units: 2,
    },
  ],
  vendors: [
    {
      id: 1,
      trade_name: "Maa Tara Polishing Workshop (মা তারা পলিশ)",
      contact_person: "Bikash Mondal",
      phone: "9830112233",
      address: "Champadali More, Barasat",
      capabilities: ["POLISHING"],
      agreed_wastage_pct: 2.5,
      quality_rating: 4.8,
      is_gst_registered: false,
    },
    {
      id: 2,
      trade_name: "Master Art Upholstery Works",
      contact_person: "Rahim Ali",
      phone: "9831998877",
      address: "Madhyamgram Chowmatha",
      capabilities: ["UPHOLSTERY"],
      agreed_wastage_pct: 3.0,
      quality_rating: 4.6,
      is_gst_registered: true,
      vendor_gstin: "19AABCM1122D1Z8",
    },
    {
      id: 3,
      trade_name: "Swapan CNC & Woodcarving Studio",
      contact_person: "Swapan Paul",
      phone: "9433445566",
      address: "Duttapukur Station Road",
      capabilities: ["CNC_CUTTING"],
      agreed_wastage_pct: 1.5,
      quality_rating: 4.9,
      is_gst_registered: false,
    },
  ],
  jobWorkOrders: [
    {
      id: 1,
      jwo_number: "JWO-2026-001",
      vendor_id: 1,
      vendor_name: "Maa Tara Polishing Workshop (মা তারা পলিশ)",
      operation_type: "POLISHING",
      target_item_description: "Dining Table & 6 Chair Frames - Walnut Melamine Polish",
      quantity_expected: 3,
      rate_per_unit: 3500.0,
      materials_issued: [
        {
          material_id: 1,
          material_name: "Seasoned Sal Wood Planks",
          quantity_issued: 8.0,
          uom: "CFT",
          unit_value: 2400.0,
          total_value: 19200.0,
        },
      ],
      challan_number: "IDC-2026-001",
      challan_date: "2026-09-06",
      regime_at_creation: "UNREGISTERED",
      due_date: "2026-09-18",
      statutory_return_deadline: "2027-09-06",
      status: "CHALLAN_ISSUED",
      quantity_received: 0,
    },
  ],
  finishedGoods: [
    {
      id: 1,
      sku: "FG-SOFA-001",
      name: "3-Seater Chesterfield Sofa - Royal Navy Velvet",
      category: "Sofa",
      carton_count: 1,
      current_quantity: 6,
      current_cost_per_unit: 26500.0,
      total_value: 159000.0,
      selling_price: 42000.0,
      last_restocked_at: "2026-09-01",
      hsn_code: "9401",
      tax_rate: 18.0,
      floor_model_count: 1,
      dimensions: {
        assembled_length_cm: 220,
        assembled_width_cm: 95,
        assembled_height_cm: 85,
        boxed_cubic_volume_cft: 48,
        total_weight_kg: 68,
        min_door_clearance_inches: 32,
      },
    },
    {
      id: 2,
      sku: "FG-SOFA-002",
      name: "L-Shape Modular Sectional Sofa (4-Carton Boxed)",
      category: "Sofa",
      carton_count: 4,
      current_quantity: 4,
      current_cost_per_unit: 38000.0,
      total_value: 152000.0,
      selling_price: 58500.0,
      last_restocked_at: "2026-09-05",
      hsn_code: "9401",
      tax_rate: 18.0,
      floor_model_count: 1,
      dimensions: {
        assembled_length_cm: 280,
        assembled_width_cm: 180,
        assembled_height_cm: 88,
        boxed_cubic_volume_cft: 92,
        total_weight_kg: 115,
        min_door_clearance_inches: 34,
      },
    },
    {
      id: 3,
      sku: "FG-REC-001",
      name: "Dark Cognac Leatherette Manual Recliner",
      category: "Recliner",
      carton_count: 1,
      current_quantity: 8,
      current_cost_per_unit: 19500.0,
      total_value: 156000.0,
      selling_price: 31000.0,
      last_restocked_at: "2026-09-08",
      hsn_code: "9401",
      tax_rate: 18.0,
      floor_model_count: 2,
      dimensions: {
        assembled_length_cm: 98,
        assembled_width_cm: 92,
        assembled_height_cm: 104,
        boxed_cubic_volume_cft: 28,
        total_weight_kg: 44,
        min_door_clearance_inches: 30,
      },
    },
    {
      id: 4,
      sku: "FG-DIN-001",
      name: "Solid Segun Wood 6-Seater Dining Set with Chairs",
      category: "Dining Set",
      carton_count: 3,
      current_quantity: 3,
      current_cost_per_unit: 32000.0,
      total_value: 96000.0,
      selling_price: 49000.0,
      last_restocked_at: "2026-08-28",
      hsn_code: "9403",
      tax_rate: 18.0,
      floor_model_count: 1,
      dimensions: {
        assembled_length_cm: 180,
        assembled_width_cm: 90,
        assembled_height_cm: 76,
        boxed_cubic_volume_cft: 42,
        total_weight_kg: 85,
        min_door_clearance_inches: 30,
      },
    },
    {
      id: 5,
      sku: "FG-BED-001",
      name: "King Size Hydraulic Storage Bed - Charcoal Grey",
      category: "Bed",
      carton_count: 3,
      current_quantity: 2,
      current_cost_per_unit: 24000.0,
      total_value: 48000.0,
      selling_price: 36500.0,
      last_restocked_at: "2026-09-03",
      hsn_code: "9403",
      tax_rate: 18.0,
      floor_model_count: 0,
      dimensions: {
        assembled_length_cm: 210,
        assembled_width_cm: 195,
        assembled_height_cm: 110,
        boxed_cubic_volume_cft: 52,
        total_weight_kg: 98,
        min_door_clearance_inches: 32,
      },
    },
  ],
  unitSerials: [
    {
      serial_no: "SN-SOFA-001-01",
      product_id: 1,
      product_name: "3-Seater Chesterfield Sofa - Royal Navy Velvet",
      condition_grade: "FLOOR_MODEL",
      is_floor_sample: true,
      floor_placement_date: "2026-08-15",
      days_on_floor: 28,
      is_markdown_eligible: false,
      missing_carton_flag: false,
      status: "AVAILABLE",
      location: "SHOWROOM_FLOOR",
      created_at: "2026-08-15T10:00:00Z",
    },
    {
      serial_no: "SN-SOFA-002-01",
      product_id: 2,
      product_name: "L-Shape Modular Sectional Sofa (4-Carton Boxed)",
      condition_grade: "NEW_IN_BOX",
      is_floor_sample: false,
      missing_carton_flag: false,
      status: "AVAILABLE",
      location: "BARASAT_GODOWN",
      created_at: "2026-09-05T10:00:00Z",
    },
  ],
  salesOrders: [
    {
      id: 1,
      document_number: "CM-2026-0001",
      document_type: "CASH_MEMO",
      regime_at_creation: "UNREGISTERED", // Stamped immutably
      order_date: "2026-09-02",
      customer_name: "Subir Mukherjee",
      customer_phone: "9830554433",
      delivery_pincode: "700124", // Barasat
      delivery_zone: "Barasat Town & Champadali (Local)",
      floor_level: 1,
      has_lift: true,
      floor_surcharge: 0,
      payment_mode: "CASH",
      subtotal: 42000.0,
      grand_total: 42000.0,
      amount_paid: 42000.0,
      khata_balance_due: 0,
      status: "DELIVERED",
      is_composite_priced: true,
      is_marketplace_order: false,
      created_at: "2026-09-02T11:30:00Z",
      lines: [
        {
          id: 1,
          product_id: 1,
          product_name: "3-Seater Chesterfield Sofa - Royal Navy Velvet",
          quantity: 1,
          unit_price: 42000.0,
          line_total: 42000.0,
        },
      ],
    },
    {
      id: 2,
      document_number: "CM-2026-0002",
      document_type: "CASH_MEMO",
      regime_at_creation: "UNREGISTERED",
      order_date: "2026-09-08",
      customer_name: "Animesh Ganguly",
      customer_phone: "9831223344",
      delivery_pincode: "700129", // Madhyamgram
      delivery_zone: "Madhyamgram & Sodepur Road",
      floor_level: 3,
      has_lift: false, // 3rd floor without lift
      floor_surcharge: 500.0,
      payment_mode: "KHATA_CREDIT",
      subtotal: 58500.0,
      grand_total: 59000.0, // Includes 500 floor surcharge
      amount_paid: 30000.0, // Advance
      khata_balance_due: 29000.0, // Balance
      status: "CONFIRMED",
      is_composite_priced: true,
      is_marketplace_order: false,
      created_at: "2026-09-08T15:00:00Z",
      lines: [
        {
          id: 2,
          product_id: 2,
          product_name: "L-Shape Modular Sectional Sofa",
          quantity: 1,
          unit_price: 58500.0,
          line_total: 58500.0,
        },
      ],
    },
  ],
  khataAccounts: [
    {
      id: 1,
      customer_name: "Animesh Ganguly",
      customer_phone: "9831223344",
      customer_address: "Kalisondha Road, Madhyamgram, North 24 Parganas",
      total_credit_granted: 59000.0,
      total_paid: 30000.0,
      current_balance: 29000.0,
      last_payment_date: "2026-09-08",
      status: "ACTIVE",
    },
  ],
  khataTransactions: [
    {
      id: 1,
      khata_id: 1,
      date: "2026-09-08",
      type: "DEBIT_PURCHASE",
      amount: 59000.0,
      balance_after: 59000.0,
      reference_invoice: "CM-2026-0002",
      notes: "L-Shape sofa purchase with floor surcharge",
    },
    {
      id: 2,
      khata_id: 1,
      date: "2026-09-08",
      type: "CREDIT_PAYMENT",
      amount: 30000.0,
      balance_after: 29000.0,
      reference_invoice: "CM-2026-0002",
      payment_mode: "UPI",
      notes: "Advance payment received via Google Pay",
    },
  ],
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
      note: "Pre-Puja consignment",
      created_at: "2026-09-01T10:00:00Z",
    },
  ],
  nextId: {
    rawMaterials: 6,
    batches: 5,
    offcuts: 3,
    workOrders: 3,
    stageLogs: 3,
    jobWorkOrders: 2,
    finishedGoods: 6,
    salesOrders: 3,
    khataAccounts: 2,
    khataTransactions: 3,
    items: 8,
    history: 2,
  },
};

// -----------------------------------------------------------------------------
// Auto-Initialization / Schema Verification
// -----------------------------------------------------------------------------
export async function ensureTablesExist(): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
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
    const countRes = (await sql`SELECT COUNT(*)::int as count FROM items`) as any[];
    if (countRes && countRes[0] && Number(countRes[0].count) === 0) {
      await sql`
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
      `;
      await sql`
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
      `;
    }
  } catch (err) {
    console.error("Database initialization check warning:", err);
  }
}

// -----------------------------------------------------------------------------
// Data Access Methods: 4 Stock States
// -----------------------------------------------------------------------------
export async function getFourStockStatesSummary(): Promise<FourStockStatesReconciliation> {
  const rawMaterialVal = memoryStore.rawMaterials.reduce(
    (sum, rm) => sum + rm.current_stock * rm.current_cost_per_stock_uom,
    0
  );

  const inHouseWipVal = memoryStore.workOrders
    .filter((wo) => wo.status !== "COMPLETED")
    .reduce((sum, wo) => sum + wo.actual_material_cost + wo.actual_labour_cost, 0);

  // CRITICAL: Stock with vendor is OUR ASSET!
  const stockWithVendorVal = memoryStore.rawMaterials.reduce(
    (sum, rm) => sum + rm.issued_to_vendors * rm.current_cost_per_stock_uom,
    0
  );

  const finishedGoodsVal = memoryStore.finishedGoods.reduce(
    (sum, fg) => sum + fg.current_quantity * fg.current_cost_per_unit,
    0
  );

  return {
    raw_material_store_value: Math.round(rawMaterialVal),
    raw_material_items_count: memoryStore.rawMaterials.length,
    in_house_wip_value: Math.round(inHouseWipVal),
    in_house_wip_units_count: memoryStore.workOrders.filter((wo) => wo.status !== "COMPLETED")
      .length,
    stock_with_vendor_value: Math.round(stockWithVendorVal),
    stock_with_vendor_items_count: memoryStore.jobWorkOrders.filter(
      (jwo) => jwo.status !== "RECONCILED"
    ).length,
    finished_goods_value: Math.round(finishedGoodsVal),
    finished_goods_units_count: memoryStore.finishedGoods.reduce(
      (sum, fg) => sum + fg.current_quantity,
      0
    ),
    total_enterprise_inventory_valuation: Math.round(
      rawMaterialVal + inHouseWipVal + stockWithVendorVal + finishedGoodsVal
    ),
  };
}

// -----------------------------------------------------------------------------
// Data Access: Raw Materials & Multi-UOM
// -----------------------------------------------------------------------------
export async function getAllRawMaterials(): Promise<RawMaterialItem[]> {
  return [...memoryStore.rawMaterials];
}

export async function getRawMaterialBatches(materialId: number): Promise<MaterialBatch[]> {
  return memoryStore.batches.filter((b) => b.material_id === materialId);
}

export async function getAllMaterialBatches(): Promise<MaterialBatch[]> {
  return [...memoryStore.batches];
}

export async function getAllOffcutScraps(): Promise<OffcutScrapItem[]> {
  return [...memoryStore.offcuts];
}

export async function addOffcutScrap(input: {
  material_id: number;
  material_name: string;
  material_type: "WOOD_OFFCUT" | "PLY_REMNANT" | "FABRIC_SCRAP" | "FOAM_OFFCUT";
  dimensions: string;
  quantity: number;
  approx_value: number;
  location: string;
}): Promise<OffcutScrapItem> {
  const newItem: OffcutScrapItem = {
    id: memoryStore.nextId.offcuts++,
    ...input,
    logged_date: new Date().toISOString().slice(0, 10),
  };
  memoryStore.offcuts.unshift(newItem);
  return newItem;
}

// -----------------------------------------------------------------------------
// Data Access: In-House Production & Daily Stage Logs
// -----------------------------------------------------------------------------
export async function getWorkOrders(): Promise<WorkOrder[]> {
  return [...memoryStore.workOrders];
}

export async function getKarigars(): Promise<KarigarMaster[]> {
  return [...memoryStore.karigars];
}

export async function getStageProductionLogs(
  workOrderId?: number
): Promise<StageProductionLog[]> {
  if (workOrderId) {
    return memoryStore.stageLogs.filter((log) => log.work_order_id === workOrderId);
  }
  return [...memoryStore.stageLogs].reverse();
}

export async function logStageProductionEntry(input: {
  work_order_id: number;
  stage: StageProductionLog["stage"];
  karigar_id: number;
  units_attempted: number;
  units_passed: number;
  units_rework: number;
  units_rejected: number;
  rework_reason?: string;
  rejection_reason?: string;
}): Promise<StageProductionLog> {
  const karigar = memoryStore.karigars.find((k) => k.id === input.karigar_id);
  const rate = karigar ? karigar.default_piece_rate : 1200;
  const pieceRateEarned = input.units_passed * rate;

  const newLog: StageProductionLog = {
    id: memoryStore.nextId.stageLogs++,
    work_order_id: input.work_order_id,
    stage: input.stage,
    date: new Date().toISOString().slice(0, 10),
    shift: "Morning",
    karigar_id: input.karigar_id,
    karigar_name: karigar ? karigar.name : "Local Karigar",
    units_attempted: input.units_attempted,
    units_passed: input.units_passed,
    units_rework: input.units_rework,
    units_rejected: input.units_rejected,
    rework_reason: input.rework_reason,
    rejection_reason: input.rejection_reason,
    piece_rate_earned: pieceRateEarned,
    logged_at: new Date().toISOString(),
  };

  memoryStore.stageLogs.push(newLog);

  // Update work order stage & labour cost
  const wo = memoryStore.workOrders.find((w) => w.id === input.work_order_id);
  if (wo) {
    wo.current_stage = input.stage;
    wo.actual_labour_cost += pieceRateEarned;
  }

  return newLog;
}

// -----------------------------------------------------------------------------
// Data Access: Job Work & Stock-With-Vendor (Our Asset!)
// -----------------------------------------------------------------------------
export async function getJobWorkVendors(): Promise<JobWorkVendor[]> {
  return [...memoryStore.vendors];
}

export async function getJobWorkOrders(): Promise<JobWorkOrder[]> {
  return [...memoryStore.jobWorkOrders];
}

export async function createJobWorkDispatch(input: {
  vendor_id: number;
  operation_type: "POLISHING" | "UPHOLSTERY" | "CNC_CUTTING" | "FRAME_WORK";
  target_item_description: string;
  quantity_expected: number;
  rate_per_unit: number;
  material_id: number;
  quantity_to_issue: number;
  due_date: string;
}): Promise<JobWorkOrder> {
  const vendor = memoryStore.vendors.find((v) => v.id === input.vendor_id);
  const material = memoryStore.rawMaterials.find((m) => m.id === input.material_id);
  if (!vendor || !material) throw new Error("Vendor or Material not found");

  // Transfer stock from Raw Material Store to Stock with Vendor
  material.current_stock -= input.quantity_to_issue;
  material.issued_to_vendors += input.quantity_to_issue;

  const id = memoryStore.nextId.jobWorkOrders++;
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const config = getActiveTaxConfig();
  const challanNumber = config.tax_regime_enabled
    ? `CH-R45-${String(id).padStart(4, "0")}`
    : `IDC-2026-${String(id).padStart(4, "0")}`;

  const newJwo: JobWorkOrder = {
    id,
    jwo_number: `JWO-2026-${String(id).padStart(4, "0")}`,
    vendor_id: input.vendor_id,
    vendor_name: vendor.trade_name,
    operation_type: input.operation_type,
    target_item_description: input.target_item_description,
    quantity_expected: input.quantity_expected,
    rate_per_unit: input.rate_per_unit,
    materials_issued: [
      {
        material_id: material.id,
        material_name: material.name,
        quantity_issued: input.quantity_to_issue,
        uom: material.uom.stock_uom,
        unit_value: material.current_cost_per_stock_uom,
        total_value: input.quantity_to_issue * material.current_cost_per_stock_uom,
      },
    ],
    challan_number: challanNumber,
    challan_date: today,
    regime_at_creation: config.tax_regime_enabled ? "REGISTERED" : "UNREGISTERED",
    due_date: input.due_date,
    statutory_return_deadline: nextYear, // 1-year Rule 45 requirement
    status: "CHALLAN_ISSUED",
    quantity_received: 0,
  };

  memoryStore.jobWorkOrders.unshift(newJwo);
  return newJwo;
}

export async function reconcileJobWorkReturn(
  jwoId: number,
  quantityReceived: number,
  scrapNotes?: string
): Promise<JobWorkOrder> {
  const jwo = memoryStore.jobWorkOrders.find((j) => j.id === jwoId);
  if (!jwo) throw new Error("Job work order not found");

  jwo.quantity_received += quantityReceived;
  if (scrapNotes) jwo.scrap_returned_description = scrapNotes;

  if (jwo.quantity_received >= jwo.quantity_expected) {
    jwo.status = "RECONCILED";
  } else {
    jwo.status = "PARTIAL_RETURN";
  }

  // Release stock from "Stock with Vendor"
  for (const mat of jwo.materials_issued) {
    const rawMat = memoryStore.rawMaterials.find((m) => m.id === mat.material_id);
    if (rawMat) {
      rawMat.issued_to_vendors = Math.max(0, rawMat.issued_to_vendors - mat.quantity_issued);
    }
  }

  return jwo;
}

// -----------------------------------------------------------------------------
// Data Access: Finished Goods & Serials
// -----------------------------------------------------------------------------
export async function getAllFinishedGoods(
  search?: string,
  category?: string
): Promise<FinishedGoodItem[]> {
  let list = [...memoryStore.finishedGoods];
  if (category && category !== "All") {
    list = list.filter((item) => item.category.toLowerCase() === category.toLowerCase());
  }
  if (search && search.trim() !== "") {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getFinishedGoodById(id: number): Promise<FinishedGoodItem | null> {
  const item = memoryStore.finishedGoods.find((fg) => fg.id === id);
  return item ? { ...item } : null;
}

export async function restockFinishedGood(
  id: number,
  input: { quantity_added: number; cost_per_unit: number; restock_date: string; note?: string }
): Promise<FinishedGoodItem> {
  const item = memoryStore.finishedGoods.find((fg) => fg.id === id);
  if (!item) throw new Error("Finished good not found");

  item.current_quantity += input.quantity_added;
  item.current_cost_per_unit = input.cost_per_unit;
  item.total_value = item.current_quantity * input.cost_per_unit;
  item.last_restocked_at = input.restock_date;

  return { ...item };
}

// -----------------------------------------------------------------------------
// Data Access: Retail Sales, Billing & Khata Ledger
// -----------------------------------------------------------------------------
export async function getAllSalesOrders(): Promise<SalesOrder[]> {
  return [...memoryStore.salesOrders];
}

export async function createSalesOrder(input: {
  customer_name: string;
  customer_phone: string;
  delivery_pincode: string;
  delivery_zone: string;
  floor_level: number;
  has_lift: boolean;
  payment_mode: "CASH" | "UPI" | "KHATA_CREDIT" | "SPLIT";
  amount_paid: number;
  lines: { product_id: number; quantity: number; unit_price: number }[];
  is_marketplace_order?: boolean;
}): Promise<SalesOrder> {
  const id = memoryStore.nextId.salesOrders++;
  const config = getActiveTaxConfig();

  // Evaluate delivery & floor surcharge
  const zoneInfo = calculateDeliveryAndFloorSurcharge({
    zoneId: input.delivery_zone,
    floorLevel: input.floor_level,
    hasLift: input.has_lift,
  });

  const rawSubtotal = input.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const totalAmount = rawSubtotal + zoneInfo.floorSurcharge;

  // Determine state code based on pincode
  const destState =
    input.delivery_pincode.startsWith("70") ||
    input.delivery_pincode.startsWith("71") ||
    input.delivery_pincode.startsWith("72") ||
    input.delivery_pincode.startsWith("73") ||
    input.delivery_pincode.startsWith("74")
      ? "19"
      : "XX"; // Outside West Bengal

  // Apply SalesDocumentPolicy based on CURRENT tax regime state
  const pricing = SalesDocumentPolicy.evaluate(totalAmount, destState);

  const documentNumber = `${pricing.numbering_prefix}${String(id).padStart(4, "0")}`;
  const khataBalance = Math.max(0, totalAmount - input.amount_paid);

  const salesLines = input.lines.map((l, idx) => {
    const prod = memoryStore.finishedGoods.find((f) => f.id === l.product_id);
    const lineTotal = l.quantity * l.unit_price;
    return {
      id: idx + 1,
      product_id: l.product_id,
      product_name: prod ? prod.name : "Furniture Item",
      quantity: l.quantity,
      unit_price: l.unit_price,
      taxable_value: pricing.taxable_value,
      cgst_amount: pricing.cgst_amount,
      sgst_amount: pricing.sgst_amount,
      igst_amount: pricing.igst_amount,
      tax_rate: 18,
      hsn_code: prod ? prod.hsn_code : "9401",
      line_total: lineTotal,
    };
  });

  const newOrder: SalesOrder = {
    id,
    document_number: documentNumber,
    document_type: pricing.document_type,
    regime_at_creation: pricing.regime_state, // IMMUTABLE
    order_date: new Date().toISOString().slice(0, 10),
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    delivery_pincode: input.delivery_pincode,
    delivery_zone: zoneInfo.zone.name,
    floor_level: input.floor_level,
    has_lift: input.has_lift,
    floor_surcharge: zoneInfo.floorSurcharge,
    payment_mode: input.payment_mode,
    subtotal: rawSubtotal,
    taxable_total: pricing.taxable_value,
    cgst_total: pricing.cgst_amount,
    sgst_total: pricing.sgst_amount,
    igst_total: pricing.igst_amount,
    grand_total: totalAmount,
    amount_paid: input.amount_paid,
    khata_balance_due: khataBalance,
    status: "CONFIRMED",
    lines: salesLines,
    is_composite_priced: true,
    is_marketplace_order: Boolean(input.is_marketplace_order),
    created_at: new Date().toISOString(),
  };

  memoryStore.salesOrders.unshift(newOrder);

  // Deduct finished goods stock
  for (const line of input.lines) {
    const prod = memoryStore.finishedGoods.find((f) => f.id === line.product_id);
    if (prod) {
      prod.current_quantity = Math.max(0, prod.current_quantity - line.quantity);
      prod.total_value = prod.current_quantity * prod.current_cost_per_unit;
    }
  }

  // Update or create Khata account if balance remains
  if (khataBalance > 0) {
    let khata = memoryStore.khataAccounts.find((k) => k.customer_phone === input.customer_phone);
    if (!khata) {
      khata = {
        id: memoryStore.nextId.khataAccounts++,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_address: `${zoneInfo.zone.name}, Pin: ${input.delivery_pincode}`,
        total_credit_granted: totalAmount,
        total_paid: input.amount_paid,
        current_balance: khataBalance,
        last_payment_date: new Date().toISOString().slice(0, 10),
        status: "ACTIVE",
      };
      memoryStore.khataAccounts.push(khata);
    } else {
      khata.total_credit_granted += totalAmount;
      khata.total_paid += input.amount_paid;
      khata.current_balance += khataBalance;
      khata.last_payment_date = new Date().toISOString().slice(0, 10);
    }

    memoryStore.khataTransactions.push({
      id: memoryStore.nextId.khataTransactions++,
      khata_id: khata.id,
      date: new Date().toISOString().slice(0, 10),
      type: "DEBIT_PURCHASE",
      amount: totalAmount,
      balance_after: khata.current_balance,
      reference_invoice: documentNumber,
      notes: "Furniture purchase debit",
    });

    if (input.amount_paid > 0) {
      memoryStore.khataTransactions.push({
        id: memoryStore.nextId.khataTransactions++,
        khata_id: khata.id,
        date: new Date().toISOString().slice(0, 10),
        type: "CREDIT_PAYMENT",
        amount: input.amount_paid,
        balance_after: khata.current_balance,
        reference_invoice: documentNumber,
        payment_mode: input.payment_mode === "UPI" ? "UPI" : "CASH",
        notes: "Initial advance received",
      });
    }
  }

  return newOrder;
}

export async function getKhataAccounts(): Promise<KhataAccount[]> {
  return [...memoryStore.khataAccounts];
}

export async function recordKhataPayment(
  khataId: number,
  amount: number,
  paymentMode: "CASH" | "UPI" = "CASH",
  notes?: string
): Promise<KhataAccount> {
  const khata = memoryStore.khataAccounts.find((k) => k.id === khataId);
  if (!khata) throw new Error("Khata account not found");

  const actualPayment = Math.min(khata.current_balance, amount);
  khata.total_paid += actualPayment;
  khata.current_balance -= actualPayment;
  khata.last_payment_date = new Date().toISOString().slice(0, 10);
  if (khata.current_balance === 0) khata.status = "SETTLED";

  memoryStore.khataTransactions.push({
    id: memoryStore.nextId.khataTransactions++,
    khata_id: khata.id,
    date: new Date().toISOString().slice(0, 10),
    type: "CREDIT_PAYMENT",
    amount: actualPayment,
    balance_after: khata.current_balance,
    reference_invoice: "KHT-PAY",
    payment_mode: paymentMode,
    notes: notes || "Installment payment received",
  });

  return khata;
}

// -----------------------------------------------------------------------------
// Data Access: Tax Strategy & Transitional Credit
// -----------------------------------------------------------------------------
export async function getTaxConfig(): Promise<TaxConfig> {
  return getActiveTaxConfig();
}

export async function updateTaxConfig(updates: Partial<TaxConfig>): Promise<TaxConfig> {
  return updateActiveTaxConfig(updates);
}

export async function getTransitionalCreditReport(): Promise<TransitionalCreditReport> {
  return TransitionalCreditService.generateReport(memoryStore.batches);
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Showroom Furniture Items & Append-Only Restock History Data Access
// -----------------------------------------------------------------------------
export async function getAllItems(search?: string, category?: string): Promise<InventoryItem[]> {
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
      ORDER BY id ASC
    `) as any[];

    let items: InventoryItem[] = rows.map((r) => ({
      ...r,
      current_quantity: Number(r.current_quantity),
      current_cost_per_unit: Number(r.current_cost_per_unit),
      total_value: Number(r.total_value),
    }));

    if (category && category !== "All") {
      items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim() !== "") {
      const q = search.toLowerCase().trim();
      items = items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
      );
    }
    return items;
  }

  let items = [...memoryStore.items];
  if (category && category !== "All") {
    items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  }
  if (search && search.trim() !== "") {
    const q = search.toLowerCase().trim();
    items = items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }
  return items;
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
    `) as any[];

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
    `) as any[];

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
  const initialQty = Math.max(0, Number(input.initial_quantity) || 0);
  const initialCost = Math.max(0, Number(input.initial_cost_per_unit) || 0);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const sql = getSql();

  if (sql) {
    await ensureTablesExist();
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
    `) as any[];

    const newItem = inserted[0];
    if (initialQty > 0) {
      const note = input.initial_note?.trim() || "Initial stock entry";
      await sql`
        INSERT INTO restock_history (item_id, quantity_added, cost_per_unit, restock_date, note)
        VALUES (${newItem.id}, ${initialQty}, ${initialCost}, ${today}, ${note})
      `;
    }

    // Also mirror to memoryStore
    const itemRecord: InventoryItem = {
      id: Number(newItem.id),
      name: newItem.name,
      category: newItem.category,
      current_quantity: Number(newItem.current_quantity),
      current_cost_per_unit: Number(newItem.current_cost_per_unit),
      total_value: Number(newItem.total_value),
      last_restocked_at: today,
      created_at: now,
      updated_at: now,
    };
    memoryStore.items.unshift(itemRecord);
    return itemRecord;
  }

  const newId = memoryStore.nextId.items++;
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
      id: memoryStore.nextId.history++,
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
  const addedQty = Math.max(1, Number(input.quantity_added) || 1);
  const newCost = Math.max(0, Number(input.cost_per_unit) || 0);
  const restockDate = input.restock_date || new Date().toISOString().slice(0, 10);
  const note = input.note?.trim() || null;
  const sql = getSql();

  if (sql) {
    await ensureTablesExist();
    await sql`
      INSERT INTO restock_history (item_id, quantity_added, cost_per_unit, restock_date, note)
      VALUES (${itemId}, ${addedQty}, ${newCost}, ${restockDate}, ${note})
    `;

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
    `) as any[];

    if (!updated || updated.length === 0) {
      throw new Error(`Item with id ${itemId} not found`);
    }

    const r = updated[0];
    const res: InventoryItem = {
      ...r,
      current_quantity: Number(r.current_quantity),
      current_cost_per_unit: Number(r.current_cost_per_unit),
      total_value: Number(r.total_value),
    };

    // Mirror to memory
    const memIdx = memoryStore.items.findIndex((i) => i.id === itemId);
    if (memIdx !== -1) {
      memoryStore.items[memIdx] = res;
    }
    return res;
  }

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
    id: memoryStore.nextId.history++,
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
    `) as any[];

    if (!updated || updated.length === 0) {
      throw new Error(`Item with id ${itemId} not found`);
    }
    const r = updated[0];
    const res: InventoryItem = {
      ...r,
      current_quantity: Number(r.current_quantity),
      current_cost_per_unit: Number(r.current_cost_per_unit),
      total_value: Number(r.total_value),
    };
    const memIdx = memoryStore.items.findIndex((i) => i.id === itemId);
    if (memIdx !== -1) {
      memoryStore.items[memIdx] = res;
    }
    return res;
  }

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
    memoryStore.items = memoryStore.items.filter((i) => i.id !== itemId);
    memoryStore.history = memoryStore.history.filter((h) => h.item_id !== itemId);
    return true;
  }

  memoryStore.items = memoryStore.items.filter((i) => i.id !== itemId);
  memoryStore.history = memoryStore.history.filter((h) => h.item_id !== itemId);
  return true;
}

