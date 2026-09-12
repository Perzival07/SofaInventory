"use client";

import { useState, type SubmitEvent } from "react";
import { X, PackageOpen } from "lucide-react";
import { WorkOrder, MaterialRequirement } from "@/lib/production-types";
import { getTodayDateString } from "@/lib/formatters";
import { issueMaterialsAction } from "@/app/production-actions";

interface Props {
  isOpen: boolean;
  workOrder: WorkOrder | null;
  requirements: MaterialRequirement[];
  onClose: () => void;
  onIssued: (issueNumber: string, warnings: string[]) => void;
}

export function IssueMaterialModal({
  isOpen, workOrder, requirements, onClose, onIssued,
}: Props) {
  const [issueDate, setIssueDate] = useState(getTodayDateString());
  const [issuedTo, setIssuedTo] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setIssueDate(getTodayDateString());
      setIssuedTo("");
      setError(null);
      // Default to issuing the full requirement, capped at what is free.
      const defaults: Record<number, number> = {};
      for (const r of requirements) {
        defaults[r.material_id] = Math.min(r.required_qty, r.free);
      }
      setQuantities(defaults);
    }
  }

  if (!isOpen || !workOrder) return null;

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await issueMaterialsAction({
      work_order_id: workOrder.id,
      issue_date: issueDate,
      issued_to: issuedTo || null,
      lines: requirements.map((r) => ({
        material_id: r.material_id,
        quantity: quantities[r.material_id] ?? 0,
      })),
    });

    setBusy(false);
    if (!res.success) { setError(res.error || "Failed to issue"); return; }
    onIssued(res.issueNumber!, res.warnings ?? []);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              <PackageOpen size={20} className="title-icon" /><span>Issue Material to Floor</span>
            </h2>
            <p className="modal-sub">{workOrder.wo_number} — {workOrder.product_name}</p>
          </div>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            <p className="hint-line">
              Batches are picked oldest-first. Expired stock is skipped, and shade-critical
              material is taken from a single dye lot wherever one can cover the quantity.
            </p>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Issue Date *</label>
                <input type="date" className="form-input" value={issueDate} required
                  onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Issued To</label>
                <input className="form-input" value={issuedTo}
                  onChange={(e) => setIssuedTo(e.target.value)} placeholder="Karigar or section" />
              </div>
            </div>

            {requirements.length === 0 ? (
              <div className="empty">No material requirement on this work order.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Material</th><th className="right">Required</th>
                      <th className="right">Free</th><th className="right">Issue now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((r) => {
                      const value = quantities[r.material_id] ?? 0;
                      const exceedsFree = value > r.free;
                      return (
                        <tr key={r.material_id}>
                          <td>
                            <div className="stack">
                              <span className="strong">{r.material_name}</span>
                              <span className="mono">{r.material_code}</span>
                            </div>
                          </td>
                          <td className="right">{r.required_qty} {r.stock_uom}</td>
                          <td className="right">
                            <span className={r.free < r.required_qty ? "bad" : ""}>
                              {r.free} {r.stock_uom}
                            </span>
                          </td>
                          <td className="right">
                            {/* step="any": BOM-derived defaults carry 4 decimals
                                (3.7125 sheets), which a fixed step silently rejects. */}
                            <input type="number" min="0" step="any"
                              className={`form-input qty-input ${exceedsFree ? "over" : ""}`}
                              value={value}
                              aria-label={`Issue quantity for ${r.material_name}`}
                              onChange={(e) =>
                                setQuantities((q) => ({
                                  ...q, [r.material_id]: Number(e.target.value) || 0,
                                }))
                              } />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-post-issue">
              {busy ? "Issuing..." : "Post Issue Slip"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-dialog-wide { max-width: 720px; }
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
        .hint-line {
          font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.6rem 0.8rem; margin-bottom: 1rem; line-height: 1.45;
        }
        .grid-2 { display: grid; grid-template-columns: 1fr; gap: 0.9rem; margin-bottom: 1rem; }
        @media (min-width: 560px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
        .empty { padding: 1.5rem; text-align: center; color: var(--text-secondary); }

        .table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .data-table thead { background: var(--bg-surface-elevated); }
        .data-table th {
          text-align: left; padding: 0.6rem 0.8rem; font-size: 0.67rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap;
        }
        .data-table td { padding: 0.6rem 0.8rem; border-top: 1px solid var(--border-subtle); }
        .data-table .right { text-align: right; }
        .stack { display: flex; flex-direction: column; gap: 0.1rem; }
        .strong { font-weight: 600; color: var(--text-primary); }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem; color: var(--text-muted); }
        .bad { color: var(--status-out-stock-text); font-weight: 600; }
        .qty-input { max-width: 120px; text-align: right; min-height: 38px; padding: 0.4rem 0.6rem; }
        .qty-input.over { border-color: var(--status-out-stock-border); background: var(--status-out-stock-bg); }
      `}</style>
    </div>
  );
}
