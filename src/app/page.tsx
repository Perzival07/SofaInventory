"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/Header";
import { MonsoonModeBanner } from "@/components/MonsoonModeBanner";
import { TurnoverWatchdogCard } from "@/components/TurnoverWatchdogCard";
import { FourStockStatesOverview } from "@/components/FourStockStatesOverview";
import { RawMaterialStoreView } from "@/components/RawMaterialStoreView";
import { ProductionStageTracker } from "@/components/ProductionStageTracker";
import { JobWorkVendorManager } from "@/components/JobWorkVendorManager";
import { RetailSalesAndKhata } from "@/components/RetailSalesAndKhata";
import { TaxRegimeSettingsModal } from "@/components/TaxRegimeSettingsModal";

// Furniture Inventory Components & Modals
import { StatsOverview } from "@/components/StatsOverview";
import { FilterBar } from "@/components/FilterBar";
import { InventoryTable } from "@/components/InventoryTable";
import { InventoryCardList } from "@/components/InventoryCardList";
import { AddItemModal } from "@/components/AddItemModal";
import { RestockModal } from "@/components/RestockModal";
import { HistoryModal } from "@/components/HistoryModal";
import { EditItemModal } from "@/components/EditItemModal";
import { DeleteItemModal } from "@/components/DeleteItemModal";

import {
  RawMaterialItem,
  WorkOrder,
  JobWorkOrder,
  JobWorkVendor,
  FinishedGoodItem,
  SalesOrder,
  KhataAccount,
  DeliveryZone,
  TaxConfig,
  FourStockStatesReconciliation,
  TurnoverWatchdogStatus,
  MonsoonModeConfig,
  LanguageCode,
  InventoryItem,
  InventorySummary,
  AddItemInput,
  RestockInput,
  EditItemInput,
} from "@/lib/types";

import {
  fetchEnterpriseOverviewAction,
  fetchRawMaterialsAction,
  fetchProductionWipAction,
  fetchJobWorkAction,
  fetchRetailAndKhataAction,
  fetchInventoryAction,
  addItemAction,
  restockItemAction,
  editItemAction,
  deleteItemAction,
} from "@/app/actions";

import {
  Package,
  ShoppingCart,
  Factory,
  UserCheck,
  Trees,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Layers,
} from "lucide-react";
import { t } from "@/lib/i18n";

