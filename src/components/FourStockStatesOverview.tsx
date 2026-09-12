"use client";

import React from "react";
import { Trees, Factory, UserCheck, Armchair, ArrowRight, Layers } from "lucide-react";
import { FourStockStatesReconciliation, LanguageCode } from "@/lib/types";
import { formatINR } from "@/lib/formatters";
import { t } from "@/lib/i18n";

interface FourStockStatesOverviewProps {
  reconciliation: FourStockStatesReconciliation;
  lang: LanguageCode;
  onSelectTab: (tabId: "raw_material" | "production" | "job_work" | "retail") => void;
}

export function FourStockStatesOverview({
  reconciliation,
  lang,
  onSelectTab,
}: FourStockStatesOverviewProps) {
  return (
    <div className="four-states-root">
      <div className="four-states-top">
        <div className="title-with-pill">
          <Layers size={20} className="icon-main" />
          <h3 className="section-title">The 4 Enterprise Stock States</h3>
          <span className="badge badge-reconciled">100% Reconciled</span>
        </div>
        <div className="total-enterprise-value">
          <span className="total-label">Total Inventory Assets:</span>
          <span className="total-amount">
            {formatINR(reconciliation.total_enterprise_inventory_valuation)}
          </span>
        </div>
      </div>

      <div className="flow-container">
        {/* State 1: Raw Material Store */}
        <div
          className="state-box box-raw-material"
          onClick={() => onSelectTab("raw_material")}
          role="button"
          tabIndex={0}
        >
          <div className="box-header">
            <Trees size={18} className="box-icon icon-rm" />
            <span className="box-badge">Stage 1</span>
          </div>
          <h4 className="box-title">{t("state_raw_material", lang)}</h4>
          <p className="box-val">{formatINR(reconciliation.raw_material_store_value)}</p>
          <p className="box-sub">{reconciliation.raw_material_items_count} timber, ply & foam items</p>
          <span className="box-link">Manage Store →</span>
        </div>

        <div className="flow-arrow">
          <ArrowRight size={18} />
        </div>

        {/* State 2: In-House Factory WIP */}
        <div
          className="state-box box-in-house-wip"
          onClick={() => onSelectTab("production")}
          role="button"
          tabIndex={0}
        >
          <div className="box-header">
            <Factory size={18} className="box-icon icon-wip" />
            <span className="box-badge">Stage 2A</span>
          </div>
          <h4 className="box-title">{t("state_in_house_wip", lang)}</h4>
          <p className="box-val">{formatINR(reconciliation.in_house_wip_value)}</p>
          <p className="box-sub">{reconciliation.in_house_wip_units_count} units across 9 stages</p>
          <span className="box-link">View Stage Logs →</span>
        </div>

        <div className="flow-split">
          <span className="split-text">OR</span>
        </div>

        {/* State 3: Stock with Vendor (Job Work - OUR ASSET!) */}
        <div
          className="state-box box-stock-vendor"
          onClick={() => onSelectTab("job_work")}
          role="button"
          tabIndex={0}
        >
          <div className="box-header">
            <UserCheck size={18} className="box-icon icon-vendor" />
            <span className="box-badge badge-our-asset">OUR ASSET</span>
          </div>
          <h4 className="box-title">{t("state_stock_with_vendor", lang)}</h4>
          <p className="box-val">{formatINR(reconciliation.stock_with_vendor_value)}</p>
          <p className="box-sub">{reconciliation.stock_with_vendor_items_count} challans with polish/upholstery</p>
          <span className="box-link">Vendor Ledger →</span>
        </div>

        <div className="flow-arrow">
          <ArrowRight size={18} />
        </div>

        {/* State 4: Finished Goods */}
        <div
          className="state-box box-finished-goods"
          onClick={() => onSelectTab("retail")}
          role="button"
          tabIndex={0}
        >
          <div className="box-header">
            <Armchair size={18} className="box-icon icon-fg" />
            <span className="box-badge">Stage 3</span>
          </div>
          <h4 className="box-title">{t("state_finished_goods", lang)}</h4>
          <p className="box-val value-gold">
            {formatINR(reconciliation.finished_goods_value)}
          </p>
          <p className="box-sub">{reconciliation.finished_goods_units_count} ready units in showroom</p>
          <span className="box-link">Retail Billing →</span>
        </div>
      </div>

      <style jsx>{`
        .four-states-root {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.75rem;
        }

        .four-states-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .title-with-pill {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .icon-main {
          color: var(--primary);
        }

        .section-title {
          font-size: 1.15rem;
          margin: 0;
        }

        .badge-reconciled {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
          font-size: 0.725rem;
          text-transform: uppercase;
        }

        .total-enterprise-value {
          display: flex;
          align-items: baseline;
          gap: 0.45rem;
        }

        .total-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .total-amount {
          font-family: var(--font-heading);
          font-size: 1.25rem;
          font-weight: 700;
          color: #fbbf24;
        }

        .flow-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.85rem;
          align-items: center;
        }

        @media (min-width: 900px) {
          .flow-container {
            grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
          }
        }

        .flow-arrow {
          display: none;
          color: var(--text-muted);
          justify-content: center;
        }

        @media (min-width: 900px) {
          .flow-arrow {
            display: flex;
          }
        }

        .flow-split {
          display: none;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 700;
          text-align: center;
        }

        @media (min-width: 900px) {
          .flow-split {
            display: block;
          }
        }

        .state-box {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .state-box:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        .box-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.35rem;
        }

        .box-icon {
          padding: 0;
        }

        .icon-rm {
          color: #10b981;
        }

        .icon-wip {
          color: #38bdf8;
        }

        .icon-vendor {
          color: #a855f7;
        }

        .icon-fg {
          color: #f59e0b;
        }

        .box-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
        }

        .badge-our-asset {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.3);
        }

        .box-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.3;
        }

        .box-val {
          font-family: var(--font-heading);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0.25rem 0 0.1rem 0;
        }

        .value-gold {
          color: #fbbf24;
        }

        .box-sub {
          font-size: 0.725rem;
          color: var(--text-muted);
          line-height: 1.35;
        }

        .box-link {
          font-size: 0.75rem;
          color: var(--primary);
          font-weight: 600;
          margin-top: 0.45rem;
        }
      `}</style>
    </div>
  );
}
