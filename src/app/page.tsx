"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { MonsoonModeBanner } from "@/components/MonsoonModeBanner";
import { TurnoverWatchdogCard } from "@/components/TurnoverWatchdogCard";
import { FourStockStatesOverview } from "@/components/FourStockStatesOverview";
import { RawMaterialStoreView } from "@/components/RawMaterialStoreView";
import { ProductionStageTracker } from "@/components/ProductionStageTracker";
import { JobWorkVendorManager } from "@/components/JobWorkVendorManager";
import { RetailSalesAndKhata } from "@/components/RetailSalesAndKhata";
import { TaxRegimeSettingsModal } from "@/components/TaxRegimeSettingsModal";

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
} from "@/lib/types";

import {
  fetchEnterpriseOverviewAction,
  fetchRawMaterialsAction,
  fetchProductionWipAction,
  fetchJobWorkAction,
  fetchRetailAndKhataAction,
} from "@/app/actions";

import {
  ShoppingCart,
  Factory,
  UserCheck,
  Trees,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { t } from "@/lib/i18n";

export default function EnterpriseDashboard() {
  const [lang, setLang] = useState<LanguageCode>("en");
  const [activeTab, setActiveTab] = useState<"retail" | "production" | "job_work" | "raw_material">("retail");
  const [isLoading, setIsLoading] = useState(true);

  // Enterprise State
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

  // Modals
  const [isTaxSettingsOpen, setIsTaxSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load All Enterprise Data
  const loadAllData = async () => {
    try {
      const [overview, rmData, prodData, jwData, retailData] = await Promise.all([
        fetchEnterpriseOverviewAction(),
        fetchRawMaterialsAction(),
        fetchProductionWipAction(),
        fetchJobWorkAction(),
        fetchRetailAndKhataAction(),
      ]);

      setFourStates(overview.fourStates);
      setTurnoverStatus(overview.turnoverStatus);
      setTaxConfig(overview.taxConfig);
      setMonsoonConfig(overview.monsoonConfig);
      setDbStatus({
        connected: overview.isDbConfigured,
        provider: overview.isDbConfigured
          ? "Vercel Postgres (Neon)"
          : "In-Memory Enterprise Store",
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
    } catch (err) {
      console.error("Failed to load enterprise data:", err);
      showToast("Error loading enterprise dataset", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return (
    <main className="app-container">
      {/* 1. Header with Barasat Branding, Tax Status, Language Switcher */}
      <Header
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
        onSelectTab={setActiveTab}
      />

      {/* 5. Enterprise Main Navigation Tabs */}
      <nav className="enterprise-nav-tabs" role="tablist" aria-label="Main ERP Modules">
        <button
          className={`nav-tab-btn ${activeTab === "retail" ? "active" : ""}`}
          onClick={() => setActiveTab("retail")}
          role="tab"
          aria-selected={activeTab === "retail"}
        >
          <ShoppingCart size={18} />
          <span>{t("tab_retail", lang)}</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === "production" ? "active" : ""}`}
          onClick={() => setActiveTab("production")}
          role="tab"
          aria-selected={activeTab === "production"}
        >
          <Factory size={18} />
          <span>{t("tab_production", lang)}</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === "job_work" ? "active" : ""}`}
          onClick={() => setActiveTab("job_work")}
          role="tab"
          aria-selected={activeTab === "job_work"}
        >
          <UserCheck size={18} />
          <span>{t("tab_job_work", lang)}</span>
        </button>

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
          <p>Loading enterprise inventory states...</p>
        </div>
      ) : activeTab === "retail" ? (
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
        <ProductionStageTracker
          workOrders={workOrders}
          karigars={karigars}
          stageLogs={stageLogs}
          lang={lang}
          onRefresh={loadAllData}
        />
      ) : activeTab === "job_work" ? (
        <JobWorkVendorManager
          vendors={vendors}
          jobWorkOrders={jobWorkOrders}
          lang={lang}
          onRefresh={loadAllData}
          taxEnabled={taxConfig.tax_regime_enabled}
        />
      ) : (
        <RawMaterialStoreView
          materials={rawMaterials}
          offcuts={offcuts}
          lang={lang}
          onRefresh={loadAllData}
          monsoonActive={monsoonConfig.is_active}
        />
      )}

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

      {/* Tax Strategy Architecture Controls Modal */}
      <TaxRegimeSettingsModal
        isOpen={isTaxSettingsOpen}
        onClose={() => setIsTaxSettingsOpen(false)}
        config={taxConfig}
        lang={lang}
        onConfigUpdated={loadAllData}
      />


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
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .nav-tab-btn.active {
          background: var(--primary-gradient);
          color: var(--text-inverse);
          border-color: transparent;
          box-shadow: 0 4px 14px var(--primary-glow);
        }

        .main-loading-state {
          padding: 5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
        }

        .main-spinner {
          animation: spin 1s linear infinite;
          color: var(--primary);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .toast-pill {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 2000;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.85rem 1.25rem;
          border-radius: var(--radius-full);
          font-family: var(--font-heading);
          font-size: 0.9rem;
          font-weight: 600;
          box-shadow: var(--shadow-lg);
          animation: fadeIn 200ms ease-out;
        }

        .toast-success {
          background: #064e3b;
          border: 1px solid #059669;
          color: #a7f3d0;
        }

        .toast-error {
          background: #7f1d1d;
          border: 1px solid #dc2626;
          color: #fecaca;
        }
      `}</style>
    </main>
  );
}
