"use client";

import { useState, type SubmitEvent } from "react";
import { X, Network, Plus, Trash2 } from "lucide-react";
import { Material, Product, BomInput, BomLineInput, BomStatus } from "@/lib/erp-types";
import { getTodayDateString } from "@/lib/formatters";

interface BomFormModalProps {
  isOpen: boolean;
  products: Product[];
  materials: Material[];
  onClose: () => void;
  onSubmit: (input: BomInput) => Promise<void>;
}

const blankLine = (): BomLineInput => ({
  line_type: "material",
  material_id: null,
  child_product_id: null,
  quantity: 1,
  uom: "NOS",
  wastage_pct: 0,
  notes: "",
});

export function BomFormModal({
  isOpen,
  products,
  materials,
  onClose,
  onSubmit,
}: BomFormModalProps) {
  const [productId, setProductId] = useState<number>(0);
  const [status, setStatus] = useState<BomStatus>("active");
  const [effectiveFrom, setEffectiveFrom] = useState(getTodayDateString());
  const [outputQty, setOutputQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BomLineInput[]>([blankLine()]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setProductId(products[0]?.id ?? 0);
      setStatus("active");
      setEffectiveFrom(getTodayDateString());
      setOutputQty(1);
      setNotes("");
      setLines([blankLine()]);
      setError(null);
    }
  }

  if (!isOpen) return null;

  const updateLine = (index: number, patch: Partial<BomLineInput>) =>
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const handleTargetChange = (index: number, value: string) => {
    const line = lines[index];
    const id = Number(value);
    if (line.line_type === "material") {
      const mat = materials.find((m) => m.id === id);
      updateLine(index, {
        material_id: id,
        child_product_id: null,
        uom: mat?.consumption_uom ?? "NOS",
      });
    } else {
      const prod = products.find((p) => p.id === id);
      updateLine(index, { child_product_id: id, material_id: null, uom: prod?.uom ?? "NOS" });
    }
  };

  const handleTypeChange = (index: number, type: "material" | "sub_assembly") =>
    updateLine(index, { line_type: type, material_id: null, child_product_id: null, uom: "NOS" });

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validLines = lines.filter(
      (l) => (l.line_type === "material" && l.material_id) || (l.line_type === "sub_assembly" && l.child_product_id)
    );
    if (!validLines.length) {
      setError("Add at least one component line with an item selected.");
      return;
    }
    if (validLines.some((l) => l.child_product_id === productId)) {
      setError("A BOM cannot contain the product it produces.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        product_id: productId,
        status,
        effective_from: effectiveFrom,
        output_quantity: outputQty,
        notes: notes || null,
        lines: validLines,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save BOM.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Network size={20} className="title-icon" />
            <span>New Bill of Materials</span>
          </h2>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-select" value={productId}
                  onChange={(e) => setProductId(Number(e.target.value))}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_type === "sub_assembly" ? "Sub-assembly" : "Finished"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Output Quantity *</label>
                <input type="number" min="0.001" step="any" className="form-input"
                  value={outputQty} onChange={(e) => setOutputQty(Number(e.target.value) || 1)} />
                <span className="form-hint">Quantities below produce this many units</span>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={status}
                  onChange={(e) => setStatus(e.target.value as BomStatus)}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
                <span className="form-hint">Activating supersedes the previous version</span>
              </div>
              <div className="form-group">
                <label className="form-label">Effective From *</label>
                <input type="date" className="form-input" value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)} required />
              </div>
            </div>

            <div className="lines-section">
              <div className="lines-head">
                <h3 className="form-section-title">Components</h3>
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => setLines((ls) => [...ls, blankLine()])}>
                  <Plus size={14} /><span>Add Line</span>
                </button>
              </div>

              {lines.map((line, i) => (
                <div className="line-row" key={i}>
                  <select className="form-select line-type" value={line.line_type}
                    onChange={(e) => handleTypeChange(i, e.target.value as "material" | "sub_assembly")}>
                    <option value="material">Material</option>
                    <option value="sub_assembly">Sub-assembly</option>
                  </select>

                  <select
                    className="form-select line-item"
                    value={(line.line_type === "material" ? line.material_id : line.child_product_id) ?? ""}
                    onChange={(e) => handleTargetChange(i, e.target.value)}
                  >
                    <option value="">Select {line.line_type === "material" ? "material" : "sub-assembly"}...</option>
                    {line.line_type === "material"
                      ? materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
                        ))
                      : products
                          .filter((p) => p.product_type === "sub_assembly" && p.id !== productId)
                          .map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>

                  <input type="number" min="0.0001" step="any" className="form-input line-qty"
                    value={line.quantity} aria-label="Quantity"
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })} />

                  <input className="form-input line-uom" value={line.uom} aria-label="UOM"
                    onChange={(e) => updateLine(i, { uom: e.target.value })} />

                  <div className="line-wastage">
                    <input type="number" min="0" step="0.1" className="form-input"
                      value={line.wastage_pct} aria-label="Wastage percent"
                      onChange={(e) => updateLine(i, { wastage_pct: Number(e.target.value) || 0 })} />
                    <span className="pct">%</span>
                  </div>

                  <button type="button" className="btn-row-icon btn-row-icon-danger"
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1} aria-label="Remove line">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              <div className="line-legend">
                <span>Type</span><span>Item</span><span>Qty</span><span>UOM</span><span>Wastage</span><span />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Standard navy velvet configuration" />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-save-bom">
              {isSubmitting ? "Saving..." : "Create BOM"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-dialog-wide { max-width: 860px; }
        .title-icon { color: var(--primary); }

        .btn-icon-close {
          width: 36px; height: 36px; border-radius: var(--radius-sm); background: transparent;
          border: none; color: var(--text-secondary); display: flex; align-items: center;
          justify-content: center; cursor: pointer;
        }
        .btn-icon-close:hover { background: var(--bg-surface-elevated); color: var(--text-primary); }

        .modal-alert-error {
          background: var(--status-out-stock-bg); border: 1px solid var(--status-out-stock-border);
          color: var(--status-out-stock-text); padding: 0.75rem 1rem;
          border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem;
        }

        .grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
        @media (min-width: 560px) { .grid-2 { grid-template-columns: 1fr 1fr; } }

        .lines-section {
          border-top: 1px solid var(--border-subtle);
          padding-top: 1.1rem; margin-top: 0.5rem; margin-bottom: 1.25rem;
        }
        .lines-head {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem;
        }
        .form-section-title { font-size: 0.925rem; }

        .line-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px dashed var(--border-subtle);
        }

        @media (min-width: 720px) {
          .line-row {
            grid-template-columns: 140px 1fr 92px 84px 104px 36px;
            align-items: center;
            border-bottom: none;
            padding-bottom: 0;
          }
        }

        .line-wastage { position: relative; display: flex; align-items: center; }
        .line-wastage .pct {
          position: absolute; right: 0.6rem; color: var(--text-muted); font-size: 0.8rem; pointer-events: none;
        }
        .line-wastage :global(.form-input) { padding-right: 1.7rem; }

        .line-legend { display: none; }
        @media (min-width: 720px) {
          .line-legend {
            display: grid;
            grid-template-columns: 140px 1fr 92px 84px 104px 36px;
            gap: 0.5rem;
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text-muted);
            margin-top: 0.35rem;
          }
        }
      `}</style>
    </div>
  );
}
