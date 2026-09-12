"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Building,
  HelpCircle,
} from "lucide-react";
import { TurnoverWatchdogStatus, LanguageCode } from "@/lib/types";
import { formatINR } from "@/lib/formatters";
import { t } from "@/lib/i18n";
import { updateExternalPanTurnoverAction } from "@/app/actions";

interface TurnoverWatchdogCardProps {
  status: TurnoverWatchdogStatus;
  lang: LanguageCode;
  onTurnoverUpdated: () => void;
  onOpenTaxSettings: () => void;
  taxEnabled: boolean;
}

export function TurnoverWatchdogCard({
  status,
  lang,
  onTurnoverUpdated,
  onOpenTaxSettings,
  taxEnabled,
}: TurnoverWatchdogCardProps) {
  const [otherPanInput, setOtherPanInput] = useState<number>(
    status.other_pan_businesses_turnover
  );
  const [isSavingPan, setIsSavingPan] = useState(false);

  const percentOfThreshold = Math.min(
    100,
    Math.round((status.aggregate_pan_turnover / status.threshold_limit) * 100)
  );

  const handleSavePanTurnover = async () => {
    try {
      setIsSavingPan(true);
      await updateExternalPanTurnoverAction(otherPanInput);
      onTurnoverUpdated();
    } finally {
      setIsSavingPan(false);
    }
  };

  // Determine status color and banner
  let statusBadgeClass = "badge-safe";
  let statusText = t("turnover_safe", lang);

  if (status.status === "EXCEEDED") {
    statusBadgeClass = "badge-danger-blocking";
    statusText = "EXCEEDED ₹40L THRESHOLD - GST MANDATORY";
  } else if (status.status === "BLOCKING_WARNING") {
    statusBadgeClass = "badge-danger-blocking";
    statusText = t("turnover_blocking", lang);
  } else if (status.status === "RED_ALERT") {
    statusBadgeClass = "badge-red";
    statusText = t("turnover_red", lang);
  } else if (status.status === "AMBER_WARNING") {
    statusBadgeClass = "badge-amber";
    statusText = t("turnover_amber", lang);
  }

  return (
    <div className={`watchdog-card ${taxEnabled ? "watchdog-tax-on" : ""}`}>
      <div className="watchdog-header">
        <div className="watchdog-title-group">
          <div className="watchdog-icon-wrap">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="watchdog-title-row">
              <h3 className="watchdog-title">{t("turnover_watchdog", lang)}</h3>
              <span className={`badge ${statusBadgeClass}`}>{statusText}</span>
            </div>
            <p className="watchdog-subtitle">
              {taxEnabled
                ? "Tax Regime: REGISTERED — Turnover monitored for informational filing frequency"
                : "Tax Regime: UNREGISTERED — Monitoring aggregate PAN turnover against ₹40L Goods Threshold"}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenTaxSettings}
          className="btn btn-secondary btn-sm"
          id="btn-open-tax-settings"
        >
          {t("switch_tax_regime", lang)}
        </button>
      </div>

      {/* Progress Bar with statutory thresholds */}
      <div className="progress-section">
        <div className="progress-labels">
          <span className="current-turnover-label">
            Current Aggregate:{" "}
            <strong>{formatINR(status.aggregate_pan_turnover)}</strong> ({percentOfThreshold}%)
          </span>
          <span className="threshold-label">
            Limit: <strong>{formatINR(status.threshold_limit)}</strong> (₹40 Lakhs)
          </span>
        </div>

        <div className="progress-track">
          <div
            className={`progress-fill ${
              status.status === "EXCEEDED" || status.status === "BLOCKING_WARNING"
                ? "fill-danger"
                : status.status === "RED_ALERT"
                ? "fill-red"
                : status.status === "AMBER_WARNING"
                ? "fill-amber"
                : "fill-safe"
            }`}
            style={{ width: `${percentOfThreshold}%` }}
          />
          {/* Threshold markers */}
          <div className="threshold-marker marker-amber" title="Amber Alert: ₹30L">
            <span className="marker-label">₹30L</span>
          </div>
          <div className="threshold-marker marker-red" title="Red Alert: ₹35L">
            <span className="marker-label">₹35L</span>
          </div>
          <div className="threshold-marker marker-blocking" title="Blocking Alert: ₹38L">
            <span className="marker-label">₹38L</span>
          </div>
        </div>
      </div>

      {/* Metrics Row: Shop Sales + Other PAN Businesses + Festive Projection */}
      <div className="watchdog-grid">
        <div className="watchdog-metric-box">
          <span className="metric-title">This Furniture Shop Sales</span>
          <span className="metric-number text-highlight">
            {formatINR(status.shop_turnover)}
          </span>
          <span className="metric-desc">Live counter & delivery sales</span>
        </div>

        {/* Other PAN businesses turnover input */}
        <div className="watchdog-metric-box">
          <div className="pan-header">
            <span className="metric-title">Other Businesses on same PAN</span>
            <Building size={14} className="icon-pan" />
          </div>
          <div className="pan-input-row">
            <span className="rupee-prefix">₹</span>
            <input
              type="number"
              className="pan-input"
              value={otherPanInput}
              onChange={(e) => setOtherPanInput(Math.max(0, parseInt(e.target.value) || 0))}
              step="10000"
              title="Enter turnover from other entities under same PAN"
            />
            <button
              onClick={handleSavePanTurnover}
              className="btn btn-secondary btn-xs"
              disabled={isSavingPan || otherPanInput === status.other_pan_businesses_turnover}
            >
              {isSavingPan ? "Saving..." : "Update"}
            </button>
          </div>
          <span className="metric-desc">Aggregate turnover is PAN-India across all shops</span>
        </div>

        {/* Festive Season Projection */}
        <div className="watchdog-metric-box">
          <div className="pan-header">
            <span className="metric-title">{t("projected_fy_turnover", lang)}</span>
            <TrendingUp size={14} className="icon-trend" />
          </div>
          <span className="metric-number value-gold">
            {formatINR(status.projected_yearend_turnover)}
          </span>
          <span className="metric-desc">
            Includes +{status.festival_season_uplift_pct}% Durga Puja & wedding season uplift
          </span>
        </div>
      </div>

      <style jsx>{`
        .watchdog-card {
          background: var(--bg-surface);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: var(--radius-lg);
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.75rem;
          box-shadow: var(--shadow-sm);
        }

        .watchdog-tax-on {
          border-color: rgba(56, 189, 248, 0.3);
        }

        .watchdog-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .watchdog-title-group {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
        }

        .watchdog-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .watchdog-title-row {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .watchdog-title {
          font-size: 1.2rem;
          margin: 0;
        }

        .watchdog-subtitle {
          font-size: 0.825rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        .badge-safe {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .badge-amber {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }

        .badge-red {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.35);
        }

        .badge-danger-blocking {
          background: #7f1d1d;
          color: #fecaca;
          border: 1px solid #ef4444;
          animation: pulseSubtle 1.8s infinite ease-in-out;
        }

        .progress-section {
          margin-bottom: 1.25rem;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .progress-track {
          position: relative;
          height: 14px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-full);
          overflow: visible;
        }

        .progress-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 400ms ease;
        }

        .fill-safe {
          background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
        }

        .fill-amber {
          background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
        }

        .fill-red {
          background: linear-gradient(90deg, #ea580c 0%, #f97316 100%);
        }

        .fill-danger {
          background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
        }

        .threshold-marker {
          position: absolute;
          top: -3px;
          bottom: -3px;
          width: 2px;
          background: #ffffff;
        }

        .marker-amber {
          left: 75%;
          background: #fbbf24;
        }

        .marker-red {
          left: 87.5%;
          background: #f97316;
        }

        .marker-blocking {
          left: 95%;
          background: #ef4444;
        }

        .marker-label {
          position: absolute;
          top: 16px;
          transform: translateX(-50%);
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .watchdog-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.85rem;
        }

        @media (min-width: 680px) {
          .watchdog-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .watchdog-metric-box {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .metric-title {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          font-weight: 600;
        }

        .metric-number {
          font-family: var(--font-heading);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .text-highlight {
          color: #38bdf8;
        }

        .value-gold {
          color: #fbbf24;
        }

        .metric-desc {
          font-size: 0.725rem;
          color: var(--text-muted);
        }

        .pan-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .icon-pan {
          color: var(--text-muted);
        }

        .icon-trend {
          color: #fbbf24;
        }

        .pan-input-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .rupee-prefix {
          font-weight: 600;
          color: var(--text-secondary);
        }

        .pan-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 700;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          min-width: 0;
        }

        .btn-xs {
          font-size: 0.75rem;
          padding: 0.3rem 0.5rem;
          min-height: 28px;
        }
      `}</style>
    </div>
  );
}
