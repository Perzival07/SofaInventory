"use client";

import { History, RefreshCw, Pencil, Trash2, Calendar, AlertCircle } from "lucide-react";
import { InventoryItem } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/formatters";

interface InventoryTableProps {
  items: InventoryItem[];
  onRestockClick: (item: InventoryItem) => void;
  onHistoryClick: (item: InventoryItem) => void;
  onEditClick: (item: InventoryItem) => void;
  onDeleteClick: (item: InventoryItem) => void;
}

export function InventoryTable({
  items,
  onRestockClick,
  onHistoryClick,
  onEditClick,
  onDeleteClick,
}: InventoryTableProps) {
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
    <div className="table-responsive-wrapper">
      <table className="inventory-table">
        <thead>
          <tr>
            <th className="th-item">Furniture Item & Category</th>
            <th className="th-stock">Current Stock</th>
            <th className="th-cost">Current Batch Cost</th>
            <th className="th-value">Total Stock Value</th>
            <th className="th-date">Last Restocked</th>
            <th className="th-actions text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isOutOfStock = item.current_quantity === 0;
            const isLowStock = item.current_quantity > 0 && item.current_quantity <= 3;

            return (
              <tr key={item.id} className="table-row">
                {/* 1. Name & Category */}
                <td className="td-item">
                  <div className="item-name-cell">
                    <span className="item-name">{item.name}</span>
                    <span className="badge badge-category">{item.category}</span>
                  </div>
                </td>

                {/* 2. Current Stock */}
                <td className="td-stock">
                  <div className="stock-cell">
                    <span className="stock-number">{item.current_quantity}</span>
                    {isOutOfStock ? (
                      <span className="badge badge-out-stock">Out of Stock</span>
                    ) : isLowStock ? (
                      <span className="badge badge-low-stock">Low Stock</span>
                    ) : (
                      <span className="badge badge-in-stock">In Stock</span>
                    )}
                  </div>
                </td>

                {/* 3. Cost Per Unit (Current Batch) */}
                <td className="td-cost">
                  <div className="cost-cell">
                    <span className="cost-val">{formatINR(item.current_cost_per_unit)}</span>
                    <span className="sub-hint">per unit</span>
                  </div>
                </td>

                {/* 4. Total Stock Value */}
                <td className="td-value">
                  <div className="value-cell">
                    <span className="total-val">{formatINR(item.total_value)}</span>
                    <span className="sub-hint">
                      {item.current_quantity} × {formatINR(item.current_cost_per_unit)}
                    </span>
                  </div>
                </td>

                {/* 5. Last Restocked */}
                <td className="td-date">
                  <div className="date-cell">
                    <Calendar size={14} className="date-icon" />
                    <span>{formatDate(item.last_restocked_at)}</span>
                  </div>
                </td>

                {/* 6. Actions */}
                <td className="td-actions">
                  <div className="actions-wrapper">
                    {/* Restock: the one primary action per row */}
                    <button
                      onClick={() => onRestockClick(item)}
                      className="btn btn-primary btn-sm"
                      title="Restock this item"
                      id={`btn-restock-${item.id}`}
                    >
                      <RefreshCw size={14} />
                      <span>Restock</span>
                    </button>

                    {/* Secondary actions: neutral icon buttons */}
                    <button
                      onClick={() => onHistoryClick(item)}
                      className="btn-row-icon"
                      title="View batch restock history"
                      aria-label={`View history for ${item.name}`}
                      id={`btn-history-${item.id}`}
                    >
                      <History size={15} />
                    </button>

                    <button
                      onClick={() => onEditClick(item)}
                      className="btn-row-icon"
                      title="Edit item name & category"
                      aria-label={`Edit ${item.name}`}
                      id={`btn-edit-${item.id}`}
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      onClick={() => onDeleteClick(item)}
                      className="btn-row-icon btn-row-icon-danger"
                      title="Delete item"
                      aria-label={`Delete ${item.name}`}
                      id={`btn-delete-${item.id}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <style jsx>{`
        .table-responsive-wrapper {
          width: 100%;
          overflow-x: auto;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .inventory-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.925rem;
        }

        thead {
          background: var(--bg-surface-elevated);
          border-bottom: 1px solid var(--border-subtle);
        }

        th {
          font-family: var(--font-heading);
          font-size: 0.775rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 1rem 1.15rem;
          white-space: nowrap;
        }

        .text-right {
          text-align: right;
        }

        .table-row {
          border-bottom: 1px solid var(--border-subtle);
          transition: background-color var(--transition-fast);
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:hover {
          background-color: var(--bg-surface-hover);
        }

        td {
          padding: 1rem 1.15rem;
          vertical-align: middle;
        }

        .item-name-cell {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          align-items: flex-start;
          max-width: 320px;
        }

        .item-name {
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.35;
        }

        .stock-cell {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .stock-number {
          font-family: var(--font-heading);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          min-width: 26px;
        }

        .cost-cell,
        .value-cell {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .cost-val {
          font-weight: 600;
          color: var(--text-primary);
        }

        .total-val {
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 1.05rem;
          color: var(--primary);
        }

        .sub-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .date-cell {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--text-secondary);
          font-size: 0.85rem;
          white-space: nowrap;
        }

        .date-icon {
          color: var(--text-muted);
        }

        .actions-wrapper {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.4rem;
        }

        /* Empty state */
        .empty-state {
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
