"use client";

import { useState, type SubmitEvent } from "react";
import { X, ShoppingCart, UserPlus, Wallet, PackagePlus, AlertTriangle, Ban } from "lucide-react";
import { Product } from "@/lib/erp-types";
import {
  Customer, FinishedUnit, SalesOrder, DeliveryZone, ConditionGrade,
  CONDITION_LABELS, PaymentMode, RegistrationTrigger, SalesChannel, KhataAccount,
} from "@/lib/sales-types";
import { RegimeState } from "@/lib/tax-types";
import { formatINR, getTodayDateString } from "@/lib/formatters";
import { computeDelivery, registrationTriggers, canBillAsNew } from "@/lib/sales-logic";
import {
  createSalesOrderAction, createCustomerAction,
  createFinishedUnitAction, recordPaymentAction,
} from "@/app/sales-actions";

const shared = `
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
  .grid-3 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
  @media (min-width: 640px) { .grid-3 { grid-template-columns: repeat(3, 1fr); } }
`;

// -----------------------------------------------------------------------------
interface OrderLineDraft {
  product_id: number;
  finished_unit_id: number | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export function CreateOrderModal({
  isOpen, customers, products, sellableUnits, zones, regime, onClose, onCreated,
}: {
  isOpen: boolean;
  customers: Customer[];
  products: Product[];
  sellableUnits: FinishedUnit[];
  zones: DeliveryZone[];
  regime: RegimeState;
  onClose: () => void;
  onCreated: (orderNumber: string, docType: string, total: number, triggers: RegistrationTrigger[]) => void;
}) {
  const [customerId, setCustomerId] = useState(0);
  const [orderDate, setOrderDate] = useState(getTodayDateString());
  const [channel, setChannel] = useState<SalesChannel>("walk_in");
  const [zoneCode, setZoneCode] = useState("BARASAT");
  const [floor, setFloor] = useState(0);
  const [hasLift, setHasLift] = useState(false);
  const [servicesItemised, setServicesItemised] = useState(false);
  const [advance, setAdvance] = useState(0);
  const [isQuote, setIsQuote] = useState(false);
  const [promisedDate, setPromisedDate] = useState("");
  const [lines, setLines] = useState<OrderLineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      const c = customers[0];
      setCustomerId(c?.id ?? 0);
      setZoneCode(c?.zone_code ?? "BARASAT");
      setOrderDate(getTodayDateString());
      setChannel("walk_in"); setFloor(0); setHasLift(false);
      setServicesItemised(false); setAdvance(0); setIsQuote(false); setPromisedDate("");
      setLines([{
        product_id: products.find((p) => p.product_type === "finished")?.id ?? 0,
        finished_unit_id: null, quantity: 1, unit_price: 0, tax_rate: 18,
      }]);
      setError(null);
    }
  }
  if (!isOpen) return null;

  const customer = customers.find((c) => c.id === customerId);
  const delivery = computeDelivery(zoneCode, floor, hasLift);

  // Warnings computed live, so the salesperson sees them before committing.
  const triggers = registrationTriggers({
    regime, zoneCode, channel, servicesItemised,
    buyerGstin: customer?.gstin ?? null,
  });
  const blocking = triggers.filter((t) => t.severity === "blocking");

  const update = (i: number, patch: Partial<OrderLineDraft>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickUnit = (i: number, unitId: number | null) => {
    const u = sellableUnits.find((x) => x.id === unitId);
    update(i, {
      finished_unit_id: unitId,
      ...(u ? { product_id: u.product_id, unit_price: u.list_price } : {}),
    });
  };

  const goodsTotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const grandTotal = goodsTotal + delivery.total_charge;

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);

    const res = await createSalesOrderAction({
      customer_id: customerId, order_date: orderDate, channel,
      zone_code: zoneCode, floor, has_lift: hasLift,
      services_itemised: servicesItemised, advance_paid: advance,
      is_quote: isQuote, promised_date: promisedDate || null,
      lines: lines.filter((l) => l.product_id > 0).map((l) => ({
        product_id: l.product_id, finished_unit_id: l.finished_unit_id,
        quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
      })),
    });

    setBusy(false);
    if (!res.success) { setError(res.error ?? "Failed"); return; }
    onCreated(res.orderNumber!, res.documentType!, res.total ?? 0, res.triggers ?? []);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              <ShoppingCart size={20} className="title-icon" /><span>New Sale</span>
            </h2>
            <p className="modal-sub">
              Will be raised as a{" "}
              <strong>{regime.sales_document_type.replace(/_/g, " ")}</strong>
            </p>
          </div>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}

            {triggers.map((t) => (
              <div className={`trigger ${t.severity}`} key={t.code}>
                {t.severity === "blocking" ? <Ban size={16} /> : <AlertTriangle size={16} />}
                <span>{t.message}</span>
              </div>
            ))}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Customer *</label>
                <select className="form-select" value={customerId} id="so-customer"
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setCustomerId(id);
                    const c = customers.find((x) => x.id === id);
                    if (c?.zone_code) setZoneCode(c.zone_code);
                  }}>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.phone}{c.gstin ? " (GST)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order Date *</label>
                <input type="date" className="form-input" value={orderDate} required
                  onChange={(e) => setOrderDate(e.target.value)} />
                <span className="form-hint">Decides the document type</span>
              </div>
              <div className="form-group">
                <label className="form-label">Channel</label>
                <select className="form-select" value={channel} id="so-channel"
                  onChange={(e) => setChannel(e.target.value as SalesChannel)}>
                  <option value="walk_in">Walk-in</option>
                  <option value="phone">Phone</option>
                  <option value="referral">Referral</option>
                  <option value="ecommerce">E-commerce marketplace</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Promised Delivery</label>
                <input type="date" className="form-input" value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)} />
              </div>
            </div>

            <h3 className="sec">Items</h3>
            {lines.map((l, i) => {
              const unit = sellableUnits.find((u) => u.id === l.finished_unit_id);
              return (
                <div className="line-card" key={i}>
                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">Product</label>
                      <select className="form-select" value={l.product_id}
                        onChange={(e) => update(i, { product_id: Number(e.target.value), finished_unit_id: null })}>
                        {products.filter((p) => p.product_type === "finished").map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Specific Unit</label>
                      <select className="form-select" value={l.finished_unit_id ?? ""}
                        onChange={(e) => pickUnit(i, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">Make to order</option>
                        {sellableUnits.filter((u) => u.product_id === l.product_id).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.serial_no} — {CONDITION_LABELS[u.condition_grade]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Qty</label>
                      <input type="number" min="1" step="any" className="form-input"
                        value={l.quantity} disabled={Boolean(l.finished_unit_id)}
                        onChange={(e) => update(i, { quantity: Number(e.target.value) || 1 })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price (₹) *</label>
                      <input type="number" min="0" step="any" className="form-input"
                        value={l.unit_price} id={i === 0 ? "so-price-0" : undefined}
                        onChange={(e) => update(i, { unit_price: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tax %</label>
                      <input type="number" min="0" step="any" className="form-input"
                        value={l.tax_rate}
                        onChange={(e) => update(i, { tax_rate: Number(e.target.value) || 0 })} />
                      <span className="form-hint">
                        {regime.registered ? "Broken out of price" : "Dormant"}
                      </span>
                    </div>
                    <div className="form-group line-remove">
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))}
                        disabled={lines.length === 1}>Remove</button>
                    </div>
                  </div>

                  {unit && !canBillAsNew(unit.condition_grade) && (
                    <div className="grade-note">
                      <AlertTriangle size={14} />
                      <span>
                        {unit.serial_no} is a <strong>{CONDITION_LABELS[unit.condition_grade]}</strong> —
                        it must not be described as new on the bill.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <button type="button" className="btn btn-secondary btn-sm"
              onClick={() => setLines((ls) => [...ls, {
                product_id: products.find((p) => p.product_type === "finished")?.id ?? 0,
                finished_unit_id: null, quantity: 1, unit_price: 0, tax_rate: 18,
              }])}>Add Item</button>

            <h3 className="sec">Delivery</h3>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Zone</label>
                <select className="form-select" value={zoneCode} id="so-zone"
                  onChange={(e) => setZoneCode(e.target.value)}>
                  {zones.map((z) => (
                    <option key={z.code} value={z.code}>{z.name} — {z.bengali_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Floor</label>
                <input type="number" min="0" step="1" className="form-input" value={floor}
                  onChange={(e) => setFloor(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group lift-field">
                <label className="check">
                  <input type="checkbox" checked={hasLift}
                    onChange={(e) => setHasLift(e.target.checked)} />
                  <span>Lift available</span>
                </label>
              </div>
            </div>

            <div className="delivery-box">
              <span>
                {delivery.vehicle} · {delivery.crew_size} crew · base {formatINR(delivery.base_charge)}
                {delivery.floor_surcharge > 0 && ` + ${formatINR(delivery.floor_surcharge)} carry`}
              </span>
              <strong>{formatINR(delivery.total_charge)}</strong>
            </div>

            <label className="check itemise">
              <input type="checkbox" checked={servicesItemised} id="so-itemised"
                onChange={(e) => setServicesItemised(e.target.checked)} />
              <span>
                Bill delivery and assembly as separate lines
                <em> — the safe default is to roll them into the product price</em>
              </span>
            </label>

            <div className="grid-2 advance-row">
              <div className="form-group">
                <label className="form-label">Advance / Token (₹)</label>
                <input type="number" min="0" step="any" className="form-input" value={advance}
                  id="so-advance" onChange={(e) => setAdvance(Number(e.target.value) || 0)} />
                <span className="form-hint">Recorded as a payment against the khata</span>
              </div>
              <div className="form-group quote-field">
                <label className="check">
                  <input type="checkbox" checked={isQuote} id="so-isquote"
                    onChange={(e) => setIsQuote(e.target.checked)} />
                  <span>
                    Quotation only — 48-hour soft hold
                    <em> — not counted as turnover until confirmed</em>
                  </span>
                </label>
              </div>
            </div>

            <div className="totals">
              <div><span>Goods</span><span>{formatINR(goodsTotal)}</span></div>
              <div><span>Delivery</span><span>{formatINR(delivery.total_charge)}</span></div>
              <div className="grand"><span>Customer pays</span><span>{formatINR(grandTotal)}</span></div>
              <div><span>Balance after advance</span><span>{formatINR(grandTotal - advance)}</span></div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-save-order">
              {busy ? "Saving..." : blocking.length ? "Raise Anyway" : "Raise Bill"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        ${shared}
        .modal-wide { max-width: 880px; }
        .sec { font-size: 0.95rem; margin: 1.35rem 0 0.75rem; }
        .line-card {
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.85rem; margin-bottom: 0.7rem; background: var(--bg-surface-elevated);
        }
        .line-remove { display: flex; align-items: flex-end; }
        .grade-note {
          display: flex; gap: 0.45rem; align-items: flex-start; margin-top: 0.65rem;
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text); border-radius: var(--radius-sm);
          padding: 0.5rem 0.7rem; font-size: 0.78rem; line-height: 1.4;
        }
        .trigger {
          display: flex; gap: 0.55rem; align-items: flex-start; border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem; font-size: 0.82rem; line-height: 1.5; margin-bottom: 0.7rem;
        }
        .trigger.warning {
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text);
        }
        .trigger.blocking {
          background: var(--status-out-stock-bg); border: 1px solid var(--status-out-stock-border);
          color: var(--status-out-stock-text); font-weight: 500;
        }
        .check {
          display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.85rem;
          color: var(--text-secondary); cursor: pointer; line-height: 1.45;
        }
        .check input { margin-top: 0.15rem; width: 16px; height: 16px; accent-color: var(--primary); flex-shrink: 0; }
        .check em { font-style: normal; color: var(--text-muted); }
        .lift-field { display: flex; align-items: flex-end; padding-bottom: 0.6rem; }
        .itemise { margin: 0.9rem 0; }
        .delivery-box {
          display: flex; justify-content: space-between; align-items: center; gap: 1rem;
          background: var(--accent-blue-soft); border: 1px solid #bae6fd; color: var(--accent-blue);
          border-radius: var(--radius-md); padding: 0.65rem 0.9rem; font-size: 0.82rem; margin-top: 0.5rem;
        }
        .advance-row { margin-top: 0.5rem; }
        .quote-field { display: flex; align-items: flex-end; padding-bottom: 0.6rem; }
        .totals {
          margin-top: 1.15rem; background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem 1.1rem;
        }
        .totals > div {
          display: flex; justify-content: space-between; font-size: 0.875rem;
          padding: 0.2rem 0; color: var(--text-secondary);
        }
        .totals .grand {
          border-top: 1px solid var(--border-hover); margin-top: 0.4rem; padding-top: 0.5rem;
          font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; color: var(--primary);
        }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
export function AddCustomerModal({
  isOpen, zones, onClose, onCreated,
}: {
  isOpen: boolean; zones: DeliveryZone[];
  onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zoneCode, setZoneCode] = useState("BARASAT");
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) { setName(""); setPhone(""); setAddress(""); setZoneCode("BARASAT"); setGstin(""); setError(null); }
  }
  if (!isOpen) return null;

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const zone = zones.find((z) => z.code === zoneCode);
    const res = await createCustomerAction({
      name, phone, address: address || null, zone_code: zoneCode,
      gstin: gstin || null, state_code: zone?.outside_state ? "00" : "19",
    });
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Failed"); return; }
    onCreated(); onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><UserPlus size={20} className="title-icon" /><span>New Customer</span></h2>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={name} required id="cust-name"
                  onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-input" value={phone} required id="cust-phone"
                  onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Zone</label>
                <select className="form-select" value={zoneCode}
                  onChange={(e) => setZoneCode(e.target.value)}>
                  {zones.map((z) => <option key={z.code} value={z.code}>{z.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN (B2B only)</label>
                <input className="form-input" value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={address}
                onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-save-customer">
              {busy ? "Saving..." : "Add Customer"}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{shared}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
export function AddUnitModal({
  isOpen, products, onClose, onCreated,
}: {
  isOpen: boolean; products: Product[];
  onClose: () => void; onCreated: (serial: string) => void;
}) {
  const [productId, setProductId] = useState(0);
  const [grade, setGrade] = useState<ConditionGrade>("new_in_box");
  const [cost, setCost] = useState(0);
  const [price, setPrice] = useState(0);
  const [cartonTotal, setCartonTotal] = useState(1);
  const [cartonsPresent, setCartonsPresent] = useState(1);
  const [floorSince, setFloorSince] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setProductId(products.find((p) => p.product_type === "finished")?.id ?? 0);
      setGrade("new_in_box"); setCost(0); setPrice(0);
      setCartonTotal(1); setCartonsPresent(1); setFloorSince(""); setError(null);
    }
  }
  if (!isOpen) return null;

  const incomplete = cartonsPresent < cartonTotal;

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await createFinishedUnitAction({
      product_id: productId, condition_grade: grade, cost, list_price: price,
      carton_total: cartonTotal, cartons_present: cartonsPresent,
      floor_since: grade === "floor_model" ? (floorSince || getTodayDateString()) : null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Failed"); return; }
    onCreated(res.serial!); onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><PackagePlus size={20} className="title-icon" /><span>Add Finished Unit</span></h2>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-select" value={productId} id="unit-product"
                  onChange={(e) => setProductId(Number(e.target.value))}>
                  {products.filter((p) => p.product_type === "finished").map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Condition</label>
                <select className="form-select" value={grade} id="unit-grade"
                  onChange={(e) => setGrade(e.target.value as ConditionGrade)}>
                  {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Actual Cost (₹) *</label>
                <input type="number" min="0" step="any" className="form-input" value={cost}
                  id="unit-cost" onChange={(e) => setCost(Number(e.target.value) || 0)} />
                <span className="form-hint">Drives true margin, not a standard rate</span>
              </div>
              <div className="form-group">
                <label className="form-label">List Price (₹) *</label>
                <input type="number" min="0" step="any" className="form-input" value={price}
                  id="unit-price" onChange={(e) => setPrice(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Total Cartons</label>
                <input type="number" min="1" step="1" className="form-input" value={cartonTotal}
                  onChange={(e) => setCartonTotal(Number(e.target.value) || 1)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cartons Present</label>
                <input type="number" min="0" step="1" className="form-input" value={cartonsPresent}
                  id="unit-cartons" onChange={(e) => setCartonsPresent(Number(e.target.value) || 0)} />
              </div>
            </div>

            {grade === "floor_model" && (
              <div className="form-group">
                <label className="form-label">On the floor since</label>
                <input type="date" className="form-input" value={floorSince}
                  onChange={(e) => setFloorSince(e.target.value)} />
                <span className="form-hint">Flagged for markdown after 90 days</span>
              </div>
            )}

            {incomplete && (
              <div className="warn">
                <AlertTriangle size={15} />
                <span>
                  {cartonsPresent} of {cartonTotal} cartons — this unit will be held back
                  from sale until the set is complete.
                </span>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-save-unit">
              {busy ? "Saving..." : "Add Unit"}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`
        ${shared}
        .warn {
          display: flex; gap: 0.5rem; align-items: flex-start; margin-top: 0.9rem;
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text); border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem; font-size: 0.82rem; line-height: 1.45;
        }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
export function PaymentModal({
  isOpen, account, orders, onClose, onRecorded,
}: {
  isOpen: boolean; account: KhataAccount | null; orders: SalesOrder[];
  onClose: () => void; onRecorded: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(getTodayDateString());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen && account) {
      setAmount(account.balance); setMode("cash"); setOrderId(null);
      setReference(""); setDate(getTodayDateString()); setError(null);
    }
  }
  if (!isOpen || !account) return null;

  const custOrders = orders.filter(
    (o) => o.customer_id === account.customer_id && o.balance_due > 0
  );

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await recordPaymentAction({
      customer_id: account.customer_id, order_id: orderId,
      entry_date: date, amount, mode, reference: reference || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Failed"); return; }
    onRecorded(); onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title"><Wallet size={20} className="title-icon" /><span>Record Payment</span></h2>
            <p className="modal-sub">{account.customer_name} · outstanding {formatINR(account.balance)}</p>
          </div>
          <button onClick={onClose} className="btn-icon-close" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="modal-alert-error">{error}</div>}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input type="number" min="0" step="any" className="form-input" value={amount}
                  id="pay-amount" onChange={(e) => setAmount(Number(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select className="form-select" value={mode} id="pay-mode"
                  onChange={(e) => setMode(e.target.value as PaymentMode)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank transfer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Against Bill</label>
                <select className="form-select" value={orderId ?? ""}
                  onChange={(e) => setOrderId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">General account payment</option>
                  {custOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {formatINR(o.balance_due)} due
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={date}
                  onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reference (UPI ref / receipt no)</label>
              <input className="form-input" value={reference}
                onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} id="btn-save-payment">
              {busy ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{shared}</style>
    </div>
  );
}
