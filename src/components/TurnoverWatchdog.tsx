"use client";

import { useState } from "react";
import { Gauge, TrendingUp, Pencil, Check } from "lucide-react";
import { TurnoverStatus } from "@/lib/sales-types";
import { formatINR } from "@/lib/formatters";
import { setOtherPanTurnoverAction } from "@/app/sales-actions";

/**
 * The whole operating model depends on staying below the threshold, so this is
 * a first-class dashboard element rather than a report.
 */
export function TurnoverWatchdog({
  status, otherPanTurnover, registered, onChanged,
}: {
  status: TurnoverStatus;
  otherPanTurnover: number;
  registered: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(otherPanTurnover);
  const [busy, setBusy] = useState(false);

  const pct = Math.min(100, (status.aggregate_turnover / status.threshold) * 100);
  const projectedPct = Math.min(100, (status.projected_seasonal / status.threshold) * 100);

  const save = async () => {
    setBusy(true);
    await setOtherPanTurnoverAction(value);
    setBusy(false);
    setEditing(false);
    onChanged();
  };

  return (
    <section className={`watchdog band-${status.band} ${registered ? "informational" : ""}`}>
      <div className="wd-head">
        <div className="wd-icon"><Gauge size={20} /></div>
        <div className="wd-title-block">
          <h2 className="wd-title">
            Aggregate Turnover · FY {status.financial_year}
            {registered && <span className="info-chip">Informational</span>}
          </h2>
          <p className="wd-msg">{status.message}</p>
        </div>
        <div className="wd-figure">
          <span className="wd-amount">{formatINR(status.aggregate_turnover)}</span>
          <span className="wd-of">of {formatINR(status.threshold)}</span>
        </div>
      </div>

      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
        <div className="bar-projected" style={{ width: `${projectedPct}%` }} title="Seasonal projection" />
        <div className="bar-mark amber" style={{ left: "75%" }} />
        <div className="bar-mark red" style={{ left: "87.5%" }} />
        <div className="bar-mark blocking" style={{ left: "95%" }} />
      </div>

      <div className="wd-grid">
        <div>
          <span className="lbl">This shop</span>
          <span className="val">{formatINR(status.shop_turnover)}</span>
        </div>

        <div>
          <span className="lbl">Other businesses on same PAN</span>
          {editing ? (
            <span className="edit-row">
              <input type="number" min="0" step="any" className="form-input inline-input"
                value={value} id="other-pan-input"
                onChange={(e) => setValue(Number(e.target.value) || 0)} />
              <button className="btn btn-primary btn-sm" onClick={save} disabled={busy} id="btn-save-otherpan">
                <Check size={14} />
              </button>
            </span>
          ) : (
            <span className="val editable">
              {formatINR(status.other_pan_turnover)}
              <button className="edit-btn" onClick={() => { setValue(status.other_pan_turnover); setEditing(true); }}
                aria-label="Edit other-PAN turnover" id="btn-edit-otherpan">
                <Pencil size={12} />
              </button>
            </span>
          )}
        </div>

        <div>
          <span className="lbl">Headroom</span>
          <span className={`val ${status.headroom < 0 ? "over" : ""}`}>
            {formatINR(status.headroom)}
          </span>
        </div>

        <div>
          <span className="lbl"><TrendingUp size={11} /> Projected year end</span>
          <span className="val">
            {formatINR(status.projected_seasonal)}
            <span className="sub">seasonally adjusted</span>
          </span>
        </div>
      </div>

      <p className="pan-note">
        Aggregate turnover is computed PAN-wide across every business you own, not per shop.
        Keep the other-PAN figure current or this number understates your exposure.
      </p>

      <style jsx>{`
        .watchdog {
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;
          border: 1px solid var(--border-subtle); background: var(--bg-surface);
          box-shadow: var(--shadow-sm); border-left-width: 4px;
        }
        .band-safe { border-left-color: var(--status-in-stock-text); }
        .band-amber { border-left-color: #d97706; background: var(--status-low-stock-bg); }
        .band-red { border-left-color: var(--status-out-stock-text); background: var(--status-out-stock-bg); }
        .band-blocking {
          border-left-color: var(--status-out-stock-text);
          background: var(--status-out-stock-bg); border-color: var(--status-out-stock-border);
        }
        .informational { opacity: 0.85; }

        .wd-head { display: flex; align-items: flex-start; gap: 0.85rem; flex-wrap: wrap; }
        .wd-icon {
          width: 40px; height: 40px; border-radius: var(--radius-md);
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          display: flex; align-items: center; justify-content: center; color: var(--primary);
        }
        .wd-title-block { flex: 1; min-width: 220px; }
        .wd-title {
          font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
        }
        .info-chip {
          font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
          background: var(--bg-surface-elevated); color: var(--text-muted);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-full);
          padding: 0.1rem 0.4rem;
        }
        .wd-msg { font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.15rem; line-height: 1.45; }
        .wd-figure { display: flex; flex-direction: column; align-items: flex-end; }
        .wd-amount { font-family: var(--font-heading); font-size: 1.6rem; font-weight: 800; color: var(--text-primary); }
        .wd-of { font-size: 0.75rem; color: var(--text-muted); }

        .bar {
          position: relative; height: 10px; background: var(--bg-surface-elevated);
          border-radius: var(--radius-full); margin: 1rem 0 0.9rem; overflow: hidden;
        }
        .bar-fill {
          position: absolute; inset-block: 0; left: 0; background: var(--primary);
          border-radius: var(--radius-full); z-index: 2;
        }
        .bar-projected {
          position: absolute; inset-block: 0; left: 0;
          background: repeating-linear-gradient(90deg, rgba(180,83,9,0.25) 0 6px, transparent 6px 12px);
          border-radius: var(--radius-full); z-index: 1;
        }
        .bar-mark { position: absolute; top: 0; bottom: 0; width: 2px; z-index: 3; }
        .bar-mark.amber { background: #d97706; }
        .bar-mark.red { background: #dc2626; }
        .bar-mark.blocking { background: #7f1d1d; }

        .wd-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem;
        }
        @media (min-width: 720px) { .wd-grid { grid-template-columns: repeat(4, 1fr); } }
        .wd-grid > div { display: flex; flex-direction: column; gap: 0.15rem; }
        .lbl {
          font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--text-muted); font-weight: 600;
          display: inline-flex; align-items: center; gap: 0.25rem;
        }
        .val {
          font-family: var(--font-heading); font-weight: 700; font-size: 1rem;
          color: var(--text-primary); display: inline-flex; align-items: center; gap: 0.4rem;
        }
        .val.over { color: var(--status-out-stock-text); }
        .val .sub {
          display: block; font-family: var(--font-body); font-size: 0.68rem;
          font-weight: 400; color: var(--text-muted);
        }
        .editable { }
        .edit-btn {
          border: none; background: transparent; color: var(--text-muted);
          cursor: pointer; padding: 0.1rem; display: inline-flex;
        }
        .edit-btn:hover { color: var(--primary); }
        .edit-row { display: flex; gap: 0.35rem; align-items: center; }
        .inline-input { max-width: 130px; min-height: 34px; padding: 0.3rem 0.5rem; font-size: 0.85rem; }

        .pan-note {
          margin-top: 1rem; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;
        }
      `}</style>
    </section>
  );
}
