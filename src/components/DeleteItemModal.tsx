"use client";

import React, { useState } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { InventoryItem } from "@/lib/types";

interface DeleteItemModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (itemId: number) => Promise<void>;
}

export function DeleteItemModal({ item, isOpen, onClose, onConfirm }: DeleteItemModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm(item.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header modal-header-danger">
          <h2 className="modal-title text-danger">
            <AlertTriangle size={20} />
            <span>Confirm Item Deletion</span>
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

        <div className="modal-body">
          {error && <div className="modal-alert-error">{error}</div>}

          <p className="delete-warning-text">
            Are you sure you want to permanently remove this furniture item from your inventory?
          </p>

          <div className="item-to-delete-box">
            <span className="badge badge-category">{item.category}</span>
            <h4 className="item-delete-name">{item.name}</h4>
            <p className="item-delete-stock">
              Currently tracking <strong>{item.current_quantity} units</strong> in stock.
            </p>
          </div>

          <div className="danger-notice">
            <p>
              ⚠️ <strong>Destructive Action:</strong> Deleting this item will also permanently erase
              its entire restock history audit log. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Keep Item
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={isDeleting}
            id="btn-confirm-delete-item"
          >
            <Trash2 size={16} />
            <span>{isDeleting ? "Deleting..." : "Permanently Delete"}</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-dialog-sm {
          max-width: 480px;
        }

        .text-danger {
          color: #f87171;
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

        .delete-warning-text {
          color: var(--text-primary);
          font-size: 0.95rem;
          line-height: 1.5;
          margin-bottom: 1rem;
        }

        .item-to-delete-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 1rem;
          margin-bottom: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .item-delete-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .item-delete-stock {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .danger-notice {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: var(--radius-md);
          padding: 0.85rem 1rem;
          color: #fca5a5;
          font-size: 0.825rem;
          line-height: 1.45;
        }

        .modal-alert-error {
          background: var(--status-out-stock-bg);
          border: 1px solid var(--status-out-stock-border);
          color: var(--status-out-stock-text);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
