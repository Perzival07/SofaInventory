"use client";

import React, { useState } from "react";
import { Factory, CheckCircle, AlertTriangle, Hammer, Plus, Clock } from "lucide-react";
import { WorkOrder, StageProductionLog, KarigarMaster, ProductionStage, LanguageCode } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/formatters";
import { logStageProductionAction } from "@/app/actions";

interface ProductionStageTrackerProps {
  workOrders: WorkOrder[];
  karigars: KarigarMaster[];
  stageLogs: StageProductionLog[];
  lang: LanguageCode;
  onRefresh: () => void;
}

const STAGES: { key: ProductionStage; label: string; bengali: string }[] = [
  { key: "CUTTING", label: "1. Cutting", bengali: "১. কাটিং" },
  { key: "FRAME_ASSEMBLY", label: "2. Frame Assembly", bengali: "২. কাঠের খাঁচা তৈরি" },
  { key: "SANDING", label: "3. Sanding", bengali: "৩. সিরিশ পালিশ" },
  { key: "FOAMING", label: "4. Foaming", bengali: "৪. ফোম ফিটিং" },
  { key: "UPHOLSTERY", label: "5. Upholstery", bengali: "৫. কুশন ও কাপড়" },
  { key: "POLISHING", label: "6. Polishing", bengali: "৬. বার্নিশ" },
  { key: "HARDWARE_FITTING", label: "7. Fitting", bengali: "৭. কব্জা/হ্যান্ডেল" },
  { key: "QC_INSPECTION", label: "8. QC", bengali: "৮. QC পরীক্ষা" },
  { key: "PACKING", label: "9. Packing", bengali: "৯. প্যাকিং" },
];

