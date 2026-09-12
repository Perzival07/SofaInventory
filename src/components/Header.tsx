"use client";

import React from "react";
import { Armchair, Plus, Database, Settings, ShieldAlert, ShieldCheck, Menu } from "lucide-react";
import { LanguageCode, TaxConfig } from "@/lib/types";
import { LanguageToggle } from "./LanguageToggle";
import { t } from "@/lib/i18n";

export interface HeaderProps {
  onAddItemClick?: () => void;
  onOpenTaxSettings?: () => void;
  dbStatus?: { connected: boolean; provider: string };
  taxConfig?: TaxConfig;
  lang?: LanguageCode;
  onLangChange?: (lang: LanguageCode) => void;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  onMenuClick?: () => void;
}

export function Header({
  onAddItemClick,
  onOpenTaxSettings,
  dbStatus = { connected: true, provider: "Local / Postgres" },
  taxConfig,
  lang = "en",
  onLangChange,
  title,
  subtitle,
  actionLabel,
  onActionClick,
  onMenuClick,
}: HeaderProps) {
  const isTaxEnabled = taxConfig ? taxConfig.tax_regime_enabled : false;

  return (
    <header className="header-root">
      <div className="header-brand">
        {onMenuClick && (
          <button
            className="mobile-menu-btn"
            onClick={onMenuClick}
            aria-label="Toggle navigation"
          >
            <Menu size={22} />
          </button>
        )}
        <div className="header-logo-icon">
          <Armchair size={26} strokeWidth={2.2} />
        </div>
        <div>
          <div className="header-title-row">
            <h1 className="header-title">{title || t("app_title", lang)}</h1>
            <span className="badge badge-shop">Barasat, WB</span>
          </div>
          <p className="header-subtitle">{subtitle || t("app_tagline", lang)}</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Language Switcher if onLangChange provided */}
        {onLangChange && (
          <LanguageToggle currentLang={lang} onToggle={onLangChange} />
        )}

        {/* Tax Regime Indicator */}
        {onOpenTaxSettings && (
          <button
            onClick={onOpenTaxSettings}
            className={`regime-indicator-btn ${
              isTaxEnabled ? "regime-btn-gst" : "regime-btn-unregistered"
            }`}
            title="Click to configure GST Regime & Section 18(1)(a) Transitional Credit"
          >
            {isTaxEnabled ? (
              <>
                <ShieldCheck size={14} className="icon-gst" />
                <span>GST Registered</span>
              </>
            ) : (
              <>
                <ShieldAlert size={14} className="icon-unreg" />
                <span>Unregistered (Cash Memo)</span>
              </>
            )}
            <Settings size={12} className="icon-settings" />
          </button>
        )}

        {/* Database Status */}
        <div
          className={`db-indicator ${
            dbStatus.connected ? "db-connected" : "db-demo"
          }`}
          title={dbStatus.provider}
        >
          <Database size={13} />
          <span className="db-dot" />
          <span className="db-text">
            {dbStatus.connected ? "Postgres" : "Demo Store"}
          </span>
        </div>

        {/* Action Label or Add Item Primary CTA */}
        {actionLabel && onActionClick && (
          <button
            onClick={onActionClick}
            className="btn btn-primary btn-add-item"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>{actionLabel}</span>
          </button>
        )}

        {!actionLabel && onAddItemClick && (
          <button
            onClick={onAddItemClick}
            className="btn btn-primary btn-add-item"
            id="btn-add-item-header"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>{t("add_item", lang)}</span>
          </button>
        )}
      </div>

      <style jsx>{`
        .header-root {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding-bottom: 1.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        @media (min-width: 860px) {
          .header-root {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-logo-icon {
          width: 52px;
          height: 52px;
          min-width: 52px;
          background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.2) 0%,
            rgba(217, 119, 6, 0.1) 100%
          );
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          box-shadow: 0 4px 16px rgba(245, 158, 11, 0.15);
        }

        .header-title-row {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .header-title {
          font-size: 1.55rem;
          line-height: 1.2;
          background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @media (min-width: 860px) {
          .header-title {
            font-size: 1.75rem;
          }
        }

        .badge-shop {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
          font-size: 0.7rem;
          padding: 0.15rem 0.5rem;
        }

        .header-subtitle {
          color: var(--text-secondary);
          font-size: 0.85rem;
          margin-top: 0.2rem;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .regime-indicator-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.75rem;
          border-radius: var(--radius-md);
          font-size: 0.775rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .regime-btn-unregistered {
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .regime-btn-unregistered:hover {
          background: rgba(245, 158, 11, 0.2);
        }

        .regime-btn-gst {
          background: rgba(56, 189, 248, 0.12);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .regime-btn-gst:hover {
          background: rgba(56, 189, 248, 0.25);
        }

        .icon-settings {
          opacity: 0.7;
          margin-left: 0.2rem;
        }

        .db-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: 0.775rem;
          font-weight: 500;
        }

        .db-connected {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .db-demo {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }

        .db-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
      `}</style>
    </header>
  );
}
