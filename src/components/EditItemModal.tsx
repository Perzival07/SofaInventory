"use client";

import React, { useState, useEffect } from "react";
import { X, Pencil } from "lucide-react";
import { InventoryItem, EditItemInput, COMMON_CATEGORIES } from "@/lib/types";

interface EditItemModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (itemId: number, input: EditItemInput) => Promise<void>;
}

export function EditItemModal({ item, isOpen, onClose, onSubmit }: EditItemModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Sofa");
  const [customCategory, setCustomCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      const isKnown = (COMMON_CATEGORIES as readonly string[]).includes(item.category);
      if (isKnown && item.category !== "All") {
        setCategory(item.category);
        setCustomCategory("");
      } else {
        setCategory("Other");
        setCustomCategory(item.category);
      }
      setError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const resolvedCategory = category === "Other" ? customCategory.trim() : category;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Item name cannot be empty.");
      return;
    }
    if (category === "Other" && !customCategory.trim()) {
      setError("Please specify a custom category name.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(item.id, {
        name: name.trim(),
        category: resolvedCategory || "General",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Pencil size={18} className="modal-title-icon" />
            <span>Edit Furniture Details</span>
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

            <div className="form-group">
              <label htmlFor="input-edit-item-name" className="form-label">
                Furniture Item Name *
              </label>
              <input
                id="input-edit-item-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="select-edit-item-category" className="form-label">
                Category *
              </label>
              <select
                id="select-edit-item-category"
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {COMMON_CATEGORIES.filter((c) => c !== "All").map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {category === "Other" && (
              <div className="form-group">
                <label htmlFor="input-edit-custom-category" className="form-label">
                  Custom Category Name *
                </label>
                <input
                  id="input-edit-custom-category"
                  type="text"
                  className="form-input"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="edit-info-box">
              <p className="edit-hint">
                Note: Stock quantity ({item.current_quantity} units) and current unit cost are
                updated through the <strong>Restock</strong> action to maintain strict inventory audit
                integrity.
              </p>
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
              id="btn-submit-edit-item"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
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

        .edit-info-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          margin-top: 1rem;
        }

        .edit-hint {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
      `}</style>
    </div>
  );
}
