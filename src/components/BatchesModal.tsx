"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { X, Layers, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { Material, MaterialBatch, BatchInput } from "@/lib/erp-types";
import { formatINR, formatDate, getTodayDateString } from "@/lib/formatters";
import { fetchMaterialBatchesAction, addBatchAction } from "@/app/erp-actions";

interface BatchesModalProps {
  material: Material | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const blankBatch = (): BatchInput => ({
  batch_no: "",
  dye_lot: "",
  quantity: 0,
  rate: 0,
  received_date: getTodayDateString(),
  expiry_date: null,
  moisture_pct: null,
  seasoning_date: null,
  kiln_batch: null,
  location: "",
  notes: "",
});

export function BatchesModal({ material, isOpen, onClose, onChanged }: BatchesModalProps) {
  const [batches, setBatches] = useState<MaterialBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BatchInput>(blankBatch());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && material) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state for an async fetch triggered by this effect
      setIsLoading(true);
      setShowForm(false);
      setForm(blankBatch());
      fetchMaterialBatchesAction(material.id)
        .then((res) => setBatches(res.batches))
        .catch(() => setError("Failed to load batches"))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, material]);

  if (!isOpen || !material) return null;

  const isTimber = material.material_type === "timber";
  const hasExpiry = material.shelf_life_days !== null;
  const dyeLots = new Set(batches.filter((b) => b.dye_lot).map((b) => b.dye_lot));
  const totalQty = batches.reduce((s, b) => s + Number(b.quantity), 0);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    const res = await addBatchAction(material.id, form);
    setIsSaving(false);

    if (!res.success) {
      setError(res.error || "Failed to add batch");
      return;
    }
    const refreshed = await fetchMaterialBatchesAction(material.id);
    setBatches(refreshed.batches);
    setForm(blankBatch());
    setShowForm(false);
    onChanged();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              <Layers size={20} className="title-icon" />
              <span>Batches &amp; Lots</span>
            </h2>
            <p className="modal-sub">{material.code} — {material.name}</p>
          </div>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="modal-alert-error">{error}</div>}

          <div className="batch-summary">
            <div>
              <span className="sum-label">Total in stock</span>
              <span className="sum-value">
                {totalQty.toLocaleString("en-IN")} {material.stock_uom}
              </span>
            </div>
            <div>
              <span className="sum-label">Batches</span>
              <span className="sum-value">{batches.length}</span>
            </div>
            {material.tracks_dye_lot && (
              <div>
                <span className="sum-label">Distinct dye lots</span>
                <span className="sum-value">{dyeLots.size}</span>
              </div>
            )}
          </div>

          {material.tracks_dye_lot && dyeLots.size > 1 && (
            <div className="lot-warning">
              <AlertTriangle size={16} />
              <span>
                Stock spans {dyeLots.size} dye lots. Reserve a single lot per order — mixing lots
                causes visible shade mismatch across a sofa set.
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="loading-block">
              <Loader2 size={26} className="spin" />
              <p>Loading batches...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="empty-block">No batches recorded yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="batch-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    {material.tracks_dye_lot && <th>Dye Lot</th>}
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Received</th>
                    {hasExpiry && <th>Expiry</th>}
                    {isTimber && <th>Moisture</th>}
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const expired = b.expiry_date && new Date(b.expiry_date) < new Date();
                    return (
                      <tr key={b.id}>
                        <td className="mono">{b.batch_no}</td>
                        {material.tracks_dye_lot && (
                          <td>{b.dye_lot ? <span className="lot-chip">{b.dye_lot}</span> : "—"}</td>
                        )}
                        <td className="num">
                          {Number(b.quantity).toLocaleString("en-IN")} {material.stock_uom}
                        </td>
                        <td className="num">{formatINR(Number(b.rate))}</td>
                        <td>{formatDate(b.received_date)}</td>
                        {hasExpiry && (
                          <td className={expired ? "expired" : ""}>
                            {b.expiry_date ? formatDate(b.expiry_date) : "—"}
                          </td>
                        )}
                        {isTimber && <td>{b.moisture_pct !== null ? `${b.moisture_pct}%` : "—"}</td>}
                        <td>{b.location || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!showForm ? (
            <button type="button" className="btn btn-secondary add-batch-btn" onClick={() => setShowForm(true)}>
              <Plus size={16} />
              <span>Add Batch</span>
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="batch-form">
              <h3 className="form-section-title">New Batch</h3>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Batch No *</label>
                  <input className="form-input" value={form.batch_no} required
                    onChange={(e) => setForm({ ...form, batch_no: e.target.value })} />
                </div>
                {material.tracks_dye_lot && (
                  <div className="form-group">
                    <label className="form-label">Dye Lot</label>
                    <input className="form-input" value={form.dye_lot ?? ""}
                      onChange={(e) => setForm({ ...form, dye_lot: e.target.value })} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Quantity ({material.stock_uom}) *</label>
                  <input type="number" step="any" min="0.001" className="form-input" required
                    value={form.quantity || ""}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate (₹ per {material.stock_uom})</label>
                  <input type="number" step="0.01" min="0" className="form-input"
                    value={form.rate || ""}
                    onChange={(e) => setForm({ ...form, rate: Number(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Received Date *</label>
                  <input type="date" className="form-input" required value={form.received_date}
                    onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
                </div>
                {hasExpiry && (
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input type="date" className="form-input" value={form.expiry_date ?? ""}
                      onChange={(e) => setForm({ ...form, expiry_date: e.target.value || null })} />
                  </div>
                )}
                {isTimber && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Moisture %</label>
                      <input type="number" step="0.1" className="form-input"
                        value={form.moisture_pct ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, moisture_pct: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kiln Batch</label>
                      <input className="form-input" value={form.kiln_batch ?? ""}
                        onChange={(e) => setForm({ ...form, kiln_batch: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={form.location ?? ""}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Yard A / Rack B2" />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving} id="btn-save-batch">
                  {isSaving ? "Saving..." : "Add Batch"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      <style jsx>{`
        .modal-dialog-wide { max-width: 780px; }
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
          color: var(--status-out-stock-text); padding: 0.75rem 1rem; border-radius: var(--radius-md);
          font-size: 0.875rem; margin-bottom: 1rem;
        }

        .batch-summary {
          display: flex; flex-wrap: wrap; gap: 1.5rem;
          background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1rem;
        }
        .batch-summary > div { display: flex; flex-direction: column; }
        .sum-label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); }
        .sum-value { font-family: var(--font-heading); font-weight: 700; color: var(--text-primary); }

        .lot-warning {
          display: flex; gap: 0.6rem; align-items: flex-start;
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text); border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem; font-size: 0.825rem; line-height: 1.45; margin-bottom: 1rem;
        }

        .table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
        .batch-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .batch-table thead { background: var(--bg-surface-elevated); }
        .batch-table th {
          text-align: left; padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase;
          letter-spacing: 0.03em; color: var(--text-secondary); white-space: nowrap;
        }
        .batch-table td { padding: 0.6rem 0.75rem; border-top: 1px solid var(--border-subtle); white-space: nowrap; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; }
        .num { font-weight: 600; }
        .expired { color: var(--status-out-stock-text); font-weight: 600; }

        .lot-chip {
          background: var(--accent-blue-soft); color: var(--accent-blue);
          border: 1px solid #bae6fd; border-radius: var(--radius-full);
          padding: 0.1rem 0.5rem; font-size: 0.75rem; font-weight: 600;
        }

        .loading-block, .empty-block {
          padding: 2rem; text-align: center; color: var(--text-secondary);
          border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);
        }
        .loading-block { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
        .spin { animation: spin 1s linear infinite; color: var(--primary); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .add-batch-btn { margin-top: 1rem; }

        .batch-form {
          margin-top: 1.25rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;
        }
        .form-section-title { font-size: 0.925rem; margin-bottom: 0.85rem; }
        .grid-2 { display: grid; grid-template-columns: 1fr; gap: 0.85rem; }
        @media (min-width: 560px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
        .form-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
}