export function ProductionStageTracker({
  workOrders,
  karigars,
  stageLogs,
  lang,
  onRefresh,
}: ProductionStageTrackerProps) {
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedWo, setSelectedWo] = useState<number>(workOrders[0]?.id || 1);
  const [stage, setStage] = useState<ProductionStage>("FRAME_ASSEMBLY");
  const [selectedKarigar, setSelectedKarigar] = useState<number>(karigars[0]?.id || 1);
  const [attempted, setAttempted] = useState(5);
  const [passed, setPassed] = useState(5);
  const [rework, setRework] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [reworkReason, setReworkReason] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await logStageProductionAction({
      work_order_id: selectedWo,
      stage,
      karigar_id: selectedKarigar,
      units_attempted: attempted,
      units_passed: passed,
      units_rework: rework,
      units_rejected: rejected,
      rework_reason: rework > 0 ? reworkReason : undefined,
      rejection_reason: rejected > 0 ? rejectionReason : undefined,
    });
    setIsLogOpen(false);
    onRefresh();
  };

  return (
    <div className="production-tracker-root">
      <div className="tracker-top-bar">
        <div>
          <h3 className="section-title">Factory Floor WIP & Stage-wise Progress</h3>
          <p className="section-sub">
            Track units at every manufacturing stage with piece-rate wage calculation and QC checks
          </p>
        </div>
        <button
          onClick={() => setIsLogOpen(true)}
          className="btn btn-primary btn-sm"
          id="btn-log-stage-work"
        >
          <Plus size={16} />
          <span>Log Daily Shift Output</span>
        </button>
      </div>

      {/* Stage Flow Visualization */}
      <div className="stages-flow-wrapper">
        <div className="stages-flow">
          {STAGES.map((st, idx) => {
            // Count active units at this stage across all active work orders
            const unitsHere = workOrders
              .filter((wo) => wo.current_stage === st.key && wo.status !== "COMPLETED")
              .reduce((sum, wo) => sum + wo.quantity, 0);

            return (
              <div
                key={st.key}
                className={`stage-step-card ${unitsHere > 0 ? "step-active" : ""}`}
              >
                <div className="step-num">{idx + 1}</div>
                <div className="step-content">
                  <span className="step-name">{lang === "bn" ? st.bengali : st.label}</span>
                  <span className="step-units">
                    <strong>{unitsHere}</strong> units in WIP
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-Column Work Orders & Recent Stage Output Logs */}
      <div className="prod-grid-2col">
        {/* Active Work Orders */}
        <div className="prod-panel">
          <h4 className="panel-title">Active Work Orders ({workOrders.length})</h4>
          <div className="orders-list">
            {workOrders.map((wo) => (
              <div key={wo.id} className="wo-card">
                <div className="wo-header">
                  <span className="wo-number">{wo.wo_number}</span>
                  <span className="badge badge-category">{wo.status}</span>
                </div>
                <h5 className="wo-product">{wo.product_name}</h5>
                <div className="wo-meta-row">
                  <span>Batch: <strong>{wo.quantity} units</strong></span>
                  <span>Target: {formatDate(wo.target_completion_date)}</span>
                </div>
                <div className="wo-stage-pill">
                  <span>Current Stage:</span>
                  <span className="stage-badge">{wo.current_stage}</span>
                </div>
                <div className="wo-cost-row">
                  <span>Material: {formatINR(wo.actual_material_cost)}</span>
                  <span>Labour Paid: {formatINR(wo.actual_labour_cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Karigar Piece-Rate Wage & Shift Logs */}
        <div className="prod-panel">
          <h4 className="panel-title">Recent Stage Shift & QC Logs ({stageLogs.length})</h4>
          <div className="logs-list">
            {stageLogs.slice(0, 8).map((lg) => (
              <div key={lg.id} className="stage-log-card">
                <div className="log-top">
                  <div className="log-karigar">
                    <Hammer size={14} className="icon-hammer" />
                    <strong>{lg.karigar_name}</strong>
                  </div>
                  <span className="log-wage-badge">
                    +{formatINR(lg.piece_rate_earned)} Piece-rate
                  </span>
                </div>

                <div className="log-details">
                  <span>Stage: <strong>{lg.stage}</strong></span>
                  <span>Date: {formatDate(lg.date)} ({lg.shift})</span>
                </div>

                <div className="qc-pill-row">
                  <span className="qc-badge qc-pass">Passed: {lg.units_passed}</span>
                  {lg.units_rework > 0 && (
                    <span className="qc-badge qc-rework">Rework: {lg.units_rework} ({lg.rework_reason})</span>
                  )}
                  {lg.units_rejected > 0 && (
                    <span className="qc-badge qc-reject">Rejected: {lg.units_rejected} ({lg.rejection_reason})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Shift Logging Modal */}
      {isLogOpen && (
        <div className="modal-overlay" onClick={() => setIsLogOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Log Daily Stage Output & Karigar Wages</h3>
              <button onClick={() => setIsLogOpen(false)} className="btn-icon-close">
                ×
              </button>
            </div>
            <form onSubmit={handleLogSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Work Order *</label>
                  <select
                    className="form-select"
                    value={selectedWo}
                    onChange={(e) => setSelectedWo(parseInt(e.target.value))}
                  >
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.wo_number} — {wo.product_name} ({wo.quantity} units)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Production Stage *</label>
                    <select
                      className="form-select"
                      value={stage}
                      onChange={(e) => setStage(e.target.value as any)}
                    >
                      {STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Karigar / Lead Artisan *</label>
                    <select
                      className="form-select"
                      value={selectedKarigar}
                      onChange={(e) => setSelectedKarigar(parseInt(e.target.value))}
                    >
                      {karigars.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ({formatINR(k.default_piece_rate)}/unit)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* QC Numbers */}
                <div className="qc-input-grid">
                  <div className="form-group">
                    <label className="form-label">Units Attempted</label>
                    <input
                      type="number"
                      className="form-input"
                      value={attempted}
                      onChange={(e) => setAttempted(Math.max(1, parseInt(e.target.value) || 0))}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">QC Passed</label>
                    <input
                      type="number"
                      className="form-input"
                      value={passed}
                      onChange={(e) => setPassed(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">QC Rework</label>
                    <input
                      type="number"
                      className="form-input"
                      value={rework}
                      onChange={(e) => setRework(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">QC Rejected</label>
                    <input
                      type="number"
                      className="form-input"
                      value={rejected}
                      onChange={(e) => setRejected(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                </div>

                {rework > 0 && (
                  <div className="form-group">
                    <label className="form-label">Rework Reason Code</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Joint gap, slight fabric wrinkle"
                      value={reworkReason}
                      onChange={(e) => setReworkReason(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsLogOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Shift Log & Post Wages
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .production-tracker-root {
          margin-top: 1rem;
        }

        .tracker-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .section-title {
          font-size: 1.2rem;
          margin: 0;
        }

        .section-sub {
          font-size: 0.825rem;
          color: var(--text-secondary);
          margin-top: 0.2rem;
        }

        .stages-flow-wrapper {
          overflow-x: auto;
          padding-bottom: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .stages-flow {
          display: flex;
          gap: 0.65rem;
          min-width: 980px;
        }

        .stage-step-card {
          flex: 1;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .step-active {
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(56, 189, 248, 0.05);
        }

        .step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8rem;
          flex-shrink: 0;
        }

        .step-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .step-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .step-units {
          font-size: 0.7rem;
          color: var(--text-secondary);
        }

        .prod-grid-2col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
        }

        @media (min-width: 840px) {
          .prod-grid-2col {
            grid-template-columns: 1fr 1fr;
          }
        }

        .prod-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }

        .panel-title {
          font-size: 1rem;
          margin-bottom: 1rem;
        }

        .orders-list,
        .logs-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .wo-card {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .wo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .wo-number {
          font-size: 0.8rem;
          font-family: monospace;
          color: var(--primary);
        }

        .wo-product {
          font-size: 0.95rem;
          margin: 0;
        }

        .wo-meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.775rem;
          color: var(--text-secondary);
        }

        .wo-stage-pill {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.2rem;
        }

        .stage-badge {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-sm);
          font-weight: 700;
        }

        .wo-cost-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-muted);
          border-top: 1px solid var(--border-subtle);
          padding-top: 0.4rem;
          margin-top: 0.2rem;
        }

        .stage-log-card {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .log-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .log-karigar {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.85rem;
        }

        .icon-hammer {
          color: var(--primary);
        }

        .log-wage-badge {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          font-size: 0.725rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
        }

        .log-details {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .qc-pill-row {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
          margin-top: 0.2rem;
        }

        .qc-badge {
          font-size: 0.7rem;
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-sm);
          font-weight: 600;
        }

        .qc-pass {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
        }

        .qc-rework {
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
        }

        .qc-reject {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
        }

        .qc-input-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.65rem;
        }

        .form-row-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.85rem;
        }
      `}</style>
    </div>
  );
}
