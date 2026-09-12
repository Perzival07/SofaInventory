"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { TurnoverWatchdog } from "@/components/TurnoverWatchdog";
import {
  CreateOrderModal, AddCustomerModal, AddUnitModal, PaymentModal,
} from "@/components/SalesModals";
import {
  Loader2, CheckCircle2, AlertCircle, ShoppingCart, Wallet, Boxes,
  UserPlus, PackagePlus, Banknote, AlertTriangle,
} from "lucide-react";
import { KhataAccount, CONDITION_LABELS } from "@/lib/sales-types";
import { formatINR, formatDate } from "@/lib/formatters";
import { needsMarkdown, sellableReason } from "@/lib/sales-logic";
import {
  fetchSalesPageDataAction, updateOrderStatusAction, SalesPageData,
} from "@/app/sales-actions";

const STATUS_FLOW = ["quote", "confirmed", "in_production", "ready", "dispatched", "delivered"];

export default function SalesPage() {
  const [data, setData] = useState<SalesPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isUnitOpen, setIsUnitOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<KhataAccount | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 7000);
  }, []);

  const load = useCallback(async () => {
    try { setData(await fetchSalesPageDataAction()); }
    catch { showToast("Failed to load sales data", "error"); }
    finally { setIsLoading(false); }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server fetch for this page
    load();
  }, [load]);

  const advance = async (orderId: number, current: string) => {
    const next = STATUS_FLOW[Math.min(STATUS_FLOW.indexOf(current) + 1, STATUS_FLOW.length - 1)];
    await updateOrderStatusAction(orderId, next);
    showToast(`Order moved to ${next.replace(/_/g, " ")}.`);
    load();
  };

  if (isLoading || !data) {
    return (
      <AppShell title="Sales & Billing" subtitle="Orders, khata, delivery and the turnover watchdog">
        <div className="state"><Loader2 size={28} className="spin" /><p>Loading...</p></div>
        <style jsx>{`
          .state { padding: 4rem; text-align: center; color: var(--text-secondary);
            display: flex; flex-direction: column; align-items: center; gap: 0.7rem; }
          .spin { animation: spin 1s linear infinite; color: var(--primary); }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </AppShell>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const outstanding = data.khata.reduce((s, k) => s + k.balance, 0);
  const overdue = data.khata.filter((k) => k.days_overdue > 30);
  const markdowns = data.units.filter((u) => needsMarkdown(u, today));
  const blocked = data.units.filter((u) => u.status === "available" && u.cartons_present < u.carton_total);

  return (
    <AppShell
      title="Sales & Billing"
      subtitle="Orders, khata ledger, delivery zones and the turnover watchdog"
      actionLabel="New Sale"
      onAction={() => setIsOrderOpen(true)}
    >
      <TurnoverWatchdog
        status={data.turnover}
        otherPanTurnover={data.otherPanTurnover}
        registered={data.regime.registered}
        onChanged={load}
      />

      <div className="kpi-row">
        <div className="kpi">
          <span className="kpi-l">Orders This Year</span>
          <span className="kpi-v">{data.orders.length}</span>
        </div>
        <div className="kpi">
          <span className="kpi-l">Khata Outstanding</span>
          <span className={`kpi-v ${outstanding > 0 ? "warn" : ""}`}>{formatINR(outstanding)}</span>
          {overdue.length > 0 && <span className="kpi-s">{overdue.length} over 30 days</span>}
        </div>
        <div className="kpi">
          <span className="kpi-l">Sellable Units</span>
          <span className="kpi-v">{data.sellableUnits.length}</span>
          {blocked.length > 0 && <span className="kpi-s bad">{blocked.length} incomplete</span>}
        </div>
        <div className="kpi">
          <span className="kpi-l">Markdown Due</span>
          <span className={`kpi-v ${markdowns.length > 0 ? "warn" : ""}`}>{markdowns.length}</span>
          <span className="kpi-s">Floor models over 90 days</span>
        </div>
      </div>

      <div className="quick-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => setIsCustomerOpen(true)} id="btn-add-customer">
          <UserPlus size={14} /><span>Add Customer</span>
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setIsUnitOpen(true)} id="btn-add-unit">
          <PackagePlus size={14} /><span>Add Finished Unit</span>
        </button>
      </div>

      {/* ATP */}
      <section className="panel">
        <h2 className="p-title"><Boxes size={17} /> Available to Promise</h2>
        <p className="p-sub">
          What can actually be handed over today. Incomplete carton sets and held stock are excluded.
        </p>
        {data.atp.length === 0 ? <div className="empty">No finished products defined.</div> : (
          <div className="tw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Product</th><th className="r">On hand</th><th className="r">Held</th>
                  <th className="r">Incomplete</th><th className="r">Available now</th>
                  <th className="r">In production</th><th>Next available</th>
                </tr>
              </thead>
              <tbody>
                {data.atp.map((a) => (
                  <tr key={a.product_id}>
                    <td className="b">{a.product_name}</td>
                    <td className="r">{a.on_hand}</td>
                    <td className="r">{a.soft_reserved + a.hard_reserved || "—"}</td>
                    <td className="r">{a.incomplete > 0 ? <span className="bad">{a.incomplete}</span> : "—"}</td>
                    <td className="r b accent">{a.available_now}</td>
                    <td className="r">{a.in_production || "—"}</td>
                    <td>{a.next_available_date ? formatDate(a.next_available_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Orders */}
      <section className="panel">
        <h2 className="p-title"><ShoppingCart size={17} /> Orders</h2>
        {data.orders.length === 0 ? <div className="empty">No sales yet.</div> : (
          <div className="tw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Bill</th><th>Type</th><th>Customer</th><th>Date</th>
                  <th className="r">Total</th><th className="r">Due</th>
                  <th>Status</th><th className="r">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="m b">{o.order_number}</td>
                    <td>
                      <span className={`chip doc-${o.document_type}`}>
                        {o.document_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{o.customer_name}</td>
                    <td>{formatDate(o.order_date)}</td>
                    <td className="r b">{formatINR(o.grand_total)}</td>
                    <td className="r">
                      {o.balance_due > 0
                        ? <span className="bad">{formatINR(o.balance_due)}</span>
                        : <span className="good">Paid</span>}
                    </td>
                    <td><span className={`chip st-${o.status}`}>{o.status.replace(/_/g, " ")}</span></td>
                    <td className="r">
                      {o.status !== "delivered" && o.status !== "cancelled" && (
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => advance(o.id, o.status)} id={`btn-advance-${o.id}`}>
                          Advance
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Khata */}
      <section className="panel">
        <h2 className="p-title"><Wallet size={17} /> Khata / Udhaar Ledger</h2>
        <p className="p-sub">Running credit per customer. Part-payment is the norm, so this is a core book.</p>
        {data.khata.length === 0 ? <div className="empty">No credit accounts yet.</div> : (
          <div className="tw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Customer</th><th>Phone</th><th className="r">Billed</th>
                  <th className="r">Paid</th><th className="r">Balance</th>
                  <th className="r">Oldest due</th><th className="r">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.khata.map((k) => (
                  <tr key={k.customer_id} className={k.days_overdue > 30 ? "row-warn" : ""}>
                    <td className="b">{k.customer_name}</td>
                    <td className="m">{k.phone}</td>
                    <td className="r">{formatINR(k.total_billed)}</td>
                    <td className="r good">{formatINR(k.total_paid)}</td>
                    <td className="r b">
                      {k.balance > 0
                        ? <span className="bad">{formatINR(k.balance)}</span>
                        : <span className="good">Settled</span>}
                    </td>
                    <td className="r">
                      {k.oldest_due_date
                        ? <span className={k.days_overdue > 30 ? "bad" : ""}>{k.days_overdue}d</span>
                        : "—"}
                    </td>
                    <td className="r">
                      {k.balance > 0 && (
                        <button className="btn btn-primary btn-sm" onClick={() => setPayTarget(k)}
                          id={`btn-pay-${k.customer_id}`}>
                          <Banknote size={13} /><span>Payment</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Units */}
      {data.units.length > 0 && (
        <section className="panel">
          <h2 className="p-title"><Boxes size={17} /> Finished Units</h2>
          <div className="tw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Serial</th><th>Product</th><th>Condition</th><th>Cartons</th>
                  <th className="r">Cost</th><th className="r">Price</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.units.map((u) => {
                  const reason = sellableReason(u);
                  const md = needsMarkdown(u, today);
                  return (
                    <tr key={u.id} className={reason && u.status === "available" ? "row-warn" : ""}>
                      <td className="m b">{u.serial_no}</td>
                      <td>{u.product_name}</td>
                      <td>
                        <span className={`chip grade-${u.condition_grade}`}>
                          {CONDITION_LABELS[u.condition_grade]}
                        </span>
                        {md && <span className="chip md"><AlertTriangle size={10} /> Markdown</span>}
                      </td>
                      <td>
                        <span className={u.cartons_present < u.carton_total ? "bad b" : ""}>
                          {u.cartons_present}/{u.carton_total}
                        </span>
                      </td>
                      <td className="r">{formatINR(u.cost)}</td>
                      <td className="r b">{formatINR(u.list_price)}</td>
                      <td>
                        {reason
                          ? <span className="small bad">{reason}</span>
                          : <span className="chip good-chip">Sellable</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Cash book */}
      {data.cashBook.length > 0 && (
        <section className="panel">
          <h2 className="p-title"><Banknote size={17} /> Daily Cash Book</h2>
          <div className="tw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Date</th><th className="r">Opening</th><th className="r">Cash</th>
                  <th className="r">UPI</th><th className="r">Other</th>
                  <th className="r">Total in</th><th className="r">Closing</th>
                </tr>
              </thead>
              <tbody>
                {data.cashBook.map((r) => (
                  <tr key={r.date}>
                    <td>{formatDate(r.date)}</td>
                    <td className="r">{formatINR(r.opening)}</td>
                    <td className="r">{formatINR(r.cash_in)}</td>
                    <td className="r">{formatINR(r.upi_in)}</td>
                    <td className="r">{formatINR(r.other_in)}</td>
                    <td className="r b">{formatINR(r.total_in)}</td>
                    <td className="r b accent">{formatINR(r.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CreateOrderModal
        isOpen={isOrderOpen} customers={data.customers} products={data.products}
        sellableUnits={data.sellableUnits} zones={data.zones} regime={data.regime}
        onClose={() => setIsOrderOpen(false)}
        onCreated={(num, doc, total, triggers) => {
          const blocking = triggers.filter((t) => t.severity === "blocking");
          showToast(
            blocking.length
              ? `${num} raised — ${blocking[0].message}`
              : `${num} raised as a ${doc.replace(/_/g, " ")} for ${formatINR(total)}.`,
            blocking.length ? "error" : "success"
          );
          load();
        }}
      />
      <AddCustomerModal isOpen={isCustomerOpen} zones={data.zones}
        onClose={() => setIsCustomerOpen(false)}
        onCreated={() => { showToast("Customer added."); load(); }} />
      <AddUnitModal isOpen={isUnitOpen} products={data.products}
        onClose={() => setIsUnitOpen(false)}
        onCreated={(s) => { showToast(`Unit ${s} added.`); load(); }} />
      <PaymentModal isOpen={Boolean(payTarget)} account={payTarget} orders={data.orders}
        onClose={() => setPayTarget(null)}
        onRecorded={() => { showToast("Payment recorded."); load(); }} />

      {toast && (
        <div className={`toast ${toast.type === "error" ? "t-err" : "t-ok"}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        .kpi-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; margin-bottom: 1.25rem; }
        @media (min-width: 720px) { .kpi-row { grid-template-columns: repeat(4, 1fr); } }
        .kpi {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 0.95rem 1.1rem;
          display: flex; flex-direction: column; gap: 0.15rem;
        }
        .kpi-l { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--text-secondary); font-weight: 600; }
        .kpi-v { font-family: var(--font-heading); font-size: 1.35rem; font-weight: 700; }
        .kpi-v.warn { color: var(--primary); }
        .kpi-s { font-size: 0.68rem; color: var(--text-muted); }
        .kpi-s.bad { color: var(--status-out-stock-text); }

        .quick-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }

        .panel {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .p-title { font-size: 1.05rem; display: flex; align-items: center; gap: 0.45rem; }
        .p-sub { font-size: 0.8rem; color: var(--text-secondary); margin: 0.2rem 0 1rem; line-height: 1.45; }
        .empty { padding: 1.75rem; text-align: center; color: var(--text-secondary); }

        .tw { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
        .dt { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .dt thead { background: var(--bg-surface-elevated); }
        .dt th { text-align: left; padding: 0.6rem 0.8rem; font-size: 0.66rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap; }
        .dt td { padding: 0.6rem 0.8rem; border-top: 1px solid var(--border-subtle); white-space: nowrap; }
        .dt .r { text-align: right; }
        .row-warn { background: var(--status-low-stock-bg); }
        .b { font-weight: 600; color: var(--text-primary); }
        .m { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.76rem; }
        .accent { color: var(--primary); }
        .good { color: var(--status-in-stock-text); font-weight: 600; }
        .bad { color: var(--status-out-stock-text); font-weight: 600; }
        .small { font-size: 0.75rem; font-weight: 500; }

        .chip {
          display: inline-flex; align-items: center; gap: 0.2rem;
          border-radius: var(--radius-full); padding: 0.1rem 0.5rem;
          font-size: 0.68rem; font-weight: 600; text-transform: capitalize; margin-right: 0.25rem;
        }
        .doc-cash_memo, .doc-bill_of_supply {
          background: var(--bg-surface-elevated); color: var(--text-secondary); border: 1px solid var(--border-subtle);
        }
        .doc-tax_invoice {
          background: var(--accent-blue-soft); color: var(--accent-blue); border: 1px solid #bae6fd;
        }
        .st-quote { background: var(--bg-surface-elevated); color: var(--text-muted); border: 1px solid var(--border-subtle); }
        .st-confirmed, .st-in_production, .st-ready, .st-dispatched {
          background: var(--status-low-stock-bg); color: var(--status-low-stock-text);
          border: 1px solid var(--status-low-stock-border);
        }
        .st-delivered, .good-chip {
          background: var(--status-in-stock-bg); color: var(--status-in-stock-text);
          border: 1px solid var(--status-in-stock-border);
        }
        .st-cancelled { background: var(--status-out-stock-bg); color: var(--status-out-stock-text); border: 1px solid var(--status-out-stock-border); }
        .grade-new_in_box { background: var(--status-in-stock-bg); color: var(--status-in-stock-text); border: 1px solid var(--status-in-stock-border); }
        .grade-floor_model, .grade-open_box { background: var(--status-low-stock-bg); color: var(--status-low-stock-text); border: 1px solid var(--status-low-stock-border); }
        .grade-minor_damage, .grade-as_is_clearance, .grade-customer_return {
          background: var(--status-out-stock-bg); color: var(--status-out-stock-text); border: 1px solid var(--status-out-stock-border);
        }
        .md { background: var(--primary-soft); color: var(--primary); border: 1px solid var(--primary-soft-border); }

        .toast {
          position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 2000;
          display: flex; align-items: flex-start; gap: 0.65rem; padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md); font-family: var(--font-heading);
          font-size: 0.86rem; font-weight: 600; box-shadow: var(--shadow-lg);
          max-width: 460px; line-height: 1.4;
        }
        .t-ok { background: #15803d; color: #fff; }
        .t-err { background: #b45309; color: #fff; }
      `}</style>
    </AppShell>
  );
}
