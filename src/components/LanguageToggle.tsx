"use client";

import React from "react";
import { Languages } from "lucide-react";
import { LanguageCode } from "@/lib/types";

interface LanguageToggleProps {
  currentLang: LanguageCode;
  onToggle: (lang: LanguageCode) => void;
}

export function LanguageToggle({ currentLang, onToggle }: LanguageToggleProps) {
  return (
    <div className="lang-toggle-group" role="group" aria-label="Language Selector">
      <Languages size={15} className="lang-icon" />
      <button
        className={`lang-btn ${currentLang === "en" ? "active" : ""}`}
        onClick={() => onToggle("en")}
        title="English"
      >
        EN
      </button>
      <span className="divider">/</span>
      <button
        className={`lang-btn ${currentLang === "bn" ? "active" : ""}`}
        onClick={() => onToggle("bn")}
        title="বাংলা (Bengali)"
      >
        বাংলা
      </button>

      <style jsx>{`
        .lang-toggle-group {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full);
          padding: 0.25rem 0.65rem;
          font-size: 0.775rem;
          font-weight: 600;
        }

        .lang-icon {
          color: var(--primary);
        }

        .lang-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.775rem;
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
          transition: all var(--transition-fast);
        }

        .lang-btn.active {
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.12);
          font-weight: 700;
        }

        .divider {
          color: var(--text-muted);
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
