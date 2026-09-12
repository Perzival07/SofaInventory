"use client";

import { useState, type SubmitEvent } from "react";
import { X, Boxes, ArrowRight } from "lucide-react";
import {
  Material,
  MaterialCategory,
  MaterialInput,
  MaterialType,
  TYPE_ATTRIBUTES,
  Uom,
} from "@/lib/erp-types";

interface MaterialFormModalProps {
  isOpen: boolean;
  material: Material | null;
  categories: MaterialCategory[];
  uoms: Uom[];
  onClose: () => void;
  onSubmit: (input: MaterialInput, id?: number) => Promise<void>;
}

const blank = (categories: MaterialCategory[]): MaterialInput => ({
  code: "",
  name: "",
  category_id: categories[0]?.id ?? 0,
  material_type: (categories[0]?.material_type ?? "misc") as MaterialType,
  purchase_uom: "NOS",
  stock_uom: "NOS",
  consumption_uom: "NOS",
  purchase_to_stock_factor: 1,
  stock_to_consumption_factor: 1,
  tracks_batch: false,
  tracks_dye_lot: false,
  shelf_life_days: null,
  is_hazardous: false,
  reorder_level: 0,
  standard_rate: 0,
  hsn_code: "",
  attributes: {},
});

export function MaterialFormModal({
  isOpen,
  material,
  categories,
  uoms,
  onClose,
  onSubmit,
}: MaterialFormModalProps) {
  const [form, setForm] = useState<MaterialInput>(blank(categories));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // Reset at render time when the modal transitions from closed to open
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setError(null);
      setForm(
        material
          ? {
              code: material.code,
              name: material.name,
              category_id: material.category_id,
              material_type: material.material_type,
              purchase_uom: material.purchase_uom,
              stock_uom: material.stock_uom,
              consumption_uom: material.consumption_uom,
              purchase_to_stock_factor: material.purchase_to_stock_factor,
              stock_to_consumption_factor: material.stock_to_consumption_factor,
              tracks_batch: material.tracks_batch,
              tracks_dye_lot: material.tracks_dye_lot,
              shelf_life_days: material.shelf_life_days,
              is_hazardous: material.is_hazardous,
              reorder_level: material.reorder_level,
              standard_rate: material.standard_rate,
              hsn_code: material.hsn_code ?? "",
              attributes: { ...material.attributes },
            }
          : blank(categories)
      );
    }
  }

  if (!isOpen) return null;

  const set = <K extends keyof MaterialInput>(key: K, value: MaterialInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleCategoryChange = (categoryId: number) => {
    const cat = categories.find((c) => c.id === categoryId);
    setForm((f) => ({
      ...f,
      category_id: categoryId,
      material_type: (cat?.material_type ?? "misc") as MaterialType,
      attributes: {},
    }));
  };

  const attributeFields = TYPE_ATTRIBUTES[form.material_type] ?? [];

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(form, material?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save material.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Boxes size={20} className="title-icon" />
            <span>{material ? "Edit Material" : "New Raw Material"}</span>
          </h2>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="mat-code" className="form-label">Material Code *</label>
                <input
                  id="mat-code" className="form-input" value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  placeholder="TMB-SHS-01" required autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="mat-category" className="form-label">Category *</label>
                <select
                  id="mat-category" className="form-select" value={form.category_id}
                  onChange={(e) => handleCategoryChange(Number(e.target.value))}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="mat-name" className="form-label">Material Name *</label>
              <input
                id="mat-name" className="form-input" value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Sheesham Timber - Seasoned" required
              />
            </div>

            {/* Multi-UOM */}
            <div className="form-section">
              <h3 className="form-section-title">Units of Measure</h3>
              <p className="form-section-hint">
                Bought in one unit, stocked in another, issued to the floor in a third.
              </p>

              <div className="uom-grid">
                <div className="form-group">
                  <label className="form-label">Purchase UOM</label>
                  <select className="form-select" value={form.purchase_uom}
                    onChange={(e) => set("purchase_uom", e.target.value)}>
                    {uoms.map((u) => <option key={u.id} value={u.code}>{u.code}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">× Factor</label>
                  <input type="number" step="any" min="0.000001" className="form-input"
                    value={form.purchase_to_stock_factor}
                    onChange={(e) => set("purchase_to_stock_factor", Number(e.target.value) || 1)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock UOM</label>
                  <select className="form-select" value={form.stock_uom}
                    onChange={(e) => set("stock_uom", e.target.value)}>
                    {uoms.map((u) => <option key={u.id} value={u.code}>{u.code}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">× Factor</label>
                  <input type="number" step="any" min="0.000001" className="form-input"
                    value={form.stock_to_consumption_factor}
                    onChange={(e) => set("stock_to_consumption_factor", Number(e.target.value) || 1)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Consumption UOM</label>
                  <select className="form-select" value={form.consumption_uom}
                    onChange={(e) => set("consumption_uom", e.target.value)}>
                    {uoms.map((u) => <option key={u.id} value={u.code}>{u.code}</option>)}
                  </select>
                </div>
              </div>

              <div className="conversion-preview">
                <strong>1 {form.purchase_uom}</strong>
                <ArrowRight size={14} />
                <strong>{form.purchase_to_stock_factor} {form.stock_uom}</strong>
                <ArrowRight size={14} />
                <strong>
                  {(form.purchase_to_stock_factor * form.stock_to_consumption_factor).toLocaleString("en-IN")}{" "}
                  {form.consumption_uom}
                </strong>
              </div>
            </div>

            {/* Traceability */}
            <div className="form-section">
              <h3 className="form-section-title">Traceability &amp; Handling</h3>
              <div className="checkbox-grid">
                <label className="checkbox-row">
                  <input type="checkbox" checked={form.tracks_batch}
                    onChange={(e) => set("tracks_batch", e.target.checked)} />
                  <span>Track batches</span>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={form.tracks_dye_lot}
                    onChange={(e) => set("tracks_dye_lot", e.target.checked)} />
                  <span>Track dye lot (shade critical)</span>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={form.is_hazardous}
                    onChange={(e) => set("is_hazardous", e.target.checked)} />
                  <span>Hazardous material</span>
                </label>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label htmlFor="mat-shelf" className="form-label">Shelf Life (days)</label>
                  <input id="mat-shelf" type="number" min="0" className="form-input"
                    value={form.shelf_life_days ?? ""}
                    onChange={(e) => set("shelf_life_days", e.target.value ? Number(e.target.value) : null)}
                    placeholder="Blank = no expiry" />
                  <span className="form-hint">Drives FIFO enforcement for adhesives and polish</span>
                </div>
                <div className="form-group">
                  <label htmlFor="mat-hsn" className="form-label">HSN Code</label>
                  <input id="mat-hsn" className="form-input" value={form.hsn_code ?? ""}
                    onChange={(e) => set("hsn_code", e.target.value)} placeholder="4407" />
                </div>
              </div>
            </div>

            {/* Planning */}
            <div className="form-section">
              <h3 className="form-section-title">Planning &amp; Rate</h3>
              <div className="form-row-2col">
                <div className="form-group">
                  <label htmlFor="mat-reorder" className="form-label">
                    Reorder Level ({form.stock_uom})
                  </label>
                  <input id="mat-reorder" type="number" min="0" step="any" className="form-input"
                    value={form.reorder_level}
                    onChange={(e) => set("reorder_level", Number(e.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label htmlFor="mat-rate" className="form-label">
                    Standard Rate (₹ per {form.stock_uom})
                  </label>
                  <input id="mat-rate" type="number" min="0" step="0.01" className="form-input"
                    value={form.standard_rate}
                    onChange={(e) => set("standard_rate", Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            {/* Type-specific attributes */}
            {attributeFields.length > 0 && (
              <div className="form-section">
                <h3 className="form-section-title">Type-Specific Attributes</h3>
                <div className="form-row-2col">
                  {attributeFields.map((field) => (
                    <div className="form-group" key={field.key}>
                      <label htmlFor={`attr-${field.key}`} className="form-label">
                        {field.label}{field.unit ? ` (${field.unit})` : ""}
                      </label>
                      <input
                        id={`attr-${field.key}`}
                        type={field.type === "number" ? "number" : "text"}
                        step="any"
                        className="form-input"
                        placeholder={field.placeholder}
                        value={form.attributes[field.key] ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            attributes: {
                              ...f.attributes,
                              [field.key]:
                                field.type === "number" ? Number(e.target.value) : e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-save-material">
              {isSubmitting ? "Saving..." : material ? "Save Changes" : "Create Material"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-dialog-wide { max-width: 720px; }
        .title-icon { color: var(--primary); }

        .btn-icon-close {
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          background: transparent; border: none; color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .btn-icon-close:hover { background: var(--bg-surface-elevated); color: var(--text-primary); }

        .modal-alert-error {
          background: var(--status-out-stock-bg); border: 1px solid var(--status-out-stock-border);
          color: var(--status-out-stock-text); padding: 0.75rem 1rem;
          border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem;
        }

        .form-row-2col { display: grid; grid-template-columns: 1fr; gap: 1rem; }
        @media (min-width: 560px) { .form-row-2col { grid-template-columns: 1fr 1fr; } }

        .form-section {
          border-top: 1px solid var(--border-subtle);
          padding-top: 1.15rem;
          margin-top: 0.5rem;
        }

        .form-section-title {
          font-size: 0.925rem;
          margin-bottom: 0.2rem;
        }

        .form-section-hint {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 0.9rem;
        }

        .uom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        @media (min-width: 720px) {
          .uom-grid { grid-template-columns: repeat(5, 1fr); align-items: end; }
        }

        .conversion-preview {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          background: var(--primary-soft);
          border: 1px solid var(--primary-soft-border);
          color: var(--primary);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.9rem;
          font-size: 0.875rem;
        }

        .checkbox-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.1rem;
        }

        .checkbox-row {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .checkbox-row input { width: 16px; height: 16px; accent-color: var(--primary); }
      `}</style>
    </div>
  );
}
