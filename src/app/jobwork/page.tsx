"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import {
  CreateJobWorkModal, DispatchChallanModal, ReceiveJobWorkModal, VendorInvoiceModal,
} from "@/components/JobWorkModals";
import {
  Loader2, CheckCircle2, AlertCircle, Send, Warehouse, AlertTriangle,
  PackageCheck, Scale, ShieldAlert,
} from "lucide-react";
import { JobWorkOrder } from "@/lib/jobwork-types";
import { formatINR, formatDate } from "@/lib/formatters";
import { fetchJobWorkPageDataAction, JobWorkPageData } from "@/app/jobwork-actions";

export default function JobWorkPage() {
  const [data, setData] = useState<JobWorkPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<JobWorkOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<JobWorkOrder | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<JobWorkOrder | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 7000);
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await fetchJobWorkPageDataAction());
    } catch {
      showToast("Failed to load job work data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server fetch for this page
    load();
  }, [load]);

  if (isLoading || !data) {
    return (
      <AppShell title="Job Work" subtitle="Outsourced manufacturing and stock with vendors">
        <div className="state-block"><Loader2 size={28} className="spin" /><p>Loading...</p></div>
        <style jsx>{`
          .state-block {
            padding: 4rem; text-align: center; color: var(--text-secondary);
            display: flex; flex-direction: column; align-items: center; gap: 0.7rem;
          }
          .spin { animation: spin 1s linear infinite; color: var(--primary); }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </AppShell>
    );
  }

  const vendorStockValue = data.vendorStock.reduce((s, v) => s + v.value, 0);
  const blockedPayments = data.matches.filter((m) => m.payment_blocked).length;
  const breaches = data.reconciliation.filter(
    (r) => r.deadline_status !== "ok" && r.balance_qty > 0
  ).length;

  return (
    <AppShell
      title="Job Work"
      subtitle="Outsourced manufacturing, challans, and stock held by vendors"
      actionLabel="New Job Work Order"
      onAction={() => setIsCreateOpen(true)}
    >
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-label">Stock With Vendors</span>
          <span className="kpi-value accent">{formatINR(vendorStockValue)}</span>
          <span className="kpi-sub">Still your asset</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Open Orders</span>
          <span className="kpi-value">
            {data.orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Payments Blocked</span>
          <span className={`kpi-value ${blockedPayments > 0 ? "danger" : ""}`}>{blockedPayments}</span>
          <span className="kpi-sub">Three-way match failed</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Return Deadline Alerts</span>
          <span className={`kpi-value ${breaches > 0 ? "danger" : ""}`}>{breaches}</span>
        </div>
      </div>

      {/* Stock with vendor */}
      <section className="panel">
        <h2 className="panel-title"><Warehouse size={17} /> Stock With Vendor</h2>
        <p className="panel-sub">
          Material physically at a job worker. It has left the raw store but it is still your
          inventory — never treated as consumed.
        </p>
        {data.vendorStock.length === 0 ? (
          <div className="empty">No material currently with vendors.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor</th><th>Material</th><th className="right">Qty</th>
                  <th className="right">Value</th><th className="right">Days out</th><th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {data.vendorStock.map((v, i) => (
                  <tr key={i} className={v.deadline_status !== "ok" ? "row-warn" : ""}>
                    <td className="strong">{v.vendor_name}</td>
                    <td>
                      <div className="stack">
                        <span>{v.material_name}</span>
                        <span className="mono">{v.material_code}</span>
                      </div>
                    </td>
                    <td className="right strong">{v.quantity} {v.stock_uom}</td>
                    <td className="right accent">{formatINR(v.value)}</td>
                    <td className="right">{v.days_out}d</td>
                    <td>
                      <span className={`chip chip-${v.deadline_status}`}>
                        {v.deadline_status === "ok" ? "Within window"
                          : v.deadline_status === "approaching" ? "Approaching" : "Breached"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="right strong">Total held by vendors</td>
                  <td className="right total">{formatINR(vendorStockValue)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Orders */}
      <section className="panel">
        <h2 className="panel-title"><Send size={17} /> Job Work Orders</h2>
        {data.orders.length === 0 ? (
          <div className="empty">No job work orders yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th><th>Vendor</th><th>Operation</th><th className="right">Expected</th>
                  <th className="right">Received</th><th className="right">Rate</th>
                  <th>Status</th><th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono strong">{o.jw_number}</td>
                    <td>{o.vendor_name}</td>
                    <td>{o.operation_name ?? o.operation_code ?? "—"}</td>
                    <td className="right">{o.expected_output_qty}</td>
                    <td className="right">
                      {o.received_qty ?? 0}
                      {(o.rejected_qty ?? 0) > 0 && <span className="bad"> ({o.rejected_qty} rej)</span>}
                    </td>
                    <td className="right">{formatINR(o.rate)}</td>
                    <td><span className={`chip chip-${o.status}`}>{o.status.replace("_", " ")}</span></td>
                    <td className="right">
                      <div className="actions">
                        <button className="btn btn-primary btn-sm" onClick={() => setDispatchTarget(o)}
                          id={`btn-dispatch-${o.id}`}>Dispatch</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setReceiveTarget(o)}
                          id={`btn-receive-${o.id}`}>Receive</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setInvoiceTarget(o)}
                          id={`btn-invoice-${o.id}`}>Invoice</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Challan reconciliation */}
      {data.reconciliation.length > 0 && (
        <section className="panel">
          <h2 className="panel-title"><PackageCheck size={17} /> Challan Reconciliation</h2>
          <p className="panel-sub">Sent versus received versus balance, ageing-wise.</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challan</th><th>Vendor</th><th>Dispatched</th>
                  <th className="right">Sent</th><th className="right">Returned</th>
                  <th className="right">Balance</th><th className="right">Value</th>
                  <th className="right">Months left</th>
                </tr>
              </thead>
              <tbody>
                {data.reconciliation.map((r) => (
                  <tr key={r.challan_id} className={r.deadline_status !== "ok" ? "row-warn" : ""}>
                    <td className="mono strong">{r.challan_number}</td>
                    <td>{r.vendor_name}</td>
                    <td>{formatDate(r.dispatch_date)} <span className="dim">({r.days_out}d)</span></td>
                    <td className="right">{r.sent_qty}</td>
                    <td className="right">{r.returned_qty}</td>
                    <td className="right strong">{r.balance_qty}</td>
                    <td className="right">{formatINR(r.sent_value)}</td>
                    <td className="right">
                      <span className={r.months_remaining <= 3 ? "bad" : ""}>{r.months_remaining}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Three-way match */}
      {data.matches.length > 0 && (
        <section className="panel">
          <h2 className="panel-title"><ShieldAlert size={17} /> Three-Way Match</h2>
          <p className="panel-sub">Order ↔ goods received ↔ vendor invoice. Payment is blocked on mismatch.</p>
          <div className="match-list">
            {data.matches.map((m) => (
              <div className={`match-card ${m.payment_blocked ? "blocked" : "clear"}`} key={m.jw_order_id}>
                <div className="match-head">
                  <span className="mono strong">{m.jw_number}</span>
                  <span className={`chip ${m.payment_blocked ? "chip-breached" : "chip-ok"}`}>
                    {m.payment_blocked ? "Payment blocked" : "Cleared for payment"}
                  </span>
                </div>
                <div className="match-nums">
                  <span>Ordered {m.ordered_qty} @ {formatINR(m.ordered_rate)}</span>
                  <span>Received {m.received_good_qty}</span>
                  <span>Invoiced {m.invoice_qty ?? "—"}</span>
                  <span className="strong">Expected {formatINR(m.expected_amount)}</span>
                </div>
                {m.discrepancies.length > 0 && (
                  <ul className="disc-list">
                    {m.discrepancies.map((d, i) => (
                      <li key={i}><AlertTriangle size={12} /> {d}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Make vs buy */}
      {data.makeVsBuy.length > 0 && (
        <section className="panel">
          <h2 className="panel-title"><Scale size={17} /> Make vs Buy</h2>
          <p className="panel-sub">
            {data.regime.itc_available
              ? "Registered — vendor tax is creditable, so it is excluded from the outsourced cost."
              : "Unregistered — vendor tax is a real cost and is included below. This comparison flips automatically on registration."}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Operation</th><th className="right">In-house</th>
                  <th className="right">Job work labour</th><th className="right">Tax</th>
                  <th className="right">Effective</th><th>Cheaper</th>
                </tr>
              </thead>
              <tbody>
                {data.makeVsBuy.map((l, i) => (
                  <tr key={i}>
                    <td className="strong">{l.operation}</td>
                    <td className="right">{formatINR(l.in_house_cost)}</td>
                    <td className="right">{formatINR(l.job_work_labour)}</td>
                    <td className="right">
                      {formatINR(l.job_work_tax)}
                      {l.job_work_recoverable_tax > 0 && <span className="dim"> (credit)</span>}
                    </td>
                    <td className="right strong">{formatINR(l.job_work_effective_cost)}</td>
                    <td>
                      <span className={`chip ${l.cheaper === "make" ? "chip-make" : "chip-buy"}`}>
                        {l.cheaper === "make" ? "Make" : "Buy"} · {formatINR(l.difference)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CreateJobWorkModal
        isOpen={isCreateOpen} vendors={data.vendors} products={data.products}
        workOrders={data.workOrders} onClose={() => setIsCreateOpen(false)}
        onCreated={(jw) => { showToast(`${jw} created.`); load(); }}
      />
      <DispatchChallanModal
        isOpen={Boolean(dispatchTarget)} order={dispatchTarget} materials={data.materials}
        onClose={() => setDispatchTarget(null)}
        onDispatched={(msg, warnings) => {
          showToast(warnings.length ? `${msg} — ${warnings[0]}` : msg, warnings.length ? "error" : "success");
          load();
        }}
      />
      <ReceiveJobWorkModal
        isOpen={Boolean(receiveTarget)} order={receiveTarget} materials={data.materials}
        onClose={() => setReceiveTarget(null)}
        onReceived={(recovery, warnings) => {
          showToast(
            warnings.length ? warnings[0] :
            recovery > 0
              ? `Receipt posted. ${formatINR(recovery)} recoverable from the vendor for excess wastage.`
              : "Receipt posted. Wastage within the agreed allowance.",
            (recovery > 0 || warnings.length) ? "error" : "success"
          );
          load();
        }}
      />
      <VendorInvoiceModal
        isOpen={Boolean(invoiceTarget)} order={invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        onRecorded={() => { showToast("Invoice recorded — three-way match updated."); load(); }}
      />

      {toast && (
        <div className={`toast-pill ${toast.type === "error" ? "toast-error" : "toast-success"}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        .kpi-row { display: grid; grid-template-columns: 1fr; gap: 0.85rem; margin-bottom: 1.5rem; }
        @media (min-width: 640px) { .kpi-row { grid-template-columns: repeat(4, 1fr); } }
        .kpi-card {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1rem 1.15rem;
          display: flex; flex-direction: column; gap: 0.2rem;
        }
        .kpi-label {
          font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--text-secondary); font-weight: 600;
        }
        .kpi-value { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; }
        .kpi-value.accent { color: var(--primary); }
        .kpi-value.danger { color: var(--status-out-stock-text); }
        .kpi-sub { font-size: 0.7rem; color: var(--text-muted); }

        .panel {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .panel-title { font-size: 1.05rem; display: flex; align-items: center; gap: 0.45rem; }
        .panel-sub { font-size: 0.82rem; color: var(--text-secondary); margin: 0.2rem 0 1rem; line-height: 1.45; }
        .empty { padding: 1.75rem; text-align: center; color: var(--text-secondary); }

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
        .row-warn { background: var(--status-low-stock-bg); }
        .stack { display: flex; flex-direction: column; gap: 0.1rem; }
        .strong { font-weight: 600; color: var(--text-primary); }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.76rem; }
        .dim { color: var(--text-muted); font-size: 0.75rem; }
        .accent { color: var(--primary); font-weight: 600; }
        .bad { color: var(--status-out-stock-text); font-weight: 600; }
        .total { color: var(--primary); font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; }
        .actions { display: flex; gap: 0.35rem; justify-content: flex-end; }

        .chip {
          border-radius: var(--radius-full); padding: 0.12rem 0.55rem;
          font-size: 0.7rem; font-weight: 600; text-transform: capitalize; white-space: nowrap;
        }
        .chip-ok, .chip-completed {
          background: var(--status-in-stock-bg); color: var(--status-in-stock-text);
          border: 1px solid var(--status-in-stock-border);
        }
        .chip-approaching, .chip-part_received, .chip-dispatched {
          background: var(--status-low-stock-bg); color: var(--status-low-stock-text);
          border: 1px solid var(--status-low-stock-border);
        }
        .chip-breached { background: var(--status-out-stock-bg); color: var(--status-out-stock-text); border: 1px solid var(--status-out-stock-border); }
        .chip-open, .chip-draft, .chip-cancelled { background: var(--bg-surface-elevated); color: var(--text-muted); border: 1px solid var(--border-subtle); }
        .chip-make { background: var(--accent-purple-soft); color: var(--accent-purple); border: 1px solid #e9d5ff; }
        .chip-buy { background: var(--accent-blue-soft); color: var(--accent-blue); border: 1px solid #bae6fd; }

        .match-list { display: flex; flex-direction: column; gap: 0.7rem; }
        .match-card {
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem 1rem;
        }
        .match-card.blocked { border-left: 4px solid var(--status-out-stock-text); background: var(--status-out-stock-bg); }
        .match-card.clear { border-left: 4px solid var(--status-in-stock-text); background: var(--status-in-stock-bg); }
        .match-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
        .match-nums {
          display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.82rem; color: var(--text-secondary);
        }
        .disc-list { margin: 0.6rem 0 0; padding-left: 0; list-style: none; }
        .disc-list li {
          display: flex; align-items: flex-start; gap: 0.35rem; font-size: 0.8rem;
          color: var(--status-out-stock-text); padding: 0.15rem 0;
        }

        .toast-pill {
          position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 2000;
          display: flex; align-items: center; gap: 0.65rem; padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md); font-family: var(--font-heading);
          font-size: 0.88rem; font-weight: 600; box-shadow: var(--shadow-lg); max-width: 480px;
        }
        .toast-success { background: #15803d; color: #fff; }
        .toast-error { background: #b45309; color: #fff; }
      `}</style>
    </AppShell>
  );
}
