"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { CreateWorkOrderModal } from "@/components/CreateWorkOrderModal";
import { IssueMaterialModal } from "@/components/IssueMaterialModal";
import { ProductionEntryModal } from "@/components/ProductionEntryModal";
import {
  Loader2, CheckCircle2, AlertCircle, Factory, HardHat, AlertTriangle,
  PackageOpen, ClipboardList, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  WorkOrder, Operation, Karigar, KarigarWage, ProductionEntry,
} from "@/lib/production-types";
import { Product } from "@/lib/erp-types";
import { formatINR, formatDate } from "@/lib/formatters";
import {
  fetchProductionPageDataAction, fetchWorkOrderDetailAction, WorkOrderDetail,
} from "@/app/production-actions";

export default function ProductionPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [wages, setWages] = useState<KarigarWage[]>([]);
  const [recentEntries, setRecentEntries] = useState<ProductionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, WorkOrderDetail>>({});

  const [isWoOpen, setIsWoOpen] = useState(false);
  const [issueTarget, setIssueTarget] = useState<WorkOrder | null>(null);
  const [entryTarget, setEntryTarget] = useState<WorkOrder | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await fetchProductionPageDataAction();
      setWorkOrders(d.workOrders);
      setProducts(d.products);
      setOperations(d.operations);
      setKarigars(d.karigars);
      setWages(d.wages);
      setRecentEntries(d.recentEntries);
    } catch {
      showToast("Failed to load production data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server fetch for this page
    load();
  }, [load]);

  const loadDetail = useCallback(async (woId: number) => {
    const d = await fetchWorkOrderDetailAction(woId);
    setDetail((prev) => ({ ...prev, [woId]: d }));
  }, []);

  const toggle = async (wo: WorkOrder) => {
    if (expanded === wo.id) { setExpanded(null); return; }
    setExpanded(wo.id);
    if (!detail[wo.id]) await loadDetail(wo.id);
  };

  const refreshAll = async (woId?: number) => {
    await load();
    if (woId) await loadDetail(woId);
  };

  const activeWos = workOrders.filter(
    (w) => w.status === "released" || w.status === "in_progress"
  );
  const totalWages = wages.reduce((s, w) => s + w.piece_wage, 0);
  const stalledCount = Object.values(detail)
    .flatMap((d) => d.wip)
    .filter((w) => w.is_stalled).length;

  return (
    <AppShell
      title="Production"
      subtitle="Work orders, material issue, and stage-wise output"
      actionLabel="New Work Order"
      onAction={() => setIsWoOpen(true)}
    >
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-label">Active Work Orders</span>
          <span className="kpi-value">{activeWos.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Piece-Rate Wages Earned</span>
          <span className="kpi-value accent">{formatINR(totalWages)}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Stalled Stages</span>
          <span className={`kpi-value ${stalledCount > 0 ? "danger" : ""}`}>{stalledCount}</span>
        </div>
      </div>

      <section className="panel">
        <h2 className="panel-title"><Factory size={17} /> Work Orders</h2>
        {isLoading ? (
          <div className="state-block"><Loader2 size={28} className="spin" /><p>Loading...</p></div>
        ) : workOrders.length === 0 ? (
          <div className="state-block">
            <ClipboardList size={30} className="muted-icon" />
            <p>No work orders yet. Create one to explode the BOM and reserve material.</p>
          </div>
        ) : (
          <div className="wo-list">
            {workOrders.map((wo) => {
              const isOpen = expanded === wo.id;
              const d = detail[wo.id];
              return (
                <div className={`wo-card ${isOpen ? "open" : ""}`} key={wo.id}>
                  <button className="wo-head" onClick={() => toggle(wo)} id={`btn-expand-wo-${wo.id}`}>
                    {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                    <div className="wo-title">
                      <span className="wo-num">{wo.wo_number}</span>
                      <span className="wo-prod">{wo.product_name}</span>
                    </div>
                    <span className="wo-qty">{wo.quantity} units</span>
                    <span className={`chip chip-${wo.status}`}>{wo.status.replace("_", " ")}</span>
                    <span className="wo-meta hide-sm">Due {wo.due_date ? formatDate(wo.due_date) : "—"}</span>
                  </button>

                  {isOpen && (
                    <div className="wo-body">
                      <div className="wo-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => setIssueTarget(wo)}
                          id={`btn-issue-${wo.id}`}>
                          <PackageOpen size={14} /><span>Issue Material</span>
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEntryTarget(wo)}
                          id={`btn-entry-${wo.id}`}>
                          <HardHat size={14} /><span>Record Production</span>
                        </button>
                      </div>

                      {!d ? (
                        <div className="inline-loading"><Loader2 size={17} className="spin" /> Loading detail...</div>
                      ) : (
                        <>
                          {/* Material requirements */}
                          <h3 className="sub-head">Material Requirement vs Free Stock</h3>
                          <div className="table-wrap">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Material</th><th className="right">Required</th>
                                  <th className="right">On hand</th><th className="right">Reserved elsewhere</th>
                                  <th className="right">Free</th><th className="right">Shortfall</th>
                                </tr>
                              </thead>
                              <tbody>
                                {d.requirements.map((r) => (
                                  <tr key={r.material_id} className={r.shortfall > 0 ? "row-short" : ""}>
                                    <td>
                                      <div className="stack">
                                        <span className="strong">{r.material_name}</span>
                                        <span className="mono">{r.material_code}</span>
                                      </div>
                                    </td>
                                    <td className="right strong">{r.required_qty} {r.stock_uom}</td>
                                    <td className="right">{r.on_hand}</td>
                                    <td className="right">{r.reserved_elsewhere || "—"}</td>
                                    <td className="right">{r.free}</td>
                                    <td className="right">
                                      {r.shortfall > 0 ? (
                                        <span className="short">
                                          {r.shortfall} {r.stock_uom}
                                          <span className="indent-hint">
                                            indent {r.shortfall_purchase_qty} {r.purchase_uom}
                                          </span>
                                        </span>
                                      ) : <span className="ok">OK</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* WIP by stage */}
                          <h3 className="sub-head">WIP by Stage</h3>
                          <div className="stage-grid">
                            {d.wip.map((s) => (
                              <div className={`stage-card ${s.is_stalled ? "stalled" : ""} ${s.wip === 0 && s.completed > 0 ? "done" : ""}`}
                                key={s.operation_id}>
                                <div className="stage-top">
                                  <span className="stage-seq">{s.sequence}</span>
                                  <span className="stage-name">{s.operation_name}</span>
                                  {s.is_stalled && <AlertTriangle size={13} className="stall-icon" />}
                                </div>
                                <div className="stage-nums">
                                  <span className="stage-wip">{s.wip}</span>
                                  <span className="stage-lbl">waiting</span>
                                </div>
                                <div className="stage-foot">
                                  <span>{s.completed} done</span>
                                  {s.rejected > 0 && <span className="rej">{s.rejected} rej</span>}
                                  {s.days_since_last_entry !== null && (
                                    <span className={s.is_stalled ? "rej" : ""}>{s.days_since_last_entry}d</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Consumption variance */}
                          {d.issues.length > 0 && (
                            <>
                              <h3 className="sub-head">Actual vs Standard Consumption</h3>
                              <div className="table-wrap">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Material</th><th className="right">Standard</th>
                                      <th className="right">Issued</th><th className="right">Variance</th>
                                      <th className="right">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {d.variance.filter((v) => v.actual_qty > 0 || v.standard_qty > 0).map((v) => (
                                      <tr key={v.material_id}>
                                        <td className="strong">{v.material_name}</td>
                                        <td className="right">{v.standard_qty} {v.stock_uom}</td>
                                        <td className="right">{v.actual_qty} {v.stock_uom}</td>
                                        <td className="right">
                                          <span className={v.is_overconsumption ? "bad" : v.variance_qty < 0 ? "good" : ""}>
                                            {v.variance_qty > 0 ? "+" : ""}{v.variance_qty} ({v.variance_pct}%)
                                          </span>
                                        </td>
                                        <td className="right">
                                          <span className={v.is_overconsumption ? "bad" : "good"}>
                                            {v.variance_value > 0 ? "+" : ""}{formatINR(v.variance_value)}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Karigar wages */}
      <section className="panel">
        <h2 className="panel-title"><HardHat size={17} /> Karigar Output &amp; Piece-Rate Wages</h2>
        {wages.length === 0 ? (
          <div className="state-block"><p>No production recorded yet.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Karigar</th><th className="right">Completed</th><th className="right">Rejected</th>
                  <th className="right">Rejection %</th><th className="right">Hours</th>
                  <th className="right">Units/hr</th><th className="right">Wage earned</th>
                </tr>
              </thead>
              <tbody>
                {wages.map((w) => (
                  <tr key={w.karigar_id}>
                    <td className="strong">{w.karigar_name}</td>
                    <td className="right">{w.units_completed}</td>
                    <td className="right">{w.units_rejected || "—"}</td>
                    <td className="right">
                      <span className={w.rejection_rate > 10 ? "bad" : ""}>{w.rejection_rate}%</span>
                    </td>
                    <td className="right">{w.hours_worked || "—"}</td>
                    <td className="right">{w.output_per_hour ?? "—"}</td>
                    <td className="right accent strong">{formatINR(w.piece_wage)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="right strong">Total payable</td>
                  <td className="right total">{formatINR(totalWages)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Recent entries */}
      {recentEntries.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Recent Production Entries</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Work order</th><th>Stage</th><th>Karigar</th>
                  <th>Shift</th><th className="right">Done</th><th className="right">Rejected</th>
                  <th className="right">Wage</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.entry_date)}</td>
                    <td className="mono">{e.wo_number}</td>
                    <td>{e.operation_name}</td>
                    <td>{e.karigar_name ?? "—"}</td>
                    <td className="cap">{e.shift}</td>
                    <td className="right strong">{e.completed_quantity}</td>
                    <td className="right">
                      {e.rejected_quantity > 0
                        ? <span className="bad" title={e.rejection_reason ?? ""}>{e.rejected_quantity}</span>
                        : "—"}
                    </td>
                    <td className="right accent">{formatINR(e.piece_wage ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CreateWorkOrderModal
        isOpen={isWoOpen}
        products={products}
        onClose={() => setIsWoOpen(false)}
        onCreated={(woNumber, shortages) => {
          showToast(
            shortages > 0
              ? `${woNumber} created — ${shortages} material shortage(s) flagged.`
              : `${woNumber} created and material reserved.`,
            shortages > 0 ? "error" : "success"
          );
          load();
        }}
      />

      <IssueMaterialModal
        isOpen={Boolean(issueTarget)}
        workOrder={issueTarget}
        requirements={issueTarget ? detail[issueTarget.id]?.requirements ?? [] : []}
        onClose={() => setIssueTarget(null)}
        onIssued={(issueNumber, warnings) => {
          showToast(
            warnings.length
              ? `${issueNumber} posted — ${warnings[0]}`
              : `${issueNumber} posted.`,
            warnings.length ? "error" : "success"
          );
          refreshAll(issueTarget?.id);
        }}
      />

      <ProductionEntryModal
        isOpen={Boolean(entryTarget)}
        workOrder={entryTarget}
        operations={operations}
        karigars={karigars}
        wip={entryTarget ? detail[entryTarget.id]?.wip ?? [] : []}
        onClose={() => setEntryTarget(null)}
        onRecorded={() => {
          showToast("Production entry recorded.");
          refreshAll(entryTarget?.id);
        }}
      />

      {toast && (
        <div className={`toast-pill ${toast.type === "error" ? "toast-error" : "toast-success"}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        .kpi-row { display: grid; grid-template-columns: 1fr; gap: 0.85rem; margin-bottom: 1.5rem; }
        @media (min-width: 560px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }
        .kpi-card {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1rem 1.15rem;
          display: flex; flex-direction: column; gap: 0.25rem;
        }
        .kpi-label {
          font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--text-secondary); font-weight: 600;
        }
        .kpi-value { font-family: var(--font-heading); font-size: 1.45rem; font-weight: 700; }
        .kpi-value.accent { color: var(--primary); }
        .kpi-value.danger { color: var(--status-out-stock-text); }

        .panel {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .panel-title { font-size: 1.05rem; display: flex; align-items: center; gap: 0.45rem; margin-bottom: 1rem; }
        .sub-head { font-size: 0.9rem; margin: 1.25rem 0 0.65rem; }

        .state-block {
          padding: 2.5rem; text-align: center; color: var(--text-secondary);
          display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
        }
        .muted-icon { color: var(--text-muted); }
        .spin { animation: spin 1s linear infinite; color: var(--primary); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .inline-loading {
          display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 0;
          color: var(--text-secondary); font-size: 0.875rem;
        }

        .wo-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .wo-card {
          border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden;
        }
        .wo-card.open { border-color: var(--border-hover); }
        .wo-head {
          width: 100%; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
          padding: 0.9rem 1rem; background: transparent; border: none; cursor: pointer;
          text-align: left; color: var(--text-secondary);
        }
        .wo-head:hover { background: var(--bg-surface-elevated); }
        .wo-title { display: flex; flex-direction: column; margin-right: auto; min-width: 0; }
        .wo-num {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.78rem; color: var(--text-muted);
        }
        .wo-prod { font-family: var(--font-heading); font-weight: 700; color: var(--text-primary); }
        .wo-qty { font-weight: 600; color: var(--text-primary); font-size: 0.85rem; }
        .wo-meta { font-size: 0.78rem; color: var(--text-muted); }
        @media (max-width: 720px) { .hide-sm { display: none; } }

        .wo-body { padding: 0 1rem 1.1rem; }
        .wo-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }

        .chip {
          border-radius: var(--radius-full); padding: 0.12rem 0.55rem;
          font-size: 0.72rem; font-weight: 600; text-transform: capitalize;
        }
        .chip-released { background: var(--accent-blue-soft); color: var(--accent-blue); border: 1px solid #bae6fd; }
        .chip-in_progress { background: var(--status-low-stock-bg); color: var(--status-low-stock-text); border: 1px solid var(--status-low-stock-border); }
        .chip-completed { background: var(--status-in-stock-bg); color: var(--status-in-stock-text); border: 1px solid var(--status-in-stock-border); }
        .chip-draft, .chip-cancelled { background: var(--bg-surface-elevated); color: var(--text-muted); border: 1px solid var(--border-subtle); }

        .table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.855rem; }
        .data-table thead { background: var(--bg-surface-elevated); }
        .data-table th {
          text-align: left; padding: 0.6rem 0.8rem; font-size: 0.67rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap;
        }
        .data-table td { padding: 0.6rem 0.8rem; border-top: 1px solid var(--border-subtle); white-space: nowrap; }
        .data-table .right { text-align: right; }
        .data-table tfoot td {
          background: var(--bg-surface-elevated); border-top: 2px solid var(--border-hover); font-weight: 600;
        }
        .row-short { background: var(--status-out-stock-bg); }
        .stack { display: flex; flex-direction: column; gap: 0.1rem; }
        .strong { font-weight: 600; color: var(--text-primary); }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem; color: var(--text-muted); }
        .cap { text-transform: capitalize; }
        .accent { color: var(--primary); }
        .total { color: var(--primary); font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; }
        .good { color: var(--status-in-stock-text); font-weight: 600; }
        .bad { color: var(--status-out-stock-text); font-weight: 600; }
        .ok { color: var(--status-in-stock-text); font-weight: 600; }
        .short { display: flex; flex-direction: column; align-items: flex-end; color: var(--status-out-stock-text); font-weight: 600; }
        .indent-hint { font-size: 0.7rem; font-weight: 500; color: var(--text-muted); }

        .stage-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.6rem;
        }
        .stage-card {
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.65rem 0.75rem; background: var(--bg-surface-elevated);
          display: flex; flex-direction: column; gap: 0.35rem;
        }
        .stage-card.stalled {
          border-color: var(--status-out-stock-border); background: var(--status-out-stock-bg);
        }
        .stage-card.done {
          border-color: var(--status-in-stock-border); background: var(--status-in-stock-bg);
        }
        .stage-top { display: flex; align-items: center; gap: 0.35rem; }
        .stage-seq {
          width: 18px; height: 18px; border-radius: 50%; background: var(--bg-surface);
          border: 1px solid var(--border-subtle); font-size: 0.65rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center; color: var(--text-secondary);
        }
        .stage-name { font-size: 0.78rem; font-weight: 600; color: var(--text-primary); }
        .stall-icon { color: var(--status-out-stock-text); margin-left: auto; }
        .stage-nums { display: flex; align-items: baseline; gap: 0.3rem; }
        .stage-wip { font-family: var(--font-heading); font-size: 1.35rem; font-weight: 700; color: var(--text-primary); }
        .stage-lbl { font-size: 0.7rem; color: var(--text-muted); }
        .stage-foot { display: flex; gap: 0.5rem; font-size: 0.68rem; color: var(--text-muted); }
        .stage-foot .rej { color: var(--status-out-stock-text); font-weight: 600; }

        .toast-pill {
          position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 2000;
          display: flex; align-items: center; gap: 0.65rem; padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md); font-family: var(--font-heading);
          font-size: 0.9rem; font-weight: 600; box-shadow: var(--shadow-lg); max-width: 460px;
        }
        .toast-success { background: #15803d; color: #fff; }
        .toast-error { background: #b45309; color: #fff; }
      `}</style>
    </AppShell>
  );
}
