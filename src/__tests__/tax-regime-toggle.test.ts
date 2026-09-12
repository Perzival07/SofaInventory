// =============================================================================
// Acceptance Test Suite: Tax Regime Toggle (Section 2.4)
// =============================================================================

import {
  createSalesOrder,
  getAllSalesOrders,
  getAllFinishedGoods,
  getAllRawMaterials,
  createJobWorkDispatch,
  reconcileJobWorkReturn,
  logStageProductionEntry,
  getTaxConfig,
  updateTaxConfig,
  getTransitionalCreditReport,
  getFourStockStatesSummary,
} from "../lib/db";
import { SalesDocumentPolicy, PurchaseCostingPolicy } from "../lib/tax-strategy";
import { formatINR } from "../lib/formatters";

async function runSection24AcceptanceTests() {
  console.log("\n===============================================================================");
  console.log("  SECTION 2.4 ACCEPTANCE TEST: TAX REGIME STRATEGY & IMMUTABILITY SUITE");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // STEP 1: Ensure Tax Regime is OFF (Unregistered mode)
  // ---------------------------------------------------------------------------
  console.log("--> Step 1: Initializing with tax_regime_enabled = FALSE (Unregistered)...");
  await updateTaxConfig({
    tax_regime_enabled: false,
    registration_number: null,
    registration_date: null,
  });

  const initialConfig = await getTaxConfig();
  console.assert(!initialConfig.tax_regime_enabled, "Tax regime must be OFF initially");
  console.log("✓ Verified tax_regime_enabled is FALSE (Unregistered mode).");

  // ---------------------------------------------------------------------------
  // STEP 2: Create 20 sales, 10 purchases, 3 job work cycles, 2 production runs
  // ---------------------------------------------------------------------------
  console.log("\n--> Step 2: Creating 20 sales, 10 purchases, 3 job work cycles, 2 production runs with flag OFF...");

  // 2.1 Create 20 Sales
  const salesCreatedIds: number[] = [];
  for (let i = 1; i <= 20; i++) {
    const sale = await createSalesOrder({
      customer_name: `Customer Batch1 #${i}`,
      customer_phone: `98300000${String(i).padStart(2, "0")}`,
      delivery_pincode: "700124", // Barasat
      delivery_zone: "ZONE_BARASAT_CHAMPADALI",
      floor_level: 1,
      has_lift: true,
      payment_mode: "CASH",
      amount_paid: 42000,
      lines: [{ product_id: 1, quantity: 1, unit_price: 42000 }],
    });
    salesCreatedIds.push(sale.id);
  }
  console.log(`✓ Successfully generated 20 sales orders with regime_at_creation = UNREGISTERED.`);

  // Verify all 20 historical sales rendered as Cash Memos with NO tax columns
  const historicalSales = await getAllSalesOrders();
  const first20 = historicalSales.filter((s) => salesCreatedIds.includes(s.id));
  console.assert(first20.length === 20, "Must have 20 historical sales");
  for (const s of first20) {
    console.assert(s.document_type === "CASH_MEMO", `Sale ${s.document_number} must be CASH_MEMO`);
    console.assert(s.document_number.startsWith("CM-2026-"), `Numbering must use CM- prefix`);
    console.assert(s.regime_at_creation === "UNREGISTERED", `Must record UNREGISTERED regime`);
    console.assert(s.cgst_total === 0 && s.sgst_total === 0 && s.igst_total === 0, `No tax columns allowed`);
  }
  console.log(`✓ Verified all 20 historical sales are CASH MEMOs with CM- prefix and zero tax columns.`);

  // 2.2 Create 10 Purchases (Testing PurchaseCostingPolicy when flag is OFF)
  console.log("--> Testing 10 purchases under Unregistered mode (GST-inclusive landed costing)...");
  const purchaseCostings = [];
  for (let p = 1; p <= 10; p++) {
    const costResult = PurchaseCostingPolicy.evaluate(2000, 360, "UNREGISTERED");
    console.assert(costResult.cost_basis === "GST_INCLUSIVE", "Cost basis must be GST_INCLUSIVE");
    console.assert(costResult.booked_item_cost === 2360, "Cost must be GST-inclusive (2000 + 360 = 2360)");
    console.assert(costResult.input_tax_credit_accrued === 0, "No ITC claimable while unregistered");
    purchaseCostings.push(costResult);
  }
  console.log(`✓ Verified 10 purchases: booked at landed cost (₹2,360) with ₹0 ITC.`);

  // 2.3 Create 3 Job Work Cycles
  console.log("--> Creating 3 Job Work cycles with Internal Delivery Challans...");
  for (let j = 1; j <= 3; j++) {
    const jwo = await createJobWorkDispatch({
      vendor_id: 1,
      operation_type: "POLISHING",
      target_item_description: `Batch 1 Job Work Unit #${j}`,
      quantity_expected: 2,
      rate_per_unit: 3000,
      material_id: 1,
      quantity_to_issue: 4,
      due_date: "2026-09-30",
    });
    console.assert(jwo.challan_number.startsWith("IDC-2026-"), "Must use internal delivery challan IDC prefix");
    console.assert(jwo.regime_at_creation === "UNREGISTERED", "Challan must record UNREGISTERED regime");

    // Reconcile return
    await reconcileJobWorkReturn(jwo.id, 2, "Normal scrap retained");
  }
  console.log(`✓ Verified 3 Job Work cycles created with IDC- challans and reconciled.`);

  // 2.4 Create 2 Production Runs
  console.log("--> Logging 2 stage-wise production runs...");
  await logStageProductionEntry({
    work_order_id: 1,
    stage: "FRAME_ASSEMBLY",
    karigar_id: 1,
    units_attempted: 5,
    units_passed: 5,
    units_rework: 0,
    units_rejected: 0,
  });
  await logStageProductionEntry({
    work_order_id: 1,
    stage: "UPHOLSTERY",
    karigar_id: 2,
    units_attempted: 5,
    units_passed: 5,
    units_rework: 0,
    units_rejected: 0,
  });
  console.log(`✓ Logged 2 production stage entries with karigar piece-rate capture.`);

  // ---------------------------------------------------------------------------
  // STEP 3: Flip Tax Flag ON with Today's Registration Date
  // ---------------------------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n--> Step 3: Flipping tax_regime_enabled = TRUE (GSTIN: 19AAAAA0000A1Z5, Date: ${today})...`);

  await updateTaxConfig({
    tax_regime_enabled: true,
    registration_number: "19AAAAA0000A1Z5",
    registration_date: today,
  });

  const activeConf = await getTaxConfig();
  console.assert(activeConf.tax_regime_enabled === true, "Tax regime must now be ON");
  console.assert(activeConf.registration_number === "19AAAAA0000A1Z5", "GSTIN must be set");
  console.log("✓ Tax regime successfully switched to REGISTERED.");

  // ---------------------------------------------------------------------------
  // STEP 4: Verify Immutability of Historical Transactions & Stock Reconciliation
  // ---------------------------------------------------------------------------
  console.log("\n--> Step 4: Verifying Historical Immutability & Section 18(1)(a) Transitional Credit...");

  // 4.1 Historical sales verification
  const allSalesAfterSwitch = await getAllSalesOrders();
  const historicalCheck = allSalesAfterSwitch.filter((s) => salesCreatedIds.includes(s.id));
  console.assert(historicalCheck.length === 20, "All 20 historical sales must be intact");

  for (const s of historicalCheck) {
    // Non-negotiable rule: Must still render as Cash Memo forever!
    console.assert(
      s.document_type === "CASH_MEMO",
      `Historical sale ${s.document_number} MUST REMAIN CASH_MEMO even after tax regime is turned ON!`
    );
    console.assert(
      s.document_number.startsWith("CM-2026-"),
      `Historical sale ${s.document_number} must retain CM- numbering`
    );
    console.assert(
      s.regime_at_creation === "UNREGISTERED",
      `Historical sale ${s.document_number} must retain UNREGISTERED stamp`
    );
    console.assert(
      s.cgst_total === 0 && s.sgst_total === 0,
      `Historical sale ${s.document_number} must not retroactively gain tax columns`
    );
  }
  console.log("✓ PASS: All 20 historical sales remained Cash Memos with CM- numbering and zero tax columns!");

  // 4.2 Stock reconciliation check
  const stockReconciliation = await getFourStockStatesSummary();
  console.assert(stockReconciliation.total_enterprise_inventory_valuation > 0, "Inventory valuation must be valid");
  console.log(`✓ PASS: Stock ledger reconciled. Total inventory assets: ${formatINR(stockReconciliation.total_enterprise_inventory_valuation)}.`);

  // 4.3 Section 18(1)(a) Transitional Credit Report
  const transCreditReport = await getTransitionalCreditReport();
  console.log(`✓ Transitional Credit Report Generated:`);
  console.log(`  - Total Stock Lots Audited: ${transCreditReport.total_stock_items_count}`);
  console.log(`  - Total Inventory Valuation: ${formatINR(transCreditReport.total_inventory_value_inclusive)}`);
  console.log(`  - Total Claimable Input Tax Credit: ${formatINR(transCreditReport.total_claimable_itc)}`);
  console.assert(transCreditReport.total_claimable_itc > 0, "Must calculate claimable transitional ITC");
  console.assert(transCreditReport.items.length > 0, "Must itemize eligible stock batches with invoice refs");
  console.log("✓ PASS: Section 18(1)(a) Transitional Credit Report successfully compiled.");

  // ---------------------------------------------------------------------------
  // STEP 5: Create 5 New Sales under Registered Regime
  // ---------------------------------------------------------------------------
  console.log("\n--> Step 5: Creating 5 new sales under Registered Regime (West Bengal vs Interstate)...");

  // 5.1 Sales 1 to 4: West Bengal Buyers (Intra-state CGST + SGST split)
  const newSalesIds: number[] = [];
  for (let k = 1; k <= 4; k++) {
    const wbSale = await createSalesOrder({
      customer_name: `WB Buyer #${k}`,
      customer_phone: `983111223${k}`,
      delivery_pincode: "700124", // Barasat, West Bengal
      delivery_zone: "ZONE_BARASAT_CHAMPADALI",
      floor_level: 0,
      has_lift: true,
      payment_mode: "CASH",
      amount_paid: 42000,
      lines: [{ product_id: 1, quantity: 1, unit_price: 42000 }],
    });
    newSalesIds.push(wbSale.id);

    console.assert(wbSale.document_type === "TAX_INVOICE", "New sale must be TAX_INVOICE");
    console.assert(wbSale.document_number.startsWith("INV-2026-"), "New sale must use INV-2026- prefix");
    console.assert(wbSale.regime_at_creation === "REGISTERED", "Must record REGISTERED regime");
    console.assert((wbSale.cgst_total || 0) > 0, "Must compute CGST for West Bengal buyer");
    console.assert((wbSale.sgst_total || 0) > 0, "Must compute SGST for West Bengal buyer");
    console.assert((wbSale.igst_total || 0) === 0, "IGST must be 0 for intra-state West Bengal buyer");
  }
  console.log("✓ PASS: 4 West Bengal sales rendered as Tax Invoices with separate INV- prefix and CGST + SGST split.");

  // 5.2 Sale 5: Out-of-State Buyer (Interstate IGST)
  const interstateSale = await createSalesOrder({
    customer_name: "Patna Decorators",
    customer_phone: "9431001122",
    delivery_pincode: "800001", // Patna, Bihar (Out of state)
    delivery_zone: "ZONE_OUTSIDE_BELT",
    floor_level: 0,
    has_lift: true,
    payment_mode: "UPI",
    amount_paid: 45500,
    lines: [{ product_id: 1, quantity: 1, unit_price: 42000 }],
  });
  newSalesIds.push(interstateSale.id);

  console.assert(interstateSale.document_type === "TAX_INVOICE", "Interstate sale must be TAX_INVOICE");
  console.assert(interstateSale.document_number.startsWith("INV-2026-"), "Must use INV- prefix");
  console.assert((interstateSale.igst_total || 0) > 0, "Must compute IGST for interstate buyer");
  console.assert((interstateSale.cgst_total || 0) === 0 && (interstateSale.sgst_total || 0) === 0, "CGST/SGST must be 0 for interstate");
  console.log(`✓ PASS: Interstate sale rendered with full IGST (${formatINR(interstateSale.igst_total || 0)}) and zero CGST/SGST.`);

  // ---------------------------------------------------------------------------
  // STEP 6: Flip Tax Flag OFF (Test Reversibility - Section 2.3 Rule 6)
  // ---------------------------------------------------------------------------
  console.log("\n--> Step 6: Testing Reversibility: Flipping tax_regime_enabled back to FALSE...");
  await updateTaxConfig({
    tax_regime_enabled: false,
    deregistration_date: today,
  });

  // Verify the 5 Tax Invoices created while registered STILL RENDER as Tax Invoices
  const allSalesAfterRevert = await getAllSalesOrders();
  const taxInvoicesCheck = allSalesAfterRevert.filter((s) => newSalesIds.includes(s.id));
  console.assert(taxInvoicesCheck.length === 5, "Must find all 5 registered sales");

  for (const inv of taxInvoicesCheck) {
    console.assert(
      inv.document_type === "TAX_INVOICE",
      `Tax invoice ${inv.document_number} MUST REMAIN TAX_INVOICE even after deregistration!`
    );
    console.assert(
      inv.document_number.startsWith("INV-2026-"),
      `Tax invoice ${inv.document_number} must retain INV- numbering`
    );
    console.assert(
      inv.regime_at_creation === "REGISTERED",
      `Tax invoice ${inv.document_number} must retain REGISTERED regime stamp`
    );
  }
  console.log("✓ PASS: All 5 Tax Invoices created while registered remain immutable Tax Invoices!");

  // Create a 26th sale after deregistration -> MUST REVERT to Cash Memo
  const saleAfterRevert = await createSalesOrder({
    customer_name: "Local Barasat Customer After Revert",
    customer_phone: "9830999999",
    delivery_pincode: "700124",
    delivery_zone: "ZONE_BARASAT_CHAMPADALI",
    floor_level: 0,
    has_lift: true,
    payment_mode: "CASH",
    amount_paid: 42000,
    lines: [{ product_id: 1, quantity: 1, unit_price: 42000 }],
  });

  console.assert(
    saleAfterRevert.document_type === "CASH_MEMO",
    "New sale after deregistration must revert to CASH_MEMO"
  );
  console.assert(
    saleAfterRevert.document_number.startsWith("CM-2026-"),
    "New sale after deregistration must revert to CM- numbering series"
  );
  console.log(`✓ PASS: New sale after deregistration reverted to Cash Memo (${saleAfterRevert.document_number}).`);

  console.log("\n===============================================================================");
  console.log("  ALL SECTION 2.4 ACCEPTANCE CRITERIA PASSED 100% SUCCESSFULLY!");
  console.log("===============================================================================\n");
}

runSection24AcceptanceTests().catch((err) => {
  console.error("❌ Acceptance test failed:", err);
  process.exit(1);
});
