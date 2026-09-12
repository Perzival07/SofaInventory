"use client";

import { useState, type SubmitEvent } from "react";
import { X, HardHat } from "lucide-react";
import { WorkOrder, Operation, Karigar, StageWip } from "@/lib/production-types";
import { formatINR, getTodayDateString } from "@/lib/formatters";
import { recordProductionAction } from "@/app/production-actions";

interface Props {
  isOpen: boolean;
  workOrder: WorkOrder | null;
  operations: Operation[];
  karigars: Karigar[];
  wip: StageWip[];
  onClose: () => void;
  onRecorded: () => void;
}

export function ProductionEntryModal({
  isOpen, workOrder, operations, karigars, wip, onClose, onRecorded,
}: Props) {
  const [operationId, setOperationId] = useState(0);
  const [karigarId, setKarigarId] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState(getTodayDateString());
  const [shift, setShift] = useState("day");
  const [completed, setCompleted] = useState(0);
  const [rework, setRework] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState<number | null>(8);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      // Default to the earliest stage that actually has work waiting.
      const nextStage = wip.find((w) => w.wip > 0);
      setOperationId(nextStage?.operation_id ?? operations[0]?.id ?? 0);
      setKarigarId(karigars[0]?.id ?? null);
      setEntryDate(getTodayDateString());
      setShift("day");
      setCompleted(0);
      setRework(0);
      setRejected(0);
      setReason("");
      setHours(8);
      setError(null);
    }
  }

  if (!isOpen || !workOrder) return null;

  const stage = wip.find((w) => w.operation_id === operationId);
  const operation = operations.find((o) => o.id === operationId);
  const karigar = karigars.find((k) => k.id === karigarId);
  const wage = completed * (operation?.piece_rate ?? 0);
  const booking = completed + rejected;
  const overBooking = stage ? booking > stage.wip : false;

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await recordProductionAction({
      work_order_id: workOrder.id,
      operation_id: operationId,
      karigar_id: karigarId,
      entry_date: entryDate,
      shift,
      completed_quantity: completed,
      rework_quantity: rework,
      rejected_quantity: rejected,
      rejection_reason: reason || null,
      hours_worked: hours,
    });

    setBusy(false);
    if (!res.success) { setError(res.error || "Failed"); return; }
    onRecorded();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              <HardHat size={20} className="title-icon" /><span>Record Production</span>
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

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Stage *</label>
                <select className="form-select" value={operationId} id="entry-operation"
                  onChange={(e) => setOperationId(Number(e.target.value))}>
                  {operations.map((o) => {
                    const w = wip.find((x) => x.operation_id === o.id);
                    return (
                      <option key={o.id} value={o.id}>
                        {o.sequence}. {o.name}{w ? ` — ${w.wip} waiting` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Karigar</label>
                <select className="form-select" value={karigarId ?? ""} id="entry-karigar"
                  onChange={(e) => setKarigarId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Unassigned</option>
                  {karigars.map((k) => (
                    <option key={k.id} value={k.id}>{k.name} ({k.skill})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={entryDate} required
                  onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Shift</label>
                <select className="form-select" value={shift} onChange={(e) => setShift(e.target.value)}>
                  <option value="day">Day</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
            </div>

            {stage && (
              <div className={`stage-info ${overBooking ? "over" : ""}`}>
                <strong>{stage.wip}</strong> unit(s) waiting at {stage.operation_name}
                {stage.available_to_work > 0 && (
                  <span> · {stage.completed} already completed of {stage.available_to_work} received</span>
                )}
              </div>
            )}

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Completed *</label>
                <input type="number" min="0" step="1" className="form-input" value={completed} id="entry-completed"
                  onChange={(e) => setCompleted(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Rework</label>
                <input type="number" min="0" step="1" className="form-input" value={rework}
                  onChange={(e) => setRework(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Rejected</label>
                <input type="number" min="0" step="1" className="form-input" value={rejected} id="entry-rejected"
                  onChange={(e) => setRejected(Number(e.target.value) || 0)} />
              </div>
            </div>

            {rejected > 0 && (
              <div className="form-group">
                <label className="form-label">Rejection Reason *</label>
                <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Select a reason...</option>
                  <option value="Joint gap">Joint gap</option>
                  <option value="Polish defect">Polish defect</option>
                  <option value="Fabric pucker">Fabric pucker</option>
                  <option value="Wrong hardware">Wrong hardware</option>
                  <option value="Dimension error">Dimension error</option>
                  <option value="Material defect">Material defect</option>
                </select>
              </div>
            )}

            <div className="form-group hours-field">
              <label className="form-label">Hours Worked</label>
              <input type="number" min="0" step="0.5" className="form-input" value={hours ?? ""}
                onChange={(e) => setHours(e.target.value ? Number(e.target.value) : null)} />
              <span className="form-hint">Used for efficiency, not for pay</span>
            </div>

            {overBooking && (
              <div className="warn-strip">
                Cannot book {booking} unit(s) — only {stage?.wip} are waiting at this stage.
                The previous stage has not produced them yet.
              </div>
            )}

            <div className="wage-box">
              <span>Piece-rate wage{karigar ? ` for ${karigar.name}` : ""}</span>
              <strong>{formatINR(wage)}</strong>
              <span className="wage-note">
                {completed} × {formatINR(operation?.piece_rate ?? 0)} — rejected units are not paid
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || overBooking} id="btn-save-entry">
              {busy ? "Saving..." : "Record Entry"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
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
        .grid-2 { display: grid; grid-template-columns: 1fr; gap: 0.9rem; }
        @media (min-width: 520px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }

        .stage-info {
          background: var(--accent-blue-soft); border: 1px solid #bae6fd; color: var(--accent-blue);
          border-radius: var(--radius-md); padding: 0.6rem 0.85rem;
          font-size: 0.82rem; margin: 0.35rem 0 1rem;
        }
        .stage-info.over {
          background: var(--status-out-stock-bg); border-color: var(--status-out-stock-border);
          color: var(--status-out-stock-text);
        }

        .warn-strip {
          background: var(--status-out-stock-bg); border: 1px solid var(--status-out-stock-border);
          color: var(--status-out-stock-text); border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem; font-size: 0.82rem; margin-top: 0.9rem; line-height: 1.45;
        }

        .hours-field { max-width: 200px; margin-top: 1rem; }

        .wage-box {
          margin-top: 1.15rem; display: flex; flex-direction: column; gap: 0.15rem;
          background: var(--primary-soft); border: 1px solid var(--primary-soft-border);
          color: var(--primary); border-radius: var(--radius-md); padding: 0.75rem 0.95rem;
          font-size: 0.85rem;
        }
        .wage-box strong { font-family: var(--font-heading); font-size: 1.25rem; }
        .wage-note { font-size: 0.75rem; opacity: 0.85; }
      `}</style>
    </div>
  );
}