export default function EnterpriseDashboard() {
  const [lang, setLang] = useState<LanguageCode>("en");
  // Default to the core Furniture Inventory tab
  const [activeTab, setActiveTab] = useState<
    "inventory" | "retail" | "production" | "job_work" | "raw_material"
  >("inventory");
  const [isLoading, setIsLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // 1. Furniture Showroom Inventory State
  // ---------------------------------------------------------------------------
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("recently_updated");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modals for Furniture Inventory
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [restockItemTarget, setRestockItemTarget] = useState<InventoryItem | null>(null);
  const [historyItemTarget, setHistoryItemTarget] = useState<InventoryItem | null>(null);
  const [editItemTarget, setEditItemTarget] = useState<InventoryItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<InventoryItem | null>(null);

  // ---------------------------------------------------------------------------
  // 2. Enterprise ERP States
  // ---------------------------------------------------------------------------
  const [fourStates, setFourStates] = useState<FourStockStatesReconciliation>({
    raw_material_store_value: 0,
    raw_material_items_count: 0,
    in_house_wip_value: 0,
    in_house_wip_units_count: 0,
    stock_with_vendor_value: 0,
    stock_with_vendor_items_count: 0,
    finished_goods_value: 0,
    finished_goods_units_count: 0,
    total_enterprise_inventory_valuation: 0,
  });

  const [turnoverStatus, setTurnoverStatus] = useState<TurnoverWatchdogStatus>({
    fy_label: "FY 2026-27",
    shop_turnover: 0,
    other_pan_businesses_turnover: 0,
    aggregate_pan_turnover: 0,
    threshold_limit: 4000000,
    amber_alert_level: 3000000,
    red_alert_level: 3500000,
    blocking_alert_level: 3800000,
    status: "SAFE",
    projected_yearend_turnover: 0,
    festival_season_uplift_pct: 45,
    registration_triggers: {
      interstate_supply_attempted: false,
      ecommerce_order_detected: false,
      unbundled_services_billed: false,
    },
  });

  const [taxConfig, setTaxConfig] = useState<TaxConfig>({
    tax_regime_enabled: false,
    registration_number: null,
    registration_date: null,
    deregistration_date: null,
    state_code: "19",
    state_name: "West Bengal",
    composition_scheme: false,
    filing_frequency: "monthly",
    legal_name: "The Sofa Studio & Furniture Co.",
    trade_name: "The Sofa Studio",
    principal_place_of_business: "Barasat, North 24 Parganas, West Bengal - 700124",
  });

  const [monsoonConfig, setMonsoonConfig] = useState<MonsoonModeConfig>({
    is_active: false,
    humidity_pct: 65,
    timber_moisture_max_threshold: 12.0,
    polish_curing_extra_hours: 0,
    adhesive_curing_extra_hours: 0,
  });

  const [dbStatus, setDbStatus] = useState<{ connected: boolean; provider: string }>({
    connected: false,
    provider: "In-Memory Demo Store",
  });

  // Module Specific Datasets
  const [rawMaterials, setRawMaterials] = useState<RawMaterialItem[]>([]);
  const [offcuts, setOffcuts] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [karigars, setKarigars] = useState<any[]>([]);
  const [stageLogs, setStageLogs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<JobWorkVendor[]>([]);
  const [jobWorkOrders, setJobWorkOrders] = useState<JobWorkOrder[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGoodItem[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [khataAccounts, setKhataAccounts] = useState<KhataAccount[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  // Other Modals
  const [isTaxSettingsOpen, setIsTaxSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ---------------------------------------------------------------------------
  // Load All Data
  // ---------------------------------------------------------------------------
  const loadAllData = useCallback(async () => {
    try {
      const [overview, rmData, prodData, jwData, retailData, invData] = await Promise.all([
        fetchEnterpriseOverviewAction(),
        fetchRawMaterialsAction(),
        fetchProductionWipAction(),
        fetchJobWorkAction(),
        fetchRetailAndKhataAction(),
        fetchInventoryAction(),
      ]);

      setFourStates(overview.fourStates);
      setTurnoverStatus(overview.turnoverStatus);
      setTaxConfig(overview.taxConfig);
      setMonsoonConfig(overview.monsoonConfig);
      setDbStatus({
        connected: overview.isDbConfigured,
        provider: overview.isDbConfigured
          ? "Vercel Postgres (Neon)"
          : "In-Memory Local Demo Store",
      });

      setRawMaterials(rmData.materials);
      setOffcuts(rmData.offcuts);
      setWorkOrders(prodData.workOrders);
      setKarigars(prodData.karigars);
      setStageLogs(prodData.stageLogs);
      setVendors(jwData.vendors);
      setJobWorkOrders(jwData.jobWorkOrders);
      setFinishedGoods(retailData.finishedGoods);
      setSalesOrders(retailData.salesOrders);
      setKhataAccounts(retailData.khataAccounts);
      setDeliveryZones(retailData.deliveryZones);

      setInventoryItems(invData.items);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      showToast("Error synchronizing inventory state", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ---------------------------------------------------------------------------
  // Filtered & Sorted Furniture Inventory
  // ---------------------------------------------------------------------------
  const filteredInventory = useMemo(() => {
    let result = [...inventoryItems];

    if (selectedCategory && selectedCategory !== "All") {
      result = result.filter(
        (item) => item.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "qty_desc":
        result.sort((a, b) => b.current_quantity - a.current_quantity);
        break;
      case "qty_asc":
        result.sort((a, b) => a.current_quantity - b.current_quantity);
        break;
      case "val_desc":
        result.sort((a, b) => b.total_value - a.total_value);
        break;
      case "val_asc":
        result.sort((a, b) => a.total_value - b.total_value);
        break;
      case "name_asc":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "recently_updated":
      default:
        result.sort(
          (a, b) =>
            new Date(b.last_restocked_at).getTime() -
            new Date(a.last_restocked_at).getTime()
        );
        break;
    }

    return result;
  }, [inventoryItems, search, selectedCategory, sortBy]);

  // Derived KPI Metrics Summary for Furniture Stock
  const inventorySummary: InventorySummary = useMemo(() => {
    const totalItems = inventoryItems.length;
    const totalStockUnits = inventoryItems.reduce(
      (sum, item) => sum + item.current_quantity,
      0
    );
    const totalInventoryValue = inventoryItems.reduce(
      (sum, item) => sum + item.total_value,
      0
    );
    const lowStockCount = inventoryItems.filter(
      (item) => item.current_quantity > 0 && item.current_quantity <= 3
    ).length;
    const outOfStockCount = inventoryItems.filter(
      (item) => item.current_quantity === 0
    ).length;
    const categories = Array.from(
      new Set(inventoryItems.map((item) => item.category))
    ).filter(Boolean);

    return {
      totalItems,
      totalStockUnits,
      totalInventoryValue,
      lowStockCount,
      outOfStockCount,
      categories,
    };
  }, [inventoryItems]);

  return (
    <main className="app-container">
      {/* 1. Top Header with Barasat Branding, Tax Status, DB indicator & + Add Furniture CTA */}
      <Header
        onAddItemClick={() => setIsAddOpen(true)}
        onOpenTaxSettings={() => setIsTaxSettingsOpen(true)}
        dbStatus={dbStatus}
        taxConfig={taxConfig}
        lang={lang}
        onLangChange={setLang}
      />

      {/* 2. Monsoon Mode Warning Banner (Kolkata humidity controls) */}
      <MonsoonModeBanner
        config={monsoonConfig}
        lang={lang}
        onUpdated={loadAllData}
      />

      {/* 3. Turnover Watchdog & Registration Trigger Alert (Section 3) */}
      <TurnoverWatchdogCard
        status={turnoverStatus}
        lang={lang}
        onTurnoverUpdated={loadAllData}
        onOpenTaxSettings={() => setIsTaxSettingsOpen(true)}
        taxEnabled={taxConfig.tax_regime_enabled}
      />

      {/* 4. Four Stock States Reconciliation Visualizer (Section 1) */}
      <FourStockStatesOverview
        reconciliation={fourStates}
        lang={lang}
        onSelectTab={(tabId) => {
          if (tabId === "retail") setActiveTab("retail");
          else if (tabId === "production") setActiveTab("production");
          else if (tabId === "job_work") setActiveTab("job_work");
          else if (tabId === "raw_material") setActiveTab("raw_material");
        }}
      />

      {/* 5. Enterprise Main Navigation Tabs */}
      <nav className="enterprise-nav-tabs" role="tablist" aria-label="Main ERP Modules">
        {/* Core Tab 1: Furniture Inventory (DEFAULT) */}
        <button
          className={`nav-tab-btn ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
          role="tab"
          aria-selected={activeTab === "inventory"}
          id="tab-btn-inventory"
        >
          <Package size={18} />
          <span>{t("tab_inventory", lang)}</span>
          <span className="tab-pill-count">{inventoryItems.length}</span>
        </button>

        {/* Tab 2: Retail Sales & Khata */}
        <button
          className={`nav-tab-btn ${activeTab === "retail" ? "active" : ""}`}
          onClick={() => setActiveTab("retail")}
          role="tab"
          aria-selected={activeTab === "retail"}
        >
          <ShoppingCart size={18} />
          <span>{t("tab_retail", lang)}</span>
        </button>

        {/* Tab 3: In-House Production WIP */}
        <button
          className={`nav-tab-btn ${activeTab === "production" ? "active" : ""}`}
          onClick={() => setActiveTab("production")}
          role="tab"
          aria-selected={activeTab === "production"}
        >
          <Factory size={18} />
          <span>{t("tab_production", lang)}</span>
        </button>

        {/* Tab 4: Job Work Vendors */}
        <button
          className={`nav-tab-btn ${activeTab === "job_work" ? "active" : ""}`}
          onClick={() => setActiveTab("job_work")}
          role="tab"
          aria-selected={activeTab === "job_work"}
        >
          <UserCheck size={18} />
          <span>{t("tab_job_work", lang)}</span>
        </button>

        {/* Tab 5: Raw Material Store */}
        <button
          className={`nav-tab-btn ${activeTab === "raw_material" ? "active" : ""}`}
          onClick={() => setActiveTab("raw_material")}
          role="tab"
          aria-selected={activeTab === "raw_material"}
        >
          <Trees size={18} />
          <span>{t("tab_raw_material", lang)}</span>
        </button>
      </nav>

      {/* 6. Active Module Content */}
      {isLoading ? (
        <div className="main-loading-state">
          <Loader2 size={36} className="main-spinner" />
          <p>Loading furniture stock & inventory states...</p>
        </div>
      ) : activeTab === "inventory" ? (
        /* =================================================================== */
        /* TAB 1: FURNITURE INVENTORY & AUDIT LOG (THE CORE MANAGEMENT SYSTEM) */
        /* =================================================================== */
        <div className="inventory-view-root">
          {/* Action Header Banner */}
          <div className="inventory-section-header">
            <div>
              <h2 className="section-heading">Showroom & Warehouse Furniture Inventory</h2>
              <p className="section-subheading">
                Record new furniture pieces, renew batch stock prices, and audit restock history in real time.
              </p>
            </div>
            <button
              onClick={() => setIsAddOpen(true)}
              className="btn btn-primary btn-add-inventory-cta"
              id="btn-add-furniture-main"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>+ Add New Furniture</span>
            </button>
          </div>

          {/* Top KPI Metrics Overview */}
          <StatsOverview summary={inventorySummary} />

          {/* Search, Category Filters, Sort, and Table/Card Toggle */}
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            availableCategories={inventorySummary.categories}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* Furniture Stock List: Table or Card View */}
          {viewMode === "table" ? (
            <InventoryTable
              items={filteredInventory}
              onRestockClick={(item) => setRestockItemTarget(item)}
              onHistoryClick={(item) => setHistoryItemTarget(item)}
              onEditClick={(item) => setEditItemTarget(item)}
              onDeleteClick={(item) => setDeleteItemTarget(item)}
            />
          ) : (
            <InventoryCardList
              items={filteredInventory}
              onRestockClick={(item) => setRestockItemTarget(item)}
              onHistoryClick={(item) => setHistoryItemTarget(item)}
              onEditClick={(item) => setEditItemTarget(item)}
              onDeleteClick={(item) => setDeleteItemTarget(item)}
            />
          )}
        </div>
      ) : activeTab === "retail" ? (
        /* TAB 2: RETAIL BILLING & KHATA */
        <RetailSalesAndKhata
          finishedGoods={finishedGoods}
          salesOrders={salesOrders}
          khataAccounts={khataAccounts}
          deliveryZones={deliveryZones}
          lang={lang}
          onRefresh={loadAllData}
          taxEnabled={taxConfig.tax_regime_enabled}
        />
      ) : activeTab === "production" ? (
        /* TAB 3: IN-HOUSE FACTORY WIP */
        <ProductionStageTracker
          workOrders={workOrders}
          karigars={karigars}
          stageLogs={stageLogs}
          lang={lang}
          onRefresh={loadAllData}
        />
      ) : activeTab === "job_work" ? (
        /* TAB 4: JOB WORK VENDORS */
        <JobWorkVendorManager
          vendors={vendors}
          jobWorkOrders={jobWorkOrders}
          lang={lang}
          onRefresh={loadAllData}
          taxEnabled={taxConfig.tax_regime_enabled}
        />
      ) : (
        /* TAB 5: RAW MATERIAL STORE */
        <RawMaterialStoreView
          materials={rawMaterials}
          offcuts={offcuts}
          lang={lang}
          onRefresh={loadAllData}
          monsoonActive={monsoonConfig.is_active}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Modals for Furniture Inventory (Add, Restock, History, Edit, Delete)*/}
      {/* ------------------------------------------------------------------- */}
      <AddItemModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={async (input: AddItemInput) => {
          const res = await addItemAction(input);
          if (!res.success) throw new Error(res.error || "Failed to add item");
          showToast(`Added "${input.name}" to inventory!`);
          await loadAllData();
        }}
      />

      <RestockModal
        item={restockItemTarget}
        isOpen={Boolean(restockItemTarget)}
        onClose={() => setRestockItemTarget(null)}
        onSubmit={async (itemId: number, input: RestockInput) => {
          const res = await restockItemAction(itemId, input);
          if (!res.success) throw new Error(res.error || "Failed to restock item");
          showToast(`Restocked +${input.quantity_added} units successfully!`);
          await loadAllData();
        }}
      />

      <HistoryModal
        item={historyItemTarget}
        isOpen={Boolean(historyItemTarget)}
        onClose={() => setHistoryItemTarget(null)}
      />

      <EditItemModal
        item={editItemTarget}
        isOpen={Boolean(editItemTarget)}
        onClose={() => setEditItemTarget(null)}
        onSubmit={async (itemId: number, input: EditItemInput) => {
          const res = await editItemAction(itemId, input);
          if (!res.success) throw new Error(res.error || "Failed to edit item");
          showToast(`Updated "${input.name}"`);
          await loadAllData();
        }}
      />

      <DeleteItemModal
        item={deleteItemTarget}
        isOpen={Boolean(deleteItemTarget)}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={async (itemId: number) => {
          const res = await deleteItemAction(itemId);
          if (!res.success) throw new Error(res.error || "Failed to delete item");
          showToast("Item deleted from inventory");
          await loadAllData();
        }}
      />

      {/* Tax Strategy Architecture Controls Modal */}
      <TaxRegimeSettingsModal
        isOpen={isTaxSettingsOpen}
        onClose={() => setIsTaxSettingsOpen(false)}
        config={taxConfig}
        lang={lang}
        onConfigUpdated={loadAllData}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`toast-pill ${
            toast.type === "error" ? "toast-error" : "toast-success"
          }`}
          role="status"
        >
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        .enterprise-nav-tabs {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 0.75rem;
          margin-bottom: 1.5rem;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .enterprise-nav-tabs::-webkit-scrollbar {
          display: none;
        }

        .nav-tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-family: var(--font-heading);
          font-size: 0.925rem;
          font-weight: 600;
          padding: 0.65rem 1.25rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--transition-fast);
        }

        .nav-tab-btn:hover {
          border-color: var(--border-focus);
          color: var(--text-primary);
          background: var(--bg-card);
        }

        .nav-tab-btn.active {
          background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.15) 0%,
            rgba(217, 119, 6, 0.08) 100%
          );
          border-color: var(--accent-primary);
          color: var(--accent-primary);
          box-shadow: 0 0 16px rgba(245, 158, 11, 0.15);
        }

        .tab-pill-count {
          background: rgba(245, 158, 11, 0.2);
          color: var(--accent-primary);
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .inventory-view-root {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .inventory-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
        }

        .section-heading {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .section-subheading {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .btn-add-inventory-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
          color: #0b0f17;
          border: none;
          padding: 0.75rem 1.35rem;
          border-radius: var(--radius-md);
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
          transition: all var(--transition-fast);
        }

        .btn-add-inventory-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
        }

        .main-loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 5rem 0;
          gap: 1rem;
          color: var(--text-secondary);
        }

        .toast-pill {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1.5rem;
          border-radius: 9999px;
          font-weight: 600;
          font-size: 0.95rem;
          z-index: 1000;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          animation: slideInUp 0.3s ease-out;
        }

        .toast-success {
          background: #064e3b;
          color: #34d399;
          border: 1px solid #059669;
        }

        .toast-error {
          background: #7f1d1d;
          color: #f87171;
          border: 1px solid #dc2626;
        }

        @keyframes slideInUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}
