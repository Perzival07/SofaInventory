"use client";

import { useState, type SubmitEvent } from "react";
import { X, PackageCheck, AlertTriangle } from "lucide-react";
import { Material } from "@/lib/erp-types";
import { PurchaseOrder, PurchaseOrderLine, GrnLineInput, PostedGrn } from "@/lib/purchase-types";
import { RegimeState } from "@/lib/tax-types";
import { formatINR, getTodayDateString } from "@/lib/formatters";
import { receiveGrnAction } from "@/app/purchase-actions";

interface ReceiveGrnModalProps {
  isOpen: boolean;
  po: PurchaseOrder | null;
  poLines: PurchaseOrderLine[];
  materials: Material[];
  regime: RegimeState;
  onClose: () => void;
  onReceived: (posted: PostedGrn, grnNumber: string) => void;
}

export function ReceiveGrnModal({
  isOpen, po, poLines, materials, regime, onClose, onReceived,
}: ReceiveGrnModalProps) {
  const [receiptDate, setReceiptDate] = useState(getTodayDateString());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateString());
  const [freight, setFreight] = useState(0);
  const [rows, setRows] = useState<GrnLineInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen && po) {
      setReceiptDate(getTodayDateString());
      setInvoiceNo("");
      setInvoiceDate(getTodayDateString());
      setFreight(po.freight_amount ?? 0);
      setError(null);
      setRows(
        poLines.map((l) => {
          const pending = Math.max(0, Number(l.quantity) - Number(l.received_quantity));
          return {
            po_line_id: l.id,
            material_id: l.material_id,
            received_quantity: pending,
            accepted_quantity: pending,
            rejected_quantity: 0,
            rejection_reason: "",
            rate: Number(l.rate),
            tax_rate: Number(l.tax_rate),
            batch_no: "",
            dye_lot: "",
            location: "",
          };
        })
      );
    }
  }

  if (!isOpen || !po) return null;

  const update = (i: number, patch: Partial<GrnLineInput>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const materialOf = (id: number) => materials.find((m) => m.id === id);

  // Live preview of what will be booked, mirroring the server-side costing rules.
  const preview = rows.reduce(
    (acc, r) => {
      const taxable = r.accepted_quantity * r.rate;
      const tax = (taxable * r.tax_rate) / 100;
      acc.taxable += taxable;
      acc.tax += tax;
      return acc;
    },
    { taxable: 0, tax: 0 }
  );
  const inventoryValue =
    regime.cost_basis === "inclusive"
      ? preview.taxable + preview.tax + freight
      : preview.taxable + freight;
  const recoverable = regime.cost_basis === "net" ? preview.tax : 0;

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await receiveGrnAction({
      po_id: po.id,
      supplier_id: po.supplier_id,
      receipt_date: receiptDate,
      supplier_invoice_no: invoiceNo || null,
      supplier_invoice_date: invoiceDate || null,
      freight_amount: freight,
      lines: rows,
    });

    setBusy(false);
    if (!res.success || !res.posted) {
      setError(res.error || "Failed to record receipt");
      return;
    }
    onReceived(res.posted, res.grnNumber!);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              <PackageCheck size={20} className="title-icon" />
              <span>Receive Goods</span>
            </h2>
            <p className="modal-sub">{po.po_number} — {po.supplier_name}</p>
          </div>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            <div className={`basis-strip ${regime.cost_basis === "net" ? "basis-net" : "basis-incl"}`}>
              <strong>
                {regime.cost_basis === "inclusive"
                  ? "Unregistered — GST-inclusive costing"
                  : "Registered — net-of-tax costing"}
              </strong>
              <span>
                {regime.cost_basis === "inclusive"
                  ? "Supplier tax is unrecoverable and will be added into item cost."
                  : "Supplier tax will be posted to input credit, not into item cost."}
              </span>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Receipt Date *</label>
                <input type="date" className="form-input" value={receiptDate} required
                  onChange={(e) => setReceiptDate(e.target.value)} />
                <span className="form-hint">Determines the tax treatment</span>
              </div>
              <div className="form-group">
                <label className="form-label">Supplier Invoice No</label>
                <input className="form-input" value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)} placeholder="BTM/1142" />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input type="date" className="form-input" value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
            </div>

            <h3 className="sec-title">Lines</h3>
            {rows.map((r, i) => {
              const m = materialOf(r.material_id);
              const stockQty = r.accepted_quantity * (m?.purchase_to_stock_factor ?? 1);
              return (
                <div className="line-card" key={i}>
                  <div className="line-head">
                    <span className="line-name">{m?.name}</span>
                    <span className="line-code">{m?.code}</span>
                  </div>

                  <div className="line-grid">
                    <div className="form-group">
                      <label className="form-label">Received ({m?.purchase_uom})</label>
                      <input type="number" step="any" min="0" className="form-input"
                        value={r.received_quantity}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          update(i, { received_quantity: v, accepted_quantity: v - r.rejected_quantity });
                        }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Rejected</label>
                      <input type="number" step="any" min="0" className="form-input"
                        value={r.rejected_quantity}
                        onChange={(e) => {
                          const rej = Number(e.target.value) || 0;
                          update(i, { rejected_quantity: rej, accepted_quantity: r.received_quantity - rej });
                        }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Accepted</label>
                      <input type="number" className="form-input readonly" value={r.accepted_quantity} readOnly />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Rate (₹/{m?.purchase_uom})</label>
                      <input type="number" step="0.01" min="0" className="form-input" value={r.rate}
                        onChange={(e) => update(i, { rate: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tax %</label>
                      <input type="number" step="0.01" min="0" className="form-input" value={r.tax_rate}
                        onChange={(e) => update(i, { tax_rate: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Batch No *</label>
                      <input className="form-input" value={r.batch_no}
                        onChange={(e) => update(i, { batch_no: e.target.value })}
                        placeholder="TMB-2026-10" />
                    </div>
                    {m?.tracks_dye_lot && (
                      <div className="form-group">
                        <label className="form-label">Dye Lot</label>
                        <input className="form-input" value={r.dye_lot ?? ""}
                          onChange={(e) => update(i, { dye_lot: e.target.value })} />
                      </div>
                    )}
                    {m?.material_type === "timber" && (
                      <div className="form-group">
                        <label className="form-label">Moisture %</label>
                        <input type="number" step="0.1" className="form-input"
                          value={r.moisture_pct ?? ""}
                          onChange={(e) => update(i, {
                            moisture_pct: e.target.value ? Number(e.target.value) : null })} />
                      </div>
                    )}
                    {m?.shelf_life_days !== null && m?.shelf_life_days !== undefined && (
                      <div className="form-group">
                        <label className="form-label">Expiry</label>
                        <input type="date" className="form-input" value={r.expiry_date ?? ""}
                          onChange={(e) => update(i, { expiry_date: e.target.value || null })} />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Location</label>
                      <input className="form-input" value={r.location ?? ""}
                        onChange={(e) => update(i, { location: e.target.value })} placeholder="Yard A" />
                    </div>
                  </div>

                  {r.rejected_quantity > 0 && (
                    <div className="form-group reject-reason">
                      <label className="form-label">Rejection Reason *</label>
                      <input className="form-input" value={r.rejection_reason ?? ""}
                        onChange={(e) => update(i, { rejection_reason: e.target.value })}
                        placeholder="Excess moisture / wrong grade / damaged" />
                    </div>
                  )}

                  {r.accepted_quantity > 0 && m && (
                    <p className="conv-note">
                      {r.accepted_quantity} {m.purchase_uom} will stock as{" "}
                      <strong>{stockQty.toLocaleString("en-IN")} {m.stock_uom}</strong>
                      {m.purchase_to_stock_factor !== 1 && ` (× ${m.purchase_to_stock_factor})`}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="form-group freight-field">
              <label className="form-label">Freight / Transport (₹)</label>
              <input type="number" step="0.01" min="0" className="form-input" value={freight}
                onChange={(e) => setFreight(Number(e.target.value) || 0)} />
              <span className="form-hint">Apportioned across lines by value and landed into unit cost</span>
            </div>

            <div className="preview-box">
              <div className="prev-row"><span>Taxable value</span><span>{formatINR(preview.taxable)}</span></div>
              <div className="prev-row"><span>Tax</span><span>{formatINR(preview.tax)}</span></div>
              <div className="prev-row"><span>Freight</span><span>{formatINR(freight)}</span></div>
              {recoverable > 0 && (
                <div className="prev-row credit">
                  <span>Input credit (not in stock cost)</span>
                  <span>−{formatINR(recoverable)}</span>
                </div>
              )}
              <div className="prev-row total">
                <span>Value booked into stock</span>
                <span>{formatINR(inventoryValue)}</span>
              </div>
              <div className="prev-row payable">
                <span>Payable to supplier</span>
                <span>{formatINR(preview.taxable + preview.tax + freight)}</span>
              </div>
            </div>

            {regime.cost_basis === "inclusive" && preview.tax > 0 && (
              <div className="info-strip">
                <AlertTriangle size={15} />
                <span>
                  {formatINR(preview.tax)} of tax is being absorbed into stock cost. Once registered,
                  this becomes recoverable — the amount is recorded either way for the transitional claim.
                </span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-post-grn">
              {busy ? "Posting..." : "Post Receipt"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-dialog-wide { max-width: 900px; }
        .title-icon { color: var(--primary); }
        .modal-sub { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem; }

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

        .basis-strip {
          display: flex; flex-direction: column; gap: 0.15rem; padding: 0.7rem 0.95rem;
          border-radius: var(--radius-md); font-size: 0.82rem; margin-bottom: 1.15rem;
        }
        .basis-incl {
          background: var(--primary-soft); border: 1px solid var(--primary-soft-border); color: var(--primary);
        }
        .basis-net {
          background: var(--status-in-stock-bg); border: 1px solid var(--status-in-stock-border);
          color: var(--status-in-stock-text);
        }

        .grid-3 { display: grid; grid-template-columns: 1fr; gap: 0.85rem; }
        @media (min-width: 640px) { .grid-3 { grid-template-columns: repeat(3, 1fr); } }

        .sec-title { font-size: 0.95rem; margin: 1.35rem 0 0.75rem; }

        .line-card {
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.9rem; margin-bottom: 0.85rem; background: var(--bg-surface-elevated);
        }
        .line-head { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .line-name { font-weight: 600; color: var(--text-primary); }
        .line-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.72rem; color: var(--text-muted);
        }

        .line-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.65rem; }
        @media (min-width: 720px) { .line-grid { grid-template-columns: repeat(4, 1fr); } }

        .readonly { background: var(--bg-surface-hover); color: var(--text-secondary); }
        .reject-reason { margin-top: 0.65rem; }

        .conv-note {
          margin-top: 0.6rem; font-size: 0.78rem; color: var(--text-secondary);
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm); padding: 0.35rem 0.6rem; display: inline-block;
        }

        .freight-field { margin-top: 1rem; max-width: 320px; }

        .preview-box {
          margin-top: 1.15rem; background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.9rem 1.1rem;
        }
        .prev-row {
          display: flex; justify-content: space-between; font-size: 0.875rem;
          padding: 0.22rem 0; color: var(--text-secondary);
        }
        .prev-row.credit { color: var(--status-in-stock-text); }
        .prev-row.total {
          border-top: 1px solid var(--border-hover); margin-top: 0.4rem; padding-top: 0.55rem;
          font-family: var(--font-heading); font-weight: 700; font-size: 1rem; color: var(--primary);
        }
        .prev-row.payable { font-weight: 600; color: var(--text-primary); }

        .info-strip {
          display: flex; gap: 0.55rem; align-items: flex-start; margin-top: 0.9rem;
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text); border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem; font-size: 0.8rem; line-height: 1.45;
        }
      `}</style>
    </div>
  );
}
