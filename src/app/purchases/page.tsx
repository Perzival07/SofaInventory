"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { ReceiveGrnModal } from "@/components/ReceiveGrnModal";
import { CreatePoModal } from "@/components/CreatePoModal";
import {
  Loader2, PackageCheck, CheckCircle2, AlertCircle, Receipt, TruckIcon,
} from "lucide-react";
import { Material } from "@/lib/erp-types";
import {
  PurchaseOrder, PurchaseOrderLine, Grn, PostedGrn, Supplier,
} from "@/lib/purchase-types";
import { RegimeState } from "@/lib/tax-types";
import { formatINR, formatDate } from "@/lib/formatters";
import {
  fetchPurchasePageDataAction, fetchPoLinesAction,
} from "@/app/purchase-actions";

export default function PurchasesPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<Grn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [regime, setRegime] = useState<RegimeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [receiveLines, setReceiveLines] = useState<PurchaseOrderLine[]>([]);
  const [isPoOpen, setIsPoOpen] = useState(false);
  const [lastPosted, setLastPosted] = useState<{ posted: PostedGrn; grnNumber: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await fetchPurchasePageDataAction();
      setPos(d.purchaseOrders);
      setGrns(d.grns);
      setSuppliers(d.suppliers);
      setMaterials(d.materials);
      setRegime(d.regime);
    } catch {
      showToast("Failed to load purchase data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server fetch for this page
    load();
  }, [load]);

  const openReceive = async (po: PurchaseOrder) => {
    const lines = await fetchPoLinesAction(po.id);
    setReceiveLines(lines);
    setReceiveTarget(po);
  };

  const openPos = pos.filter((p) => p.status === "approved" || p.status === "partial");
  const totalRecoverable = grns.reduce((s, g) => s + Number(g.total_recoverable_tax), 0);
  const totalAbsorbed = grns
    .filter((g) => g.cost_basis === "inclusive")
    .reduce((s, g) => s + Number(g.total_tax), 0);

  return (
    <AppShell
      title="Purchase & Receiving"
      subtitle="Purchase orders, goods receipt, and landed cost into the raw material store"
      actionLabel="New Purchase Order"
      onAction={() => setIsPoOpen(true)}
    >
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-label">Open Purchase Orders</span>
          <span className="kpi-value">{openPos.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Goods Receipts</span>
          <span className="kpi-value">{grns.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">
            {regime?.cost_basis === "net" ? "Input Credit Accrued" : "Tax Absorbed Into Cost"}
          </span>
          <span className={`kpi-value ${regime?.cost_basis === "net" ? "ok" : "warn"}`}>
            {formatINR(regime?.cost_basis === "net" ? totalRecoverable : totalAbsorbed)}
          </span>
        </div>
      </div>

      {lastPosted && (
        <section className="posted-panel">
          <h2 className="panel-title">
            <PackageCheck size={17} /> {lastPosted.grnNumber} posted
          </h2>
          <p className="panel-sub">
            Costed on the <strong>{lastPosted.posted.cost_basis}</strong> basis
            {lastPosted.posted.regime_at_receipt ? " (registered at receipt)" : " (unregistered at receipt)"}.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th><th>Batch</th><th className="right">Stocked</th>
                  <th className="right">Freight</th><th className="right">Landed cost</th>
                  <th className="right">Variance vs standard</th>
                </tr>
              </thead>
              <tbody>
                {lastPosted.posted.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="strong">{l.material_name}</td>
                    <td className="mono">{l.batch_no}</td>
                    <td className="right">
                      {l.stock_quantity.toLocaleString("en-IN")} {l.stock_uom}
                      {l.purchase_uom !== l.stock_uom && (
                        <span className="conv"> from {l.accepted_quantity} {l.purchase_uom}</span>
                      )}
                    </td>
                    <td className="right">{formatINR(l.freight_allocated)}</td>
                    <td className="right strong">{formatINR(l.landed_unit_cost)}/{l.stock_uom}</td>
                    <td className="right">
                      <span className={l.price_variance_total > 0 ? "bad" : "good"}>
                        {l.price_variance_total > 0 ? "+" : ""}{formatINR(l.price_variance_total)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title"><Receipt size={17} /> Purchase Orders</h2>
        {isLoading ? (
          <div className="state-block"><Loader2 size={28} className="spin" /><p>Loading...</p></div>
        ) : pos.length === 0 ? (
          <div className="state-block"><p>No purchase orders yet.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO</th><th>Supplier</th><th>Ordered</th><th>Expected</th>
                  <th className="right">Value</th><th>Status</th><th className="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id}>
                    <td className="mono strong">{po.po_number}</td>
                    <td>{po.supplier_name}</td>
                    <td>{formatDate(po.order_date)}</td>
                    <td>{po.expected_date ? formatDate(po.expected_date) : "—"}</td>
                    <td className="right strong">{formatINR(po.total_value ?? 0)}</td>
                    <td><span className={`chip chip-${po.status}`}>{po.status}</span></td>
                    <td className="right">
                      {(po.status === "approved" || po.status === "partial") && (
                        <button className="btn btn-primary btn-sm"
                          onClick={() => openReceive(po)} id={`btn-receive-${po.id}`}>
                          <TruckIcon size={14} /><span>Receive</span>
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

      <section className="panel">
        <h2 className="panel-title"><PackageCheck size={17} /> Goods Receipts</h2>
        {grns.length === 0 ? (
          <div className="state-block"><p>No receipts recorded yet.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>GRN</th><th>Supplier</th><th>Date</th><th>Invoice</th>
                  <th>Basis</th><th className="right">Taxable</th><th className="right">Tax</th>
                  <th className="right">Into stock</th>
                </tr>
              </thead>
              <tbody>
                {grns.map((g) => (
                  <tr key={g.id}>
                    <td className="mono strong">{g.grn_number}</td>
                    <td>{g.supplier_name}</td>
                    <td>{formatDate(g.receipt_date)}</td>
                    <td className="mono">{g.supplier_invoice_no || "—"}</td>
                    <td>
                      <span className={`chip ${g.cost_basis === "net" ? "chip-net" : "chip-incl"}`}>
                        {g.cost_basis}
                      </span>
                    </td>
                    <td className="right">{formatINR(Number(g.total_taxable))}</td>
                    <td className="right">
                      {formatINR(Number(g.total_tax))}
                      {Number(g.total_recoverable_tax) > 0 && (
                        <span className="conv"> credit</span>
                      )}
                    </td>
                    <td className="right strong">{formatINR(Number(g.total_inventory_value))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {regime && (
        <ReceiveGrnModal
          isOpen={Boolean(receiveTarget)}
          po={receiveTarget}
          poLines={receiveLines}
          materials={materials}
          regime={regime}
          onClose={() => setReceiveTarget(null)}
          onReceived={(posted, grnNumber) => {
            setLastPosted({ posted, grnNumber });
            showToast(`${grnNumber} posted — ${formatINR(posted.total_inventory_value)} into stock.`);
            load();
          }}
        />
      )}

      <CreatePoModal
        isOpen={isPoOpen}
        suppliers={suppliers}
        materials={materials}
        onClose={() => setIsPoOpen(false)}
        onCreated={() => { showToast("Purchase order created."); load(); }}
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
        .kpi-value.ok { color: var(--status-in-stock-text); }
        .kpi-value.warn { color: var(--primary); }

        .panel, .posted-panel {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .posted-panel { border-left: 4px solid var(--status-in-stock-text); }
        .panel-title { font-size: 1.05rem; display: flex; align-items: center; gap: 0.45rem; }
        .panel-sub { font-size: 0.825rem; color: var(--text-secondary); margin: 0.2rem 0 1rem; }

        .state-block {
          padding: 2.5rem; text-align: center; color: var(--text-secondary);
          display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
        }
        .spin { animation: spin 1s linear infinite; color: var(--primary); }
        @keyframes spin { to { transform: rotate(360deg); } }

        .table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.865rem; }
        .data-table thead { background: var(--bg-surface-elevated); }
        .data-table th {
          text-align: left; padding: 0.65rem 0.8rem; font-size: 0.68rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap;
        }
        .data-table td { padding: 0.65rem 0.8rem; border-top: 1px solid var(--border-subtle); white-space: nowrap; }
        .data-table .right { text-align: right; }
        .strong { font-weight: 600; color: var(--text-primary); }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; }
        .conv { font-size: 0.72rem; color: var(--text-muted); }
        .good { color: var(--status-in-stock-text); font-weight: 600; }
        .bad { color: var(--status-out-stock-text); font-weight: 600; }

        .chip {
          border-radius: var(--radius-full); padding: 0.12rem 0.55rem;
          font-size: 0.72rem; font-weight: 600; text-transform: capitalize;
        }
        .chip-approved { background: var(--accent-blue-soft); color: var(--accent-blue); border: 1px solid #bae6fd; }
        .chip-partial { background: var(--status-low-stock-bg); color: var(--status-low-stock-text); border: 1px solid var(--status-low-stock-border); }
        .chip-received { background: var(--status-in-stock-bg); color: var(--status-in-stock-text); border: 1px solid var(--status-in-stock-border); }
        .chip-draft, .chip-cancelled { background: var(--bg-surface-elevated); color: var(--text-muted); border: 1px solid var(--border-subtle); }
        .chip-incl { background: var(--primary-soft); color: var(--primary); border: 1px solid var(--primary-soft-border); }
        .chip-net { background: var(--status-in-stock-bg); color: var(--status-in-stock-text); border: 1px solid var(--status-in-stock-border); }

        .toast-pill {
          position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 2000;
          display: flex; align-items: center; gap: 0.65rem; padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md); font-family: var(--font-heading);
          font-size: 0.9rem; font-weight: 600; box-shadow: var(--shadow-lg); max-width: 420px;
        }
        .toast-success { background: #15803d; color: #fff; }
        .toast-error { background: #b91c1c; color: #fff; }
      `}</style>
    </AppShell>
  );
}
