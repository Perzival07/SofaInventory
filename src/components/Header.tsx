"use client";

import React from "react";
import { Armchair, Plus, Database, Sparkles } from "lucide-react";

interface HeaderProps {
  onAddItemClick: () => void;
  dbStatus: { connected: boolean; provider: string };
}

export function Header({ onAddItemClick, dbStatus }: HeaderProps) {
  return (
    <header className="header-root">
      <div className="header-brand">
        <div className="header-logo-icon">
          <Armchair size={26} strokeWidth={2.2} />
        </div>
        <div>
          <div className="header-title-row">
            <h1 className="header-title">The Sofa Studio</h1>
            <span className="badge badge-shop">Furniture Co.</span>
          </div>
          <p className="header-subtitle">
            Real-time Inventory & Batch Restocking System
          </p>
        </div>
      </div>

      <div className="header-actions">
        {/* DB Connection Indicator */}
        <div
          className={`db-indicator ${
            dbStatus.connected ? "db-connected" : "db-demo"
          }`}
          title={
            dbStatus.connected
              ? "Connected to Vercel Postgres (Neon)"
              : "Running in demo mode. Set POSTGRES_URL to persist to Vercel Postgres."
          }
        >
          <Database size={14} />
          <span className="db-dot" />
          <span className="db-text">
            {dbStatus.connected ? "Vercel Postgres" : "In-Memory Demo"}
          </span>
        </div>

        {/* Primary Add Item CTA */}
        <button
          onClick={onAddItemClick}
          className="btn btn-primary btn-add-item"
          id="btn-add-item-header"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Add New Furniture</span>
        </button>
      </div>

      <style jsx>{`
        .header-root {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding-bottom: 1.75rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        @media (min-width: 768px) {
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
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%);
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
          font-size: 1.65rem;
          line-height: 1.2;
          background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @media (min-width: 768px) {
          .header-title {
            font-size: 1.9rem;
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
          font-size: 0.875rem;
          margin-top: 0.2rem;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 600px) {
          .header-actions {
            width: 100%;
            justify-content: space-between;
          }
          .btn-add-item {
            flex: 1;
          }
        }

        .db-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.8rem;
          border-radius: var(--radius-full);
          font-size: 0.785rem;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        .db-connected {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .db-demo {
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .db-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 8px currentColor;
          animation: pulseSubtle 2s infinite ease-in-out;
        }
      `}</style>
    </header>
  );
}
