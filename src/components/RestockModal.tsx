"use client";

import React, { useState, useEffect } from "react";
import { X, RefreshCw, ArrowRight, PackagePlus } from "lucide-react";
import { InventoryItem, RestockInput } from "@/lib/types";
import { formatINR, getTodayDateString } from "@/lib/formatters";

interface RestockModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (itemId: number, input: RestockInput) => Promise<void>;
}

export function RestockModal({ item, isOpen, onClose, onSubmit }: RestockModalProps) {
  const [quantityAdded, setQuantityAdded] = useState<number>(5);
  const [costPerUnit, setCostPerUnit] = useState<number>(0);
  const [restockDate, setRestockDate] = useState<string>(getTodayDateString());
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill fields when item changes
  useEffect(() => {
    if (item) {
      setQuantityAdded(5);
      setCostPerUnit(item.current_cost_per_unit || 0);
      setRestockDate(getTodayDateString());
      setNote("");
      setError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const newTotalQuantity = item.current_quantity + (Number(quantityAdded) || 0);
  const totalBatchOutlay = (Number(quantityAdded) || 0) * (Number(costPerUnit) || 0);
  const newTotalItemValue = newTotalQuantity * (Number(costPerUnit) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantityAdded || quantityAdded <= 0) {
      setError("Please enter a valid quantity of at least 1 unit.");
      return;
    }
    if (costPerUnit < 0) {
      setError("Cost per unit cannot be negative.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(item.id, {
        quantity_added: Number(quantityAdded),
        cost_per_unit: Number(costPerUnit),
        restock_date: restockDate,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restock item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <RefreshCw size={20} className="modal-title-icon" />
            <span>Restock / Renew Furniture Stock</span>
          </h2>
          <button
            onClick={onClose}
            className="btn-icon-close"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            {/* Target Item Current Context Summary */}
            <div className="item-summary-card">
              <div className="summary-left">
                <span className="summary-category">{item.category}</span>
                <h4 className="summary-name">{item.name}</h4>
              </div>
              <div className="summary-right">
                <span className="summary-qty-label">Current Stock</span>
                <span className="summary-qty-val">{item.current_quantity} units</span>
                <span className="summary-prev-cost">
                  Prev: {formatINR(item.current_cost_per_unit)}/unit
                </span>
              </div>
            </div>

            {/* Quantity Added & Cost per unit for THIS new batch */}
            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="input-restock-qty" className="form-label">
                  Units Being Added *
                </label>
                <input
                  id="input-restock-qty"
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  value={quantityAdded}
                  onChange={(e) => setQuantityAdded(Math.max(1, parseInt(e.target.value) || 0))}
                  autoFocus
                  required
                />
                <span className="form-hint">Physical stock arriving</span>
              </div>

              <div className="form-group">
                <label htmlFor="input-restock-cost" className="form-label">
                  New Batch Cost per Unit (₹) *
                </label>
                <input
                  id="input-restock-cost"
                  type="number"
                  min="0"
                  step="100"
                  className="form-input"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(Math.max(0, parseFloat(e.target.value) || 0))}
                  required
                />
                <span className="form-hint">Updates current unit cost</span>
              </div>
            </div>

            {/* Restock Date & Supplier/Invoice Note */}
            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="input-restock-date" className="form-label">
                  Restock Date *
                </label>
                <input
                  id="input-restock-date"
                  type="date"
                  className="form-input"
                  value={restockDate}
                  onChange={(e) => setRestockDate(e.target.value)}
                  required
                />
                <span className="form-hint">Defaults to today (editable)</span>
              </div>

              <div className="form-group">
                <label htmlFor="input-restock-note" className="form-label">
                  Supplier / Invoice Note
                </label>
                <input
                  id="input-restock-note"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Royal Woodworks, Inv #4092"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <span className="form-hint">Saved permanently in history</span>
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="calculation-preview">
              <div className="calc-row">
                <span className="calc-label">Stock Transition:</span>
                <span className="calc-transition">
                  <span>{item.current_quantity} units</span>
                  <ArrowRight size={14} />
                  <strong>{newTotalQuantity} units</strong>
                  <span className="badge-plus">+{quantityAdded}</span>
                </span>
              </div>
              <div className="calc-row">
                <span className="calc-label">This Batch Outlay:</span>
                <span className="calc-val">{formatINR(totalBatchOutlay)}</span>
              </div>
              <div className="calc-row calc-row-highlight">
                <span className="calc-label">Updated Total Inventory Value:</span>
                <span className="calc-val value-gold">{formatINR(newTotalItemValue)}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              id="btn-submit-restock"
            >
              <PackagePlus size={18} />
              <span>{isSubmitting ? "Restocking..." : "Confirm & Update Stock"}</span>
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-title-icon {
          color: var(--primary);
        }

        .btn-icon-close {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .btn-icon-close:hover {
          background: rgba(255, 255, 255, 0.15);
          color: var(--text-primary);
        }

        .modal-alert-error {
          background: var(--status-out-stock-bg);
          border: 1px solid var(--status-out-stock-border);
          color: var(--status-out-stock-text);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          margin-bottom: 1.25rem;
        }

        .item-summary-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
          gap: 1rem;
        }

        .summary-left {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .summary-category {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--primary);
          text-transform: uppercase;
        }

        .summary-name {
          font-size: 1.05rem;
          color: var(--text-primary);
        }

        .summary-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.15rem;
          text-align: right;
        }

        .summary-qty-label {
          font-size: 0.725rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .summary-qty-val {
          font-family: var(--font-heading);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .summary-prev-cost {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .form-row-2col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (min-width: 480px) {
          .form-row-2col {
            grid-template-columns: 1fr 1fr;
          }
        }

        .calculation-preview {
          background: rgba(245, 158, 11, 0.05);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          margin-top: 0.5rem;
        }

        .calc-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .calc-row-highlight {
          border-top: 1px solid rgba(245, 158, 11, 0.15);
          padding-top: 0.65rem;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .calc-label {
          color: var(--text-secondary);
        }

        .calc-transition {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--text-primary);
        }

        .badge-plus {
          background: var(--status-in-stock-bg);
          color: var(--status-in-stock-text);
          padding: 0.1rem 0.45rem;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 700;
        }

        .calc-val {
          font-weight: 600;
          color: var(--text-primary);
        }

        .value-gold {
          font-family: var(--font-heading);
          color: #fbbf24;
          font-size: 1.15rem;
        }
      `}</style>
    </div>
  );
}
