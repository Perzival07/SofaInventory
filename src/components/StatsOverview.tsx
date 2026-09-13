"use client";

import { Package, IndianRupee, Layers, AlertTriangle } from "lucide-react";
import { InventorySummary } from "@/lib/types";
import { formatINR } from "@/lib/formatters";

interface StatsOverviewProps {
  summary: InventorySummary;
}

export function StatsOverview({ summary }: StatsOverviewProps) {
  return (
    <section className="stats-grid" aria-label="Inventory Metrics Summary">
      {/* 1. Total Stock Units */}
      <div className="stat-card">
        <div className="stat-icon-wrapper icon-units">
          <Package size={22} />
        </div>
        <div className="stat-details">
          <p className="stat-label">Total Units in Stock</p>
          <p className="stat-value">{summary.totalStockUnits.toLocaleString("en-IN")}</p>
          <p className="stat-hint">Across all categories</p>
        </div>
      </div>

      {/* 2. Total Valuation in INR */}
      <div className="stat-card stat-card-highlight">
        <div className="stat-icon-wrapper icon-valuation">
          <IndianRupee size={22} />
        </div>
        <div className="stat-details">
          <p className="stat-label">Current Stock Valuation</p>
          <p className="stat-value valuation-value">
            {formatINR(summary.totalInventoryValue)}
          </p>
          <p className="stat-hint">At latest batch costs</p>
        </div>
      </div>

      {/* 3. Unique Furniture Designs */}
      <div className="stat-card">
        <div className="stat-icon-wrapper icon-items">
          <Layers size={22} />
        </div>
        <div className="stat-details">
          <p className="stat-label">Active Furniture Items</p>
          <p className="stat-value">{summary.totalItems}</p>
          <p className="stat-hint">{summary.categories.length} categories active</p>
        </div>
      </div>

      {/* 4. Low Stock Alert */}
      <div className="stat-card">
        <div
          className={`stat-icon-wrapper ${
            summary.lowStockCount > 0 || summary.outOfStockCount > 0
              ? "icon-alert-active"
              : "icon-alert"
          }`}
        >
          <AlertTriangle size={22} />
        </div>
        <div className="stat-details">
          <p className="stat-label">Stock Attention</p>
          <p className="stat-value">
            {summary.lowStockCount + summary.outOfStockCount}
            <span className="stat-sub-count">
              {summary.outOfStockCount > 0 ? ` (${summary.outOfStockCount} zero)` : ""}
            </span>
          </p>
          <p className="stat-hint">
            {summary.lowStockCount + summary.outOfStockCount > 0
              ? "Items ≤ 3 units need restock"
              : "All items adequately stocked"}
          </p>
        </div>
      </div>

      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.85rem;
          margin-bottom: 1.75rem;
        }

        /* minmax(0, 1fr) rather than 1fr: a plain 1fr track cannot shrink below
           its card's longest unbreakable line, which pushed the right column
           off-screen on narrow phones. Breakpoints leave each card enough room
           for the rupee valuation; above 1024px the sidebar takes 260px, so
           four columns only fit on wide screens. */
        @media (min-width: 560px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
          }
        }

        @media (min-width: 1400px) {
          .stats-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 1.25rem;
          }
        }

        .stat-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.15rem 1.25rem;
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          transition: transform var(--transition-fast), border-color var(--transition-fast);
        }

        .stat-card:hover {
          border-color: var(--border-hover);
          transform: translateY(-2px);
        }

        .stat-card-highlight {
          border-color: var(--primary-soft-border);
          background: var(--primary-soft);
        }

        .stat-icon-wrapper {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-units {
          background: var(--accent-blue-soft);
          color: var(--accent-blue);
          border: 1px solid #bae6fd;
        }

        .icon-valuation {
          background: #ffffff;
          color: var(--primary);
          border: 1px solid var(--primary-soft-border);
        }

        .icon-items {
          background: var(--accent-purple-soft);
          color: var(--accent-purple);
          border: 1px solid #e9d5ff;
        }

        .icon-alert {
          background: var(--bg-surface-elevated);
          color: var(--text-muted);
          border: 1px solid var(--border-subtle);
        }

        .icon-alert-active {
          background: var(--status-out-stock-bg);
          color: var(--status-out-stock-text);
          border: 1px solid var(--status-out-stock-border);
          animation: pulseSubtle 2.5s infinite ease-in-out;
        }

        .stat-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .stat-label {
          font-size: 0.775rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .stat-value {
          font-family: var(--font-heading);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.25;
          margin-top: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .valuation-value {
          color: var(--primary);
        }

        .stat-sub-count {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--status-out-stock-text);
          margin-left: 0.25rem;
        }

        .stat-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.2rem;
        }
      `}</style>
    </section>
  );
}
