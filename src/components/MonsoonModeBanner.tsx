"use client";

import React from "react";
import { CloudRain, AlertTriangle } from "lucide-react";
import { MonsoonModeConfig, LanguageCode } from "@/lib/types";
import { t } from "@/lib/i18n";
import { toggleMonsoonModeAction } from "@/app/actions";

interface MonsoonModeBannerProps {
  config: MonsoonModeConfig;
  lang: LanguageCode;
  onUpdated: () => void;
}

export function MonsoonModeBanner({ config, lang, onUpdated }: MonsoonModeBannerProps) {
  const handleToggle = async () => {
    await toggleMonsoonModeAction(!config.is_active);
    onUpdated();
  };

  return (
    <div className={`monsoon-banner ${config.is_active ? "monsoon-active" : ""}`}>
      <div className="monsoon-content">
        <CloudRain size={20} className="monsoon-icon" />
        <div>
          <div className="monsoon-title-row">
            <strong>{t("monsoon_mode", lang)}</strong>
            <span className="humidity-tag">
              Humidity: {config.humidity_pct}% | Max Timber Moisture: {config.timber_moisture_max_threshold}%
            </span>
          </div>
          <p className="monsoon-desc">{t("monsoon_desc", lang)}</p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        className={`btn btn-xs ${config.is_active ? "btn-danger" : "btn-secondary"}`}
      >
        {config.is_active ? "Disable Monsoon Mode" : "Activate Monsoon Mode"}
      </button>

      <style jsx>{`
        .monsoon-banner {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.65rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .monsoon-active {
          background: rgba(56, 189, 248, 0.08);
          border-color: rgba(56, 189, 248, 0.35);
        }

        .monsoon-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .monsoon-icon {
          color: #38bdf8;
          flex-shrink: 0;
        }

        .monsoon-title-row {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          font-size: 0.85rem;
          color: var(--text-primary);
        }

        .humidity-tag {
          font-size: 0.75rem;
          background: rgba(255, 255, 255, 0.06);
          padding: 0.1rem 0.45rem;
          border-radius: var(--radius-full);
          color: var(--text-secondary);
        }

        .monsoon-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.15rem;
        }

        .btn-xs {
          font-size: 0.75rem;
          padding: 0.35rem 0.75rem;
          min-height: 30px;
        }
      `}</style>
    </div>
  );
}
