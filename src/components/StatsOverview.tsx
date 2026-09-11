"use client";

import React from "react";
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

        /* Mobile phones (2 cols for compact high-readability stats) */
        @media (min-width: 480px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
        }

        /* Desktop */
        @media (min-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 1.25rem;
          }
        }

        .stat-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.15rem 1.25rem;
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
          background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.08) 0%,
            rgba(18, 25, 38, 0.95) 100%
          );
          border-color: rgba(245, 158, 11, 0.25);
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
          background: rgba(56, 189, 248, 0.12);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .icon-valuation {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .icon-items {
          background: rgba(168, 85, 247, 0.12);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.25);
        }

        .icon-alert {
          background: rgba(100, 116, 139, 0.12);
          color: #94a3b8;
          border: 1px solid rgba(100, 116, 139, 0.25);
        }

        .icon-alert-active {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
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
          color: #fbbf24;
        }

        .stat-sub-count {
          font-size: 0.85rem;
          font-weight: 500;
          color: #f87171;
          margin-left: 0.25rem;
        }

        .stat-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </section>
  );
}
