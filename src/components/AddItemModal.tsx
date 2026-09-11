"use client";

import React, { useState } from "react";
import { X, Plus, Sparkles } from "lucide-react";
import { AddItemInput, COMMON_CATEGORIES } from "@/lib/types";
import { formatINR } from "@/lib/formatters";

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: AddItemInput) => Promise<void>;
}

export function AddItemModal({ isOpen, onClose, onSubmit }: AddItemModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Sofa");
  const [customCategory, setCustomCategory] = useState("");
  const [initialQuantity, setInitialQuantity] = useState<number>(1);
  const [initialCost, setInitialCost] = useState<number>(25000);
  const [initialNote, setInitialNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resolvedCategory = category === "Other" ? customCategory.trim() : category;
  const estimatedInitialValue = (Number(initialQuantity) || 0) * (Number(initialCost) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter the furniture item name.");
      return;
    }
    if (category === "Other" && !customCategory.trim()) {
      setError("Please enter a custom category name.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        category: resolvedCategory || "General",
        initial_quantity: Number(initialQuantity) || 0,
        initial_cost_per_unit: Number(initialCost) || 0,
        initial_note: initialNote.trim() || undefined,
      });
      // Reset form on success
      setName("");
      setCategory("Sofa");
      setCustomCategory("");
      setInitialQuantity(1);
      setInitialCost(25000);
      setInitialNote("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add furniture item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Plus size={20} className="modal-title-icon" />
            <span>Add New Furniture Item</span>
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

            {/* Item Name */}
            <div className="form-group">
              <label htmlFor="input-new-item-name" className="form-label">
                Furniture Item Name *
              </label>
              <input
                id="input-new-item-name"
                type="text"
                className="form-input"
                placeholder="e.g. 3-Seater Chesterfield Sofa - Grey Velvet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
              <span className="form-hint">Be specific with color, material, or model.</span>
            </div>

            {/* Category Select */}
            <div className="form-group">
              <label htmlFor="select-new-item-category" className="form-label">
                Category *
              </label>
              <select
                id="select-new-item-category"
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
                <label htmlFor="input-custom-category" className="form-label">
                  Custom Category Name *
                </label>
                <input
                  id="input-custom-category"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bookshelf, TV Unit, Ottoman..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}

            {/* 2-Column Inputs: Quantity & Cost */}
            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="input-new-item-qty" className="form-label">
                  Initial Quantity *
                </label>
                <input
                  id="input-new-item-qty"
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  value={initialQuantity}
                  onChange={(e) => setInitialQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  required
                />
                <span className="form-hint">Units currently in showroom/warehouse</span>
              </div>

              <div className="form-group">
                <label htmlFor="input-new-item-cost" className="form-label">
                  Initial Unit Cost (₹) *
                </label>
                <input
                  id="input-new-item-cost"
                  type="number"
                  min="0"
                  step="100"
                  className="form-input"
                  value={initialCost}
                  onChange={(e) => setInitialCost(Math.max(0, parseFloat(e.target.value) || 0))}
                  required
                />
                <span className="form-hint">Cost paid to supplier per unit</span>
              </div>
            </div>

            {/* Real-time Initial Stock Value Calculation */}
            <div className="preview-box">
              <span className="preview-label">Estimated Initial Value:</span>
              <span className="preview-value">{formatINR(estimatedInitialValue)}</span>
            </div>

            {/* Initial Note / Supplier */}
            <div className="form-group">
              <label htmlFor="input-new-item-note" className="form-label">
                Initial Supplier / Invoice Note (Optional)
              </label>
              <input
                id="input-new-item-note"
                type="text"
                className="form-input"
                placeholder="e.g. Consignment from Royal Woodworks (Inv #892)"
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
              />
              <span className="form-hint">
                This will be automatically recorded in the item's restock history audit log.
              </span>
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
              id="btn-submit-add-item"
            >
              {isSubmitting ? "Adding..." : "Add Furniture to Stock"}
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

        .preview-box {
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
        }

        .preview-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .preview-value {
          font-family: var(--font-heading);
          font-size: 1.15rem;
          font-weight: 700;
          color: #fbbf24;
        }
      `}</style>
    </div>
  );
}
