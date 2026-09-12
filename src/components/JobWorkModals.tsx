"use client";

import { useState, type SubmitEvent } from "react";
import { X, Send, PackageCheck, Receipt } from "lucide-react";
import { Material, Product } from "@/lib/erp-types";
import { JobWorkVendor, JobWorkOrder, ChallanLineInput } from "@/lib/jobwork-types";
import { formatINR, getTodayDateString } from "@/lib/formatters";
import {
  createJobWorkOrderAction, dispatchChallanAction,
  receiveJobWorkAction, recordVendorInvoiceAction,
} from "@/app/jobwork-actions";

const closeBtnStyles = `
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
  .title-icon { color: var(--primary); }
  .modal-sub { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem; }
  .grid-2 { display: grid; grid-template-columns: 1fr; gap: 0.9rem; }
  @media (min-width: 560px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
`;

// -----------------------------------------------------------------------------
export function CreateJobWorkModal({
  isOpen, vendors, products, workOrders, onClose, onCreated,
}: {
  isOpen: boolean;
  vendors: JobWorkVendor[];
  products: Product[];
  workOrders: { id: number; wo_number: string; product_name?: string }[];
  onClose: () => void;
  onCreated: (jw: string) => void;
}) {
  const [vendorId, setVendorId] = useState(0);
  const [operationCode, setOperationCode] = useState("");
  const [outputProductId, setOutputProductId] = useState<number | null>(null);
  const [workOrderId, setWorkOrderId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(0);
  const [taxRate, setTaxRate] = useState(18);
  const [wastage, setWastage] = useState(5);
  const [orderDate, setOrderDate] = useState(getTodayDateString());
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      const v = vendors[0];
      setVendorId(v?.id ?? 0);
      setOperationCode(v?.capabilities[0] ?? "");
      setWastage(v?.agreed_wastage_pct ?? 5);
      setOutputProductId(products.find((p) => p.product_type === "sub_assembly")?.id ?? null);
      setWorkOrderId(null);
      setQty(1); setRate(0); setTaxRate(18);
      setOrderDate(getTodayDateString()); setDueDate("");
      setError(null);
    }
  }
  if (!isOpen) return null;

  const vendor = vendors.find((v) => v.id === vendorId);

  const pickVendor = (id: number) => {
    const v = vendors.find((x) => x.id === id);
    setVendorId(id);
    setOperationCode(v?.capabilities[0] ?? "");
    setWastage(v?.agreed_wastage_pct ?? 5);
  };

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await createJobWorkOrderAction({
      vendor_id: vendorId, operation_code: operationCode || null,
      work_order_id: workOrderId, output_product_id: outputProductId,
      expected_output_qty: qty, rate, tax_rate: taxRate,
      agreed_wastage_pct: wastage, order_date: orderDate, due_date: dueDate || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Failed"); return; }
    onCreated(res.jwNumber!);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><Send size={20} className="title-icon" /><span>New Job Work Order</span></h2>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Vendor *</label>
                <select className="form-select" value={vendorId} id="jw-vendor"
                  onChange={(e) => pickVendor(Number(e.target.value))}>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                {vendor && (
                  <span className="form-hint">
                    {vendor.capabilities.join(", ")} · {vendor.standard_lead_days}d lead ·{" "}
                    {vendor.gstin ? "registered" : "unregistered vendor"}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Operation</label>
                <select className="form-select" value={operationCode}
                  onChange={(e) => setOperationCode(e.target.value)}>
                  {(vendor?.capabilities ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Output Item</label>
                <select className="form-select" value={outputProductId ?? ""}
                  onChange={(e) => setOutputProductId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Same material back (processing only)</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Against Work Order</label>
                <select className="form-select" value={workOrderId ?? ""}
                  onChange={(e) => setWorkOrderId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Not linked</option>
                  {workOrders.map((w) => <option key={w.id} value={w.id}>{w.wo_number}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expected Output Qty *</label>
                <input type="number" min="1" step="any" className="form-input" value={qty} id="jw-qty"
                  onChange={(e) => setQty(Number(e.target.value) || 1)} />
              </div>
              <div className="form-group">
                <label className="form-label">Labour Rate per Unit (₹) *</label>
                <input type="number" min="0" step="any" className="form-input" value={rate} id="jw-rate"
                  onChange={(e) => setRate(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Tax Rate %</label>
                <input type="number" min="0" step="any" className="form-input" value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value) || 0)} />
                <span className="form-hint">Only creditable once registered</span>
              </div>
              <div className="form-group">
                <label className="form-label">Agreed Wastage %</label>
                <input type="number" min="0" step="any" className="form-input" value={wastage}
                  onChange={(e) => setWastage(Number(e.target.value) || 0)} />
                <span className="form-hint">Excess is recovered at material cost</span>
              </div>
              <div className="form-group">
                <label className="form-label">Order Date *</label>
                <input type="date" className="form-input" value={orderDate} required
                  onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-create-jw">
              {busy ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{closeBtnStyles}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
export function DispatchChallanModal({
  isOpen, order, materials, onClose, onDispatched,
}: {
  isOpen: boolean;
  order: JobWorkOrder | null;
  materials: Material[];
  onClose: () => void;
  onDispatched: (msg: string, warnings: string[]) => void;
}) {
  const [dispatchDate, setDispatchDate] = useState(getTodayDateString());
  const [rows, setRows] = useState<ChallanLineInput[]>([{ material_id: 0, quantity: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDispatchDate(getTodayDateString());
      setRows([{ material_id: materials[0]?.id ?? 0, quantity: 0 }]);
      setError(null);
    }
  }
  if (!isOpen || !order) return null;

  const update = (i: number, patch: Partial<ChallanLineInput>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const estValue = rows.reduce((s, r) => {
    const m = materials.find((x) => x.id === r.material_id);
    return s + r.quantity * (m?.standard_rate ?? 0);
  }, 0);

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await dispatchChallanAction({
      jw_order_id: order.id, dispatch_date: dispatchDate, lines: rows,
    });
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Failed"); return; }
    onDispatched(
      `${res.challanNumber} issued (${res.challanType === "rule_45" ? "Rule 45" : "internal"}) — ` +
      `${formatINR(res.value ?? 0)} moved to stock with vendor` +
      (res.ewayRequired ? ". E-way bill required." : res.ewayReason ? `. ${res.ewayReason}.` : ""),
      res.warnings ?? []
    );
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title"><Send size={20} className="title-icon" /><span>Dispatch to Vendor</span></h2>
            <p className="modal-sub">{order.jw_number} — {order.vendor_name}</p>
          </div>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            <div className="asset-note">
              This material stays <strong>your asset</strong>. It leaves the raw store and moves to
              &ldquo;stock with vendor&rdquo; — it is not consumed, and it must come back or be
              accounted for within the return deadline.
            </div>

            <div className="form-group" style={{ maxWidth: 220 }}>
              <label className="form-label">Dispatch Date *</label>
              <input type="date" className="form-input" value={dispatchDate} required
                onChange={(e) => setDispatchDate(e.target.value)} />
              <span className="form-hint">Sets the challan format and the return clock</span>
            </div>

            {rows.map((r, i) => {
              const m = materials.find((x) => x.id === r.material_id);
              return (
                <div className="disp-row" key={i}>
                  <select className="form-select" value={r.material_id} aria-label="Material"
                    onChange={(e) => update(i, { material_id: Number(e.target.value) })}>
                    {materials.map((mm) => (
                      <option key={mm.id} value={mm.id}>{mm.code} — {mm.name}</option>
                    ))}
                  </select>
                  <input type="number" min="0" step="any" className="form-input" value={r.quantity}
                    aria-label="Quantity" id={i === 0 ? "disp-qty-0" : undefined}
                    onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })} />
                  <span className="uom">{m?.stock_uom}</span>
                </div>
              );
            })}
            <button type="button" className="btn btn-secondary btn-sm"
              onClick={() => setRows((rs) => [...rs, { material_id: materials[0]?.id ?? 0, quantity: 0 }])}>
              Add Material
            </button>

            <div className="value-box">
              <span>Approximate consignment value</span>
              <strong>{formatINR(estValue)}</strong>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-dispatch">
              {busy ? "Dispatching..." : "Issue Challan"}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`
        ${closeBtnStyles}
        .asset-note {
          background: var(--accent-blue-soft); border: 1px solid #bae6fd; color: var(--accent-blue);
          border-radius: var(--radius-md); padding: 0.7rem 0.9rem;
          font-size: 0.82rem; line-height: 1.5; margin-bottom: 1rem;
        }
        .disp-row {
          display: grid; grid-template-columns: 1fr 110px 50px; gap: 0.5rem;
          align-items: center; margin-bottom: 0.6rem;
        }
        .uom { font-size: 0.8rem; color: var(--text-muted); }
        .value-box {
          margin-top: 1.1rem; display: flex; justify-content: space-between; align-items: center;
          background: var(--primary-soft); border: 1px solid var(--primary-soft-border);
          color: var(--primary); border-radius: var(--radius-md); padding: 0.7rem 0.95rem;
          font-size: 0.85rem;
        }
        .value-box strong { font-family: var(--font-heading); font-size: 1.15rem; }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
export function ReceiveJobWorkModal({
  isOpen, order, materials, onClose, onReceived,
}: {
  isOpen: boolean;
  order: JobWorkOrder | null;
  materials: Material[];
  onClose: () => void;
  onReceived: (recovery: number, warnings: string[]) => void;
}) {
  const [receiptDate, setReceiptDate] = useState(getTodayDateString());
  const [goodQty, setGoodQty] = useState(0);
  const [rejectedQty, setRejectedQty] = useState(0);
  const [reason, setReason] = useState("");
  const [scrapValue, setScrapValue] = useState(0);
  const [returns, setReturns] = useState<{ material_id: number; quantity: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen && order) {
      setReceiptDate(getTodayDateString());
      setGoodQty(order.expected_output_qty - (order.received_qty ?? 0));
      setRejectedQty(0); setReason(""); setScrapValue(0);
      setReturns([{ material_id: materials[0]?.id ?? 0, quantity: 0 }]);
      setError(null);
    }
  }
  if (!isOpen || !order) return null;

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await receiveJobWorkAction({
      jw_order_id: order.id, receipt_date: receiptDate,
      good_qty: goodQty, rejected_qty: rejectedQty,
      rejection_reason: reason || null, scrap_returned_value: scrapValue,
      material_returns: returns.filter((r) => r.quantity > 0),
    });
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Failed"); return; }
    onReceived(res.recovery ?? 0, res.warnings ?? []);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title"><PackageCheck size={20} className="title-icon" /><span>Receive from Vendor</span></h2>
            <p className="modal-sub">{order.jw_number} — {order.vendor_name}</p>
          </div>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Receipt Date *</label>
                <input type="date" className="form-input" value={receiptDate} required
                  onChange={(e) => setReceiptDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Scrap Returned (₹ value)</label>
                <input type="number" min="0" step="any" className="form-input" value={scrapValue}
                  onChange={(e) => setScrapValue(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Good Units *</label>
                <input type="number" min="0" step="any" className="form-input" value={goodQty} id="jw-good"
                  onChange={(e) => setGoodQty(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Rejected Units</label>
                <input type="number" min="0" step="any" className="form-input" value={rejectedQty} id="jw-rejected"
                  onChange={(e) => setRejectedQty(Number(e.target.value) || 0)} />
              </div>
            </div>

            {rejectedQty > 0 && (
              <div className="form-group">
                <label className="form-label">Rejection Reason *</label>
                <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Select...</option>
                  <option value="Polish defect">Polish defect</option>
                  <option value="Fabric pucker">Fabric pucker</option>
                  <option value="Joint gap">Joint gap</option>
                  <option value="Dimension error">Dimension error</option>
                  <option value="Shade mismatch">Shade mismatch</option>
                </select>
              </div>
            )}

            <h3 className="sec-title">Unused Material Returned</h3>
            {returns.map((r, i) => {
              const m = materials.find((x) => x.id === r.material_id);
              return (
                <div className="disp-row" key={i}>
                  <select className="form-select" value={r.material_id} aria-label="Returned material"
                    onChange={(e) => setReturns((rs) => rs.map((x, idx) =>
                      idx === i ? { ...x, material_id: Number(e.target.value) } : x))}>
                    {materials.map((mm) => (
                      <option key={mm.id} value={mm.id}>{mm.code} — {mm.name}</option>
                    ))}
                  </select>
                  <input type="number" min="0" step="any" className="form-input" value={r.quantity}
                    aria-label="Returned quantity" id={i === 0 ? "jw-return-0" : undefined}
                    onChange={(e) => setReturns((rs) => rs.map((x, idx) =>
                      idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} />
                  <span className="uom">{m?.stock_uom}</span>
                </div>
              );
            })}
            <p className="hint">
              Anything not returned counts as consumed. Consumption beyond the agreed{" "}
              {order.agreed_wastage_pct}% is recovered from the vendor at material cost.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-receive-jw">
              {busy ? "Receiving..." : "Post Receipt"}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`
        ${closeBtnStyles}
        .sec-title { font-size: 0.92rem; margin: 1.25rem 0 0.7rem; }
        .disp-row {
          display: grid; grid-template-columns: 1fr 110px 50px; gap: 0.5rem;
          align-items: center; margin-bottom: 0.6rem;
        }
        .uom { font-size: 0.8rem; color: var(--text-muted); }
        .hint { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.45; }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
export function VendorInvoiceModal({
  isOpen, order, onClose, onRecorded,
}: {
  isOpen: boolean;
  order: JobWorkOrder | null;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateString());
  const [qty, setQty] = useState(0);
  const [rate, setRate] = useState(0);
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen && order) {
      setInvoiceNo(""); setInvoiceDate(getTodayDateString());
      setQty(order.received_qty ?? 0);
      setRate(order.rate);
      setAmount(round2((order.received_qty ?? 0) * order.rate));
      setError(null);
    }
  }
  if (!isOpen || !order) return null;

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await recordVendorInvoiceAction({
      jw_order_id: order.id, invoice_no: invoiceNo, invoice_date: invoiceDate,
      qty, rate, amount,
    });
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Failed"); return; }
    onRecorded();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title"><Receipt size={20} className="title-icon" /><span>Vendor Invoice</span></h2>
            <p className="modal-sub">{order.jw_number} — {order.vendor_name}</p>
          </div>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}
            <p className="match-note">
              Recorded for three-way matching against the order and what was actually received.
              Payment stays blocked while any of the three disagree.
            </p>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Invoice No *</label>
                <input className="form-input" value={invoiceNo} id="inv-no" required
                  onChange={(e) => setInvoiceNo(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input type="date" className="form-input" value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Billed Quantity</label>
                <input type="number" min="0" step="any" className="form-input" value={qty} id="inv-qty"
                  onChange={(e) => setQty(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Billed Rate</label>
                <input type="number" min="0" step="any" className="form-input" value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Amount</label>
                <input type="number" min="0" step="any" className="form-input" value={amount} id="inv-amount"
                  onChange={(e) => setAmount(Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-save-invoice">
              {busy ? "Saving..." : "Record Invoice"}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`
        ${closeBtnStyles}
        .match-note {
          font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.6rem 0.8rem; margin-bottom: 1rem; line-height: 1.45;
        }
      `}</style>
    </div>
  );
}

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
