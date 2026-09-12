"use client";

import { useState, type SubmitEvent } from "react";
import { X, Factory, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { Product } from "@/lib/erp-types";
import { MaterialRequirement } from "@/lib/production-types";
import { getTodayDateString } from "@/lib/formatters";
import { checkAvailabilityAction, createWorkOrderAction } from "@/app/production-actions";

interface Props {
  isOpen: boolean;
  products: Product[];
  onClose: () => void;
  onCreated: (woNumber: string, shortages: number) => void;
}

export function CreateWorkOrderModal({ isOpen, products, onClose, onCreated }: Props) {
  const [productId, setProductId] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [source, setSource] = useState<"sales_order" | "forecast">("forecast");
  const [orderDate, setOrderDate] = useState(getTodayDateString());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [requirements, setRequirements] = useState<MaterialRequirement[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      const finished = products.find((p) => p.product_type === "finished");
      setProductId(finished?.id ?? products[0]?.id ?? 0);
      setQuantity(1);
      setSource("forecast");
      setOrderDate(getTodayDateString());
      setDueDate("");
      setNotes("");
      setRequirements(null);
      setError(null);
    }
  }

  if (!isOpen) return null;

  const runCheck = async () => {
    setChecking(true);
    setRequirements(await checkAvailabilityAction(productId, quantity));
    setChecking(false);
  };

  const shortages = requirements?.filter((r) => r.shortfall > 0) ?? [];

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await createWorkOrderAction({
      product_id: productId,
      quantity,
      source,
      order_date: orderDate,
      due_date: dueDate || null,
      notes: notes || null,
    });

    setBusy(false);
    if (!res.success) { setError(res.error || "Failed"); return; }
    onCreated(res.woNumber!, res.shortages ?? 0);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Factory size={20} className="title-icon" /><span>New Work Order</span>
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
                <select className="form-select" value={productId} id="wo-product"
                  onChange={(e) => { setProductId(Number(e.target.value)); setRequirements(null); }}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_type === "sub_assembly" ? "Sub-assembly" : "Finished"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input type="number" min="1" step="1" className="form-input" value={quantity} id="wo-qty"
                  onChange={(e) => { setQuantity(Number(e.target.value) || 1); setRequirements(null); }} />
              </div>
              <div className="form-group">
                <label className="form-label">Raised Against</label>
                <select className="form-select" value={source}
                  onChange={(e) => setSource(e.target.value as "sales_order" | "forecast")}>
                  <option value="forecast">Forecast (made to stock)</option>
                  <option value="sales_order">Sales order (made to order)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Puja season batch" />
            </div>

            <div className="check-bar">
              <button type="button" className="btn btn-secondary btn-sm" onClick={runCheck}
                disabled={checking || !productId} id="btn-check-availability">
                {checking ? "Checking..." : "Check Material Availability"}
              </button>
              <span className="check-hint">
                Explodes the BOM and compares against free stock before committing
              </span>
            </div>

            {checking && (
              <div className="inline-loading"><Loader2 size={17} className="spin" /> Exploding BOM...</div>
            )}

            {requirements && requirements.length === 0 && (
              <div className="warn-strip">
                <AlertTriangle size={15} />
                <span>No active BOM for this product. The work order can still be raised, but no material will be reserved.</span>
              </div>
            )}

            {requirements && requirements.length > 0 && (
              <>
                {shortages.length > 0 ? (
                  <div className="warn-strip">
                    <AlertTriangle size={15} />
                    <span>
                      <strong>{shortages.length} material shortage(s).</strong> The order can still be
                      released — reservations are made for the full requirement and the shortfall is
                      listed below as an indent quantity.
                    </span>
                  </div>
                ) : (
                  <div className="ok-strip">
                    <CheckCircle2 size={15} />
                    <span>All material available. Releasing will reserve it against this order.</span>
                  </div>
                )}

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Material</th><th className="right">Required</th>
                        <th className="right">Free</th><th className="right">Shortfall / Indent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirements.map((r) => (
                        <tr key={r.material_id} className={r.shortfall > 0 ? "row-short" : ""}>
                          <td className="strong">{r.material_name}</td>
                          <td className="right">{r.required_qty} {r.stock_uom}</td>
                          <td className="right">{r.free} {r.stock_uom}</td>
                          <td className="right">
                            {r.shortfall > 0
                              ? <span className="bad">{r.shortfall_purchase_qty} {r.purchase_uom}</span>
                              : <span className="ok">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-create-wo">
              {busy ? "Creating..." : "Create & Reserve Material"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-dialog-wide { max-width: 780px; }
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
        .grid-2 { display: grid; grid-template-columns: 1fr; gap: 0.9rem; }
        @media (min-width: 560px) { .grid-2 { grid-template-columns: 1fr 1fr; } }

        .check-bar {
          display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
          padding-top: 0.5rem; margin-bottom: 1rem;
        }
        .check-hint { font-size: 0.78rem; color: var(--text-muted); }
        .inline-loading {
          display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary);
          font-size: 0.875rem; padding: 0.5rem 0;
        }
        .spin { animation: spin 1s linear infinite; color: var(--primary); }
        @keyframes spin { to { transform: rotate(360deg); } }

        .warn-strip, .ok-strip {
          display: flex; gap: 0.55rem; align-items: flex-start; border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem; font-size: 0.82rem; line-height: 1.5; margin-bottom: 0.9rem;
        }
        .warn-strip {
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text);
        }
        .ok-strip {
          background: var(--status-in-stock-bg); border: 1px solid var(--status-in-stock-border);
          color: var(--status-in-stock-text);
        }

        .table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .data-table thead { background: var(--bg-surface-elevated); }
        .data-table th {
          text-align: left; padding: 0.6rem 0.8rem; font-size: 0.67rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap;
        }
        .data-table td { padding: 0.6rem 0.8rem; border-top: 1px solid var(--border-subtle); white-space: nowrap; }
        .data-table .right { text-align: right; }
        .row-short { background: var(--status-out-stock-bg); }
        .strong { font-weight: 600; color: var(--text-primary); }
        .bad { color: var(--status-out-stock-text); font-weight: 600; }
        .ok { color: var(--text-muted); }
      `}</style>
    </div>
  );
}
