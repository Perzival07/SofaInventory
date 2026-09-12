"use client";

import { useState, type SubmitEvent } from "react";
import { X, Receipt, Plus, Trash2 } from "lucide-react";
import { Material } from "@/lib/erp-types";
import { Supplier } from "@/lib/purchase-types";
import { formatINR, getTodayDateString } from "@/lib/formatters";
import { createPurchaseOrderAction } from "@/app/purchase-actions";

interface CreatePoModalProps {
  isOpen: boolean;
  suppliers: Supplier[];
  materials: Material[];
  onClose: () => void;
  onCreated: () => void;
}

interface DraftLine {
  material_id: number;
  quantity: number;
  uom: string;
  rate: number;
  tax_rate: number;
  hsn_code: string;
}

const blankLine = (): DraftLine => ({
  material_id: 0, quantity: 1, uom: "NOS", rate: 0, tax_rate: 0, hsn_code: "",
});

export function CreatePoModal({
  isOpen, suppliers, materials, onClose, onCreated,
}: CreatePoModalProps) {
  const [supplierId, setSupplierId] = useState(0);
  const [orderDate, setOrderDate] = useState(getTodayDateString());
  const [expectedDate, setExpectedDate] = useState("");
  const [freight, setFreight] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setSupplierId(suppliers[0]?.id ?? 0);
      setOrderDate(getTodayDateString());
      setExpectedDate("");
      setFreight(0);
      setNotes("");
      setLines([blankLine()]);
      setError(null);
    }
  }

  if (!isOpen) return null;

  const update = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickMaterial = (i: number, materialId: number) => {
    const m = materials.find((x) => x.id === materialId);
    update(i, {
      material_id: materialId,
      uom: m?.purchase_uom ?? "NOS",
      rate: m?.standard_rate ?? 0,
      hsn_code: m?.hsn_code ?? "",
    });
  };

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const taxTotal = lines.reduce((s, l) => s + (l.quantity * l.rate * l.tax_rate) / 100, 0);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await createPurchaseOrderAction({
      supplier_id: supplierId,
      order_date: orderDate,
      expected_date: expectedDate || null,
      freight_amount: freight,
      notes: notes || null,
      lines: lines
        .filter((l) => l.material_id > 0 && l.quantity > 0)
        .map((l) => ({ ...l, hsn_code: l.hsn_code || null })),
    });

    setBusy(false);
    if (!res.success) {
      setError(res.error || "Failed to create purchase order");
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Receipt size={20} className="title-icon" />
            <span>New Purchase Order</span>
          </h2>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Supplier *</label>
                <select className="form-select" value={supplierId}
                  onChange={(e) => setSupplierId(Number(e.target.value))}>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order Date *</label>
                <input type="date" className="form-input" value={orderDate} required
                  onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Delivery</label>
                <input type="date" className="form-input" value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
            </div>

            <div className="lines-head">
              <h3 className="sec-title">Lines</h3>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => setLines((ls) => [...ls, blankLine()])}>
                <Plus size={14} /><span>Add Line</span>
              </button>
            </div>

            {lines.map((l, i) => {
              const m = materials.find((x) => x.id === l.material_id);
              return (
                <div className="line-row" key={i}>
                  <select className="form-select" value={l.material_id}
                    onChange={(e) => pickMaterial(i, Number(e.target.value))} aria-label="Material">
                    <option value={0}>Select material...</option>
                    {materials.map((mm) => (
                      <option key={mm.id} value={mm.id}>{mm.code} — {mm.name}</option>
                    ))}
                  </select>
                  <input type="number" step="any" min="0.001" className="form-input"
                    value={l.quantity} aria-label="Quantity"
                    onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })} />
                  <input className="form-input readonly" value={m?.purchase_uom ?? l.uom}
                    readOnly aria-label="UOM" />
                  <input type="number" step="0.01" min="0" className="form-input"
                    value={l.rate} aria-label="Rate"
                    onChange={(e) => update(i, { rate: Number(e.target.value) || 0 })} />
                  <input type="number" step="0.01" min="0" className="form-input"
                    value={l.tax_rate} aria-label="Tax rate"
                    onChange={(e) => update(i, { tax_rate: Number(e.target.value) || 0 })} />
                  <button type="button" className="btn-row-icon btn-row-icon-danger"
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1} aria-label="Remove line">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            <div className="line-legend">
              <span>Material</span><span>Qty</span><span>UOM</span>
              <span>Rate (taxable)</span><span>Tax %</span><span />
            </div>

            <div className="bottom-grid">
              <div className="form-group">
                <label className="form-label">Freight (₹)</label>
                <input type="number" step="0.01" min="0" className="form-input" value={freight}
                  onChange={(e) => setFreight(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={notes}
                  onChange={(e) => setNotes(e.target.value)} placeholder="Festive season stock" />
              </div>
            </div>

            <div className="totals">
              <div><span>Taxable</span><span>{formatINR(subtotal)}</span></div>
              <div><span>Tax</span><span>{formatINR(taxTotal)}</span></div>
              <div><span>Freight</span><span>{formatINR(freight)}</span></div>
              <div className="grand"><span>Order value</span><span>{formatINR(subtotal + taxTotal + freight)}</span></div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-save-po">
              {busy ? "Creating..." : "Create Purchase Order"}
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
          border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1rem;
        }

        .grid-3 { display: grid; grid-template-columns: 1fr; gap: 0.85rem; }
        @media (min-width: 640px) { .grid-3 { grid-template-columns: repeat(3, 1fr); } }

        .lines-head {
          display: flex; align-items: center; justify-content: space-between;
          margin: 1.35rem 0 0.75rem;
        }
        .sec-title { font-size: 0.95rem; }

        .line-row {
          display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin-bottom: 0.75rem;
          padding-bottom: 0.75rem; border-bottom: 1px dashed var(--border-subtle);
        }
        @media (min-width: 760px) {
          .line-row {
            grid-template-columns: 1fr 90px 80px 110px 80px 36px;
            align-items: center; border-bottom: none; padding-bottom: 0;
          }
        }
        .readonly { background: var(--bg-surface-elevated); color: var(--text-secondary); }

        .line-legend { display: none; }
        @media (min-width: 760px) {
          .line-legend {
            display: grid; grid-template-columns: 1fr 90px 80px 110px 80px 36px; gap: 0.5rem;
            font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em;
            color: var(--text-muted); margin-top: 0.35rem;
          }
        }

        .bottom-grid {
          display: grid; grid-template-columns: 1fr; gap: 0.85rem; margin-top: 1.25rem;
        }
        @media (min-width: 560px) { .bottom-grid { grid-template-columns: 200px 1fr; } }

        .totals {
          margin-top: 1.15rem; background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem 1.1rem;
        }
        .totals > div {
          display: flex; justify-content: space-between; font-size: 0.875rem;
          padding: 0.2rem 0; color: var(--text-secondary);
        }
        .totals .grand {
          border-top: 1px solid var(--border-hover); margin-top: 0.4rem; padding-top: 0.5rem;
          font-family: var(--font-heading); font-weight: 700; font-size: 1rem; color: var(--primary);
        }
      `}</style>
    </div>
  );
}
