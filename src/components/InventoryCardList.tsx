"use client";

import { RefreshCw, History, Pencil, Trash2, Calendar, AlertCircle } from "lucide-react";
import { InventoryItem } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/formatters";

interface InventoryCardListProps {
  items: InventoryItem[];
  onRestockClick: (item: InventoryItem) => void;
  onHistoryClick: (item: InventoryItem) => void;
  onEditClick: (item: InventoryItem) => void;
  onDeleteClick: (item: InventoryItem) => void;
}

export function InventoryCardList({
  items,
  onRestockClick,
  onHistoryClick,
  onEditClick,
  onDeleteClick,
}: InventoryCardListProps) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <AlertCircle size={40} className="empty-icon" />
        <h3 className="empty-title">No furniture items found</h3>
        <p className="empty-desc">
          Try adjusting your search or category filters, or click &quot;Add New Furniture&quot; above.
        </p>
      </div>
    );
  }

  return (
    <div className="cards-grid">
      {items.map((item) => {
        const isOutOfStock = item.current_quantity === 0;
        const isLowStock = item.current_quantity > 0 && item.current_quantity <= 3;

        return (
          <article key={item.id} className="inventory-card">
            {/* Card Header: Category & Edit/Delete quick controls */}
            <div className="card-top-bar">
              <span className="badge badge-category">{item.category}</span>
              <div className="card-quick-actions">
                <button
                  onClick={() => onEditClick(item)}
                  className="btn-icon-subtle"
                  title="Edit item"
                  aria-label={`Edit ${item.name}`}
                  id={`btn-card-edit-${item.id}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => onDeleteClick(item)}
                  className="btn-icon-subtle btn-icon-delete"
                  title="Delete item"
                  aria-label={`Delete ${item.name}`}
                  id={`btn-card-delete-${item.id}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Item Name */}
            <h3 className="card-item-name">{item.name}</h3>

            {/* Current Stock Banner */}
            <div className="card-stock-row">
              <div className="stock-counter">
                <span className="stock-big-num">{item.current_quantity}</span>
                <span className="stock-units-label">Units in Stock</span>
              </div>
              <div className="stock-status-pill">
                {isOutOfStock ? (
                  <span className="badge badge-out-stock">Out of Stock</span>
                ) : isLowStock ? (
                  <span className="badge badge-low-stock">Low Stock</span>
                ) : (
                  <span className="badge badge-in-stock">In Stock</span>
                )}
              </div>
            </div>

            {/* Financial Details (Current Batch Cost & Total Stock Valuation) */}
            <div className="card-financials">
              <div className="financial-box">
                <span className="fin-label">Batch Unit Cost</span>
                <span className="fin-value">{formatINR(item.current_cost_per_unit)}</span>
              </div>
              <div className="financial-box financial-box-highlight">
                <span className="fin-label">Total Stock Value</span>
                <span className="fin-value value-gold">{formatINR(item.total_value)}</span>
              </div>
            </div>

            {/* Last Restocked Date Info */}
            <div className="card-date-row">
              <Calendar size={14} className="date-icon" />
              <span>Last Restocked: {formatDate(item.last_restocked_at)}</span>
            </div>

            {/* Card Bottom Primary Action Buttons (Large Touch Targets >= 44px) */}
            <div className="card-actions-grid">
              <button
                onClick={() => onRestockClick(item)}
                className="btn btn-primary card-action-btn"
                id={`btn-card-restock-${item.id}`}
              >
                <RefreshCw size={16} />
                <span>Restock</span>
              </button>
              <button
                onClick={() => onHistoryClick(item)}
                className="btn btn-secondary card-action-btn"
                id={`btn-card-history-${item.id}`}
              >
                <History size={16} />
                <span>History</span>
              </button>
            </div>
          </article>
        );
      })}

      <style jsx>{`
        .cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.15rem;
        }

        /* Tablet (600px - 1024px): 2 columns, perfect for counter-top iPads and tablets */
        @media (min-width: 600px) {
          .cards-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.25rem;
          }
        }

        /* Large Screens (when card view is explicitly selected): 3 columns */
        @media (min-width: 1100px) {
          .cards-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
          }
        }

        .inventory-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-sm);
          transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .inventory-card:hover {
          border-color: var(--border-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .card-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .card-quick-actions {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .btn-icon-subtle {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .btn-icon-subtle:hover {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .btn-icon-delete:hover {
          background: var(--status-out-stock-bg);
          color: var(--status-out-stock-text);
          border-color: var(--status-out-stock-border);
        }

        .card-item-name {
          font-family: var(--font-heading);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.35;
          margin-bottom: 1rem;
          min-height: 2.7rem;
        }

        .card-stock-row {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .stock-counter {
          display: flex;
          align-items: baseline;
          gap: 0.45rem;
        }

        .stock-big-num {
          font-family: var(--font-heading);
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .stock-units-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .card-financials {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.65rem;
          margin-bottom: 1rem;
        }

        .financial-box {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .financial-box-highlight {
          background: var(--primary-soft);
          border-color: var(--primary-soft-border);
        }

        .fin-label {
          font-size: 0.725rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .fin-value {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .value-gold {
          color: var(--primary);
          font-family: var(--font-heading);
          font-size: 1.05rem;
        }

        .card-date-row {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 1.15rem;
        }

        .date-icon {
          color: var(--text-muted);
        }

        .card-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.65rem;
          margin-top: auto;
        }

        .card-action-btn {
          width: 100%;
          min-height: 46px; /* Large touch target for tablets & phones */
          font-size: 0.875rem;
        }

        /* Empty state */
        .empty-state {
          grid-column: 1 / -1;
          padding: 4rem 2rem;
          text-align: center;
          background: var(--bg-surface);
          border: 1px dashed var(--border-subtle);
          border-radius: var(--radius-lg);
        }

        .empty-icon {
          color: var(--text-muted);
          margin-bottom: 1rem;
        }

        .empty-title {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .empty-desc {
          color: var(--text-secondary);
          font-size: 0.925rem;
          max-width: 440px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
}
