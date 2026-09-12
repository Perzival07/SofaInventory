"use client";

import { useEffect, useState } from "react";
import { X, History, Calendar, FileText, Loader2 } from "lucide-react";
import { InventoryItem, RestockHistoryEntry } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/formatters";
import { fetchItemHistoryAction } from "@/app/actions";

interface HistoryModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryModal({ item, isOpen, onClose }: HistoryModalProps) {
  const [history, setHistory] = useState<RestockHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state for an async fetch triggered by this effect
      setIsLoading(true);
      setError(null);
      fetchItemHistoryAction(item.id)
        .then((res) => {
          setHistory(res.history);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load restock history");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="history-header-title">
            <History size={20} className="modal-title-icon" />
            <div>
              <h2 className="modal-title">Restock History Log</h2>
              <p className="history-subtitle">
                Permanent chronological audit log for {item.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon-close"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body history-body">
          {/* Item Quick Meta Card */}
          <div className="history-item-meta">
            <div className="meta-col">
              <span className="meta-label">Category</span>
              <span className="badge badge-category">{item.category}</span>
            </div>
            <div className="meta-col">
              <span className="meta-label">Current In-Stock</span>
              <span className="meta-val-highlight">{item.current_quantity} units</span>
            </div>
            <div className="meta-col">
              <span className="meta-label">Current Batch Cost</span>
              <span className="meta-val">{formatINR(item.current_cost_per_unit)}</span>
            </div>
            <div className="meta-col">
              <span className="meta-label">Total History Events</span>
              <span className="meta-val">{history.length} batches</span>
            </div>
          </div>

          {/* History Timeline */}
          {isLoading ? (
            <div className="history-loading">
              <Loader2 size={32} className="spinner" />
              <p>Fetching restock audit records...</p>
            </div>
          ) : error ? (
            <div className="modal-alert-error">{error}</div>
          ) : history.length === 0 ? (
            <div className="history-empty">
              <History size={40} className="empty-icon" />
              <h4>No restock events recorded yet</h4>
              <p>Whenever you restock this item, an append-only log will appear here.</p>
            </div>
          ) : (
            <div className="timeline-container">
              {history.map((entry, index) => {
                const batchTotal = entry.quantity_added * entry.cost_per_unit;
                const isLatest = index === 0;

                return (
                  <div key={entry.id} className="timeline-item">
                    {/* Left Timeline marker */}
                    <div className="timeline-line-wrapper">
                      <div
                        className={`timeline-node ${
                          isLatest ? "timeline-node-latest" : ""
                        }`}
                      />
                      {index !== history.length - 1 && <div className="timeline-line" />}
                    </div>

                    {/* Timeline Content Card */}
                    <div
                      className={`timeline-card ${
                        isLatest ? "timeline-card-latest" : ""
                      }`}
                    >
                      <div className="timeline-top">
                        <div className="timeline-date-row">
                          <Calendar size={14} className="cal-icon" />
                          <span className="timeline-date">{formatDate(entry.restock_date)}</span>
                          {isLatest && <span className="badge-latest">LATEST BATCH</span>}
                        </div>
                        <div className="timeline-batch-total">
                          <span className="batch-total-label">Batch Total:</span>
                          <span className="batch-total-val">{formatINR(batchTotal)}</span>
                        </div>
                      </div>

                      <div className="timeline-metrics">
                        <div className="timeline-metric">
                          <span className="metric-label">Quantity Added:</span>
                          <span className="metric-val metric-qty">
                            +{entry.quantity_added} units
                          </span>
                        </div>
                        <div className="timeline-metric">
                          <span className="metric-label">Batch Unit Cost:</span>
                          <span className="metric-val">{formatINR(entry.cost_per_unit)}</span>
                        </div>
                      </div>

                      {/* Note / Supplier details */}
                      {entry.note && (
                        <div className="timeline-note">
                          <FileText size={14} className="note-icon" />
                          <span>{entry.note}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close History
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-dialog-lg {
          max-width: 660px;
        }

        .modal-title-icon {
          color: var(--accent-blue);
        }

        .history-header-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .history-subtitle {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 0.15rem;
        }

        .btn-icon-close {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .btn-icon-close:hover {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
        }

        .history-body {
          padding: 1.25rem 1.5rem;
        }

        .history-item-meta {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.85rem 1rem;
          margin-bottom: 1.5rem;
        }

        @media (min-width: 520px) {
          .history-item-meta {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .meta-col {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .meta-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .meta-val {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .meta-val-highlight {
          font-family: var(--font-heading);
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--primary);
        }

        .history-loading {
          padding: 3rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .spinner {
          animation: spin 1s linear infinite;
          color: var(--primary);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .history-empty {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--text-secondary);
        }

        .empty-icon {
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }

        /* Timeline Styles */
        .timeline-container {
          display: flex;
          flex-direction: column;
        }

        .timeline-item {
          display: flex;
          gap: 1rem;
          min-height: 80px;
        }

        .timeline-line-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 16px;
          flex-shrink: 0;
        }

        .timeline-node {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--bg-surface);
          border: 3px solid var(--accent-blue);
          margin-top: 0.25rem;
          flex-shrink: 0;
          z-index: 2;
        }

        .timeline-node-latest {
          border-color: var(--primary);
        }

        .timeline-line {
          width: 2px;
          background: var(--border-subtle);
          flex: 1;
          margin: 0.25rem 0;
        }

        .timeline-card {
          flex: 1;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.9rem 1.1rem;
          margin-bottom: 1rem;
          transition: border-color var(--transition-fast);
        }

        .timeline-card-latest {
          border-color: var(--primary-soft-border);
          background: var(--primary-soft);
        }

        .timeline-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.65rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .timeline-date-row {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .cal-icon {
          color: var(--text-muted);
        }

        .timeline-date {
          font-family: var(--font-heading);
          font-weight: 600;
          font-size: 0.925rem;
          color: var(--text-primary);
        }

        .badge-latest {
          background: var(--primary-soft);
          color: var(--primary);
          border: 1px solid var(--primary-soft-border);
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.1rem 0.45rem;
          border-radius: var(--radius-full);
          letter-spacing: 0.04em;
        }

        .timeline-batch-total {
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
        }

        .batch-total-label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .batch-total-val {
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--primary);
        }

        .timeline-metrics {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .timeline-metric {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
        }

        .metric-label {
          color: var(--text-secondary);
        }

        .metric-val {
          font-weight: 600;
          color: var(--text-primary);
        }

        .metric-qty {
          color: var(--status-in-stock-text);
        }

        .timeline-note {
          display: flex;
          align-items: flex-start;
          gap: 0.45rem;
          background: var(--bg-surface-elevated);
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.825rem;
          color: var(--text-secondary);
          margin-top: 0.5rem;
        }

        .note-icon {
          color: var(--text-muted);
          flex-shrink: 0;
          margin-top: 0.15rem;
        }
      `}</style>
    </div>
  );
}
