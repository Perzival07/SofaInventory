"use client";

import React, { useState } from "react";
import {
  ShoppingCart,
  Receipt,
  CreditCard,
  Plus,
  AlertTriangle,
  Printer,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import {
  FinishedGoodItem,
  SalesOrder,
  KhataAccount,
  DeliveryZone,
  LanguageCode,
} from "@/lib/types";
import { formatINR, formatDate } from "@/lib/formatters";
import { t } from "@/lib/i18n";
import { createSalesOrderAction, recordKhataPaymentAction } from "@/app/actions";

interface RetailSalesAndKhataProps {
  finishedGoods: FinishedGoodItem[];
  salesOrders: SalesOrder[];
  khataAccounts: KhataAccount[];
  deliveryZones: DeliveryZone[];
  lang: LanguageCode;
  onRefresh: () => void;
  taxEnabled: boolean;
}

export function RetailSalesAndKhata({
  finishedGoods,
  salesOrders,
  khataAccounts,
  deliveryZones,
  lang,
  onRefresh,
  taxEnabled,
}: RetailSalesAndKhataProps) {
  const [activeSubTab, setActiveSubTab] = useState<"sales" | "khata">("sales");
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(5000);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesOrder | null>(null);

  // New Sale Form State
  const [customerName, setCustomerName] = useState("Debabrata Roy");
  const [customerPhone, setCustomerPhone] = useState("9830887766");
  const [deliveryPincode, setDeliveryPincode] = useState("700124"); // Barasat
  const [selectedZone, setSelectedZone] = useState(deliveryZones[0]?.id || "ZONE_BARASAT_CHAMPADALI");
  const [floorLevel, setFloorLevel] = useState(2);
  const [hasLift, setHasLift] = useState(false); // 2nd floor, no lift -> triggers surcharge
  const [selectedProduct, setSelectedProduct] = useState<number>(finishedGoods[0]?.id || 1);
  const [quantity, setQuantity] = useState(1);
  const [paymentMode, setPaymentMode] = useState<SalesOrder["payment_mode"]>("CASH");
  const [amountPaid, setAmountPaid] = useState(30000);
  const [triggerWarnings, setTriggerWarnings] = useState<any[]>([]);

  // Pincode validation check for Section 24 interstate warning
  const isOutsideWB =
    deliveryPincode.trim().length === 6 &&
    !deliveryPincode.startsWith("70") &&
    !deliveryPincode.startsWith("71") &&
    !deliveryPincode.startsWith("72") &&
    !deliveryPincode.startsWith("73") &&
    !deliveryPincode.startsWith("74");

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = finishedGoods.find((f) => f.id === selectedProduct);
    if (!prod) return;

    const res = await createSalesOrderAction({
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_pincode: deliveryPincode,
      delivery_zone: selectedZone,
      floor_level: floorLevel,
      has_lift: hasLift,
      payment_mode: paymentMode,
      amount_paid: amountPaid,
      lines: [
        {
          product_id: prod.id,
          quantity: quantity,
          unit_price: prod.selling_price,
        },
      ],
    });

    if (res.warnings && res.warnings.length > 0) {
      setTriggerWarnings(res.warnings);
    } else {
      setTriggerWarnings([]);
    }

    setIsNewSaleOpen(false);
    onRefresh();
  };

  const handleKhataPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPaymentOpen) return;
    await recordKhataPaymentAction({
      khataId: isPaymentOpen,
      amount: paymentAmount,
      paymentMode: "CASH",
    });
    setIsPaymentOpen(null);
    onRefresh();
  };

  return (
    <div className="retail-root">
      <div className="retail-top-bar">
        <div className="sub-tab-pills">
          <button
            className={`sub-tab ${activeSubTab === "sales" ? "active" : ""}`}
            onClick={() => setActiveSubTab("sales")}
          >
            <Receipt size={16} />
            <span>Retail Orders & Invoices ({salesOrders.length})</span>
          </button>
          <button
            className={`sub-tab ${activeSubTab === "khata" ? "active" : ""}`}
            onClick={() => setActiveSubTab("khata")}
          >
            <CreditCard size={16} />
            <span>Khata / Udhaar Customer Ledger ({khataAccounts.length})</span>
          </button>
        </div>

        {activeSubTab === "sales" && (
          <button
            onClick={() => setIsNewSaleOpen(true)}
            className="btn btn-primary btn-sm"
            id="btn-create-retail-sale"
          >
            <Plus size={16} />
            <span>Create Retail Sale</span>
          </button>
        )}
      </div>

      {/* Warning banner if trigger warning fired */}
      {triggerWarnings.length > 0 && (
        <div className="trigger-warning-banner animate-fade">
          <AlertTriangle size={20} className="warning-icon" />
          <div>
            <strong>{triggerWarnings[0].title}</strong>
            <p>{triggerWarnings[0].message}</p>
          </div>
        </div>
      )}

      {activeSubTab === "sales" ? (
        /* Sales Orders Table */
        <div className="table-responsive-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Document #</th>
                <th>Type & Regime</th>
                <th>Customer</th>
                <th>Delivery Zone & Floor</th>
                <th>Payment Mode</th>
                <th>Taxable & Tax Split</th>
                <th>Total Value</th>
                <th>Paid / Balance</th>
                <th className="text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {salesOrders.map((so) => {
                const isTaxInvoice = so.document_type === "TAX_INVOICE";

                return (
                  <tr key={so.id} className="table-row">
                    <td>
                      <strong className="doc-num">{so.document_number}</strong>
                      <span className="block-hint">{formatDate(so.order_date)}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          isTaxInvoice ? "badge-tax-invoice" : "badge-cash-memo"
                        }`}
                      >
                        {isTaxInvoice ? "TAX INVOICE" : "CASH MEMO"}
                      </span>
                      <span className="block-hint">Regime: {so.regime_at_creation}</span>
                    </td>
                    <td>
                      <strong>{so.customer_name}</strong>
                      <span className="block-hint">{so.customer_phone}</span>
                    </td>
                    <td>
                      <span>{so.delivery_zone}</span>
                      <span className="block-hint">
                        Floor {so.floor_level} {so.has_lift ? "(With Lift)" : "(No Lift +₹" + so.floor_surcharge + ")"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-category">{so.payment_mode}</span>
                    </td>
                    <td>
                      {isTaxInvoice ? (
                        <div className="tax-split-info">
                          <span>Taxable: {formatINR(so.taxable_total || 0)}</span>
                          <span className="tax-sub">
                            CGST: {formatINR(so.cgst_total || 0)} | SGST: {formatINR(so.sgst_total || 0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">N/A (No Tax Columns)</span>
                      )}
                    </td>
                    <td>
                      <strong className="total-gold">{formatINR(so.grand_total)}</strong>
                    </td>
                    <td>
                      <span className="text-green">Paid: {formatINR(so.amount_paid)}</span>
                      {so.khata_balance_due > 0 && (
                        <span className="text-red-due">
                          Due: {formatINR(so.khata_balance_due)}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setSelectedInvoice(so)}
                        className="btn btn-secondary btn-icon-only btn-sm"
                        title="Print / View Bilingual Document"
                      >
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Khata Ledger */
        <div className="table-responsive-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Total Credit Granted</th>
                <th>Total Repaid</th>
                <th>Outstanding Balance</th>
                <th>Last Payment Date</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {khataAccounts.map((kh) => (
                <tr key={kh.id} className="table-row">
                  <td><strong>{kh.customer_name}</strong></td>
                  <td>{kh.customer_phone}</td>
                  <td>{kh.customer_address}</td>
                  <td>{formatINR(kh.total_credit_granted)}</td>
                  <td className="text-green">{formatINR(kh.total_paid)}</td>
                  <td>
                    <strong className="text-red-due">{formatINR(kh.current_balance)}</strong>
                  </td>
                  <td>{formatDate(kh.last_payment_date)}</td>
                  <td className="text-right">
                    {kh.current_balance > 0 ? (
                      <button
                        onClick={() => {
                          setIsPaymentOpen(kh.id);
                          setPaymentAmount(Math.min(5000, kh.current_balance));
                        }}
                        className="btn btn-primary btn-xs"
                      >
                        Receive Payment
                      </button>
                    ) : (
                      <span className="badge badge-in-stock">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Sale Modal */}
      {isNewSaleOpen && (
        <div className="modal-overlay" onClick={() => setIsNewSaleOpen(false)}>
          <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {taxEnabled ? "Generate Statutory Tax Invoice" : "Generate Cash Memo / Bill of Supply"}
              </h3>
              <button onClick={() => setIsNewSaleOpen(false)} className="btn-icon-close">
                ×
              </button>
            </div>
            <form onSubmit={handleSaleSubmit}>
              <div className="modal-body">
                {isOutsideWB && (
                  <div className="modal-alert-danger">
                    ⚠️ <strong>SECTION 24 ALERT:</strong> Pincode {deliveryPincode} is OUTSIDE West Bengal! Making an interstate supply revokes the ₹40 Lakh threshold and requires compulsory GST registration!
                  </div>
                )}

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Customer Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile Number *</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Delivery Pincode *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={deliveryPincode}
                      onChange={(e) => setDeliveryPincode(e.target.value)}
                      required
                    />
                    <span className="form-hint">Must be in West Bengal (70xxxx-74xxxx) to maintain unregistered status</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Delivery Zone (Barasat - Kolkata Belt)</label>
                    <select
                      className="form-select"
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value)}
                    >
                      {deliveryZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} (+₹{z.default_charge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Floor Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={floorLevel}
                      onChange={(e) => setFloorLevel(Math.max(0, parseInt(e.target.value) || 0))}
                      min="0"
                    />
                    <span className="form-hint">0 = Ground floor</span>
                  </div>

                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={hasLift}
                        onChange={(e) => setHasLift(e.target.checked)}
                      />
                      <span>Building has working service lift</span>
                    </label>
                    {!hasLift && floorLevel >= 2 && (
                      <span className="surcharge-notice">
                        +₹{(floorLevel - 1) * 250} floor carrying surcharge applies
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Select Furniture Model *</label>
                    <select
                      className="form-select"
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(parseInt(e.target.value))}
                    >
                      {finishedGoods.map((fg) => (
                        <option key={fg.id} value={fg.id}>
                          {fg.name} ({formatINR(fg.selling_price)}) - {fg.current_quantity} in stock
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select
                      className="form-select"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                    >
                      <option value="CASH">Cash Payment</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="KHATA_CREDIT">Khata / Udhaar (Part Payment)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Amount Paid Today (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                    <span className="form-hint">Balance automatically posts to Khata ledger</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewSaleOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm & Issue {taxEnabled ? "Tax Invoice" : "Cash Memo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bilingual Print Preview Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Bilingual Receipt Print Preview</h3>
              <button onClick={() => setSelectedInvoice(null)} className="btn-icon-close">
                ×
              </button>
            </div>
            <div className="modal-body print-area">
              <div className="bill-header">
                <h2>দ্য সোফা স্টুডিও অ্যান্ড ফার্নিচার কোং</h2>
                <h3>The Sofa Studio & Furniture Co.</h3>
                <p>বারাসাত, উত্তর ২৪ পরগণা, পশ্চিমবঙ্গ - ৭০০১২৪ | Barasat, North 24 Parganas - 700124</p>
                <div className="bill-type-banner">
                  {selectedInvoice.document_type === "TAX_INVOICE"
                    ? "ট্যাক্স ইনভয়েস / TAX INVOICE"
                    : "ক্যাশ মেমো / CASH MEMO (BILL OF SUPPLY)"}
                </div>
              </div>

              <div className="bill-meta-grid">
                <div>
                  <p><strong>Document #:</strong> {selectedInvoice.document_number}</p>
                  <p><strong>Date:</strong> {formatDate(selectedInvoice.order_date)}</p>
                  <p><strong>Regime:</strong> {selectedInvoice.regime_at_creation}</p>
                </div>
                <div>
                  <p><strong>Customer:</strong> {selectedInvoice.customer_name}</p>
                  <p><strong>Mobile:</strong> {selectedInvoice.customer_phone}</p>
                  <p><strong>Delivery:</strong> {selectedInvoice.delivery_zone} (Pin: {selectedInvoice.delivery_pincode})</p>
                </div>
              </div>

              <table className="bill-items-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>HSN</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    {selectedInvoice.document_type === "TAX_INVOICE" && <th>Tax Split</th>}
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.product_name}</td>
                      <td>{l.hsn_code || "9401"}</td>
                      <td>{l.quantity}</td>
                      <td>{formatINR(l.unit_price)}</td>
                      {selectedInvoice.document_type === "TAX_INVOICE" && (
                        <td>
                          CGST: {formatINR(l.cgst_amount || 0)}<br />
                          SGST: {formatINR(l.sgst_amount || 0)}
                        </td>
                      )}
                      <td className="text-right">{formatINR(l.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bill-footer-totals">
                <p>Subtotal: {formatINR(selectedInvoice.subtotal)}</p>
                {selectedInvoice.floor_surcharge > 0 && (
                  <p>Floor Surcharge (No Lift): {formatINR(selectedInvoice.floor_surcharge)}</p>
                )}
                {selectedInvoice.document_type === "TAX_INVOICE" && (
                  <p>Total GST: {formatINR((selectedInvoice.cgst_total || 0) + (selectedInvoice.sgst_total || 0))}</p>
                )}
                <h3 className="bill-grand-total">Grand Total: {formatINR(selectedInvoice.grand_total)}</h3>
                <p className="text-green">Paid: {formatINR(selectedInvoice.amount_paid)}</p>
                {selectedInvoice.khata_balance_due > 0 && (
                  <p className="text-red-due">Balance in Khata: {formatINR(selectedInvoice.khata_balance_due)}</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedInvoice(null)}
              >
                Close Preview
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Khata Payment Modal */}
      {isPaymentOpen && (
        <div className="modal-overlay" onClick={() => setIsPaymentOpen(null)}>
          <div className="modal-dialog modal-dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record Khata Installment Payment</h3>
              <button onClick={() => setIsPaymentOpen(null)} className="btn-icon-close">
                ×
              </button>
            </div>
            <form onSubmit={handleKhataPaymentSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Payment Amount (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsPaymentOpen(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Post Payment & Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .retail-root {
          margin-top: 1rem;
        }

        .retail-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .sub-tab-pills {
          display: flex;
          gap: 0.5rem;
        }

        .sub-tab {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .sub-tab.active {
          background: var(--bg-surface-elevated);
          color: var(--primary);
          border-color: var(--primary);
        }

        .trigger-warning-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: var(--radius-md);
          padding: 0.85rem 1.15rem;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          color: #fca5a5;
          font-size: 0.85rem;
        }

        .warning-icon {
          color: #ef4444;
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        .doc-num {
          font-family: monospace;
          color: var(--text-primary);
        }

        .badge-cash-memo {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .badge-tax-invoice {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .block-hint {
          display: block;
          font-size: 0.725rem;
          color: var(--text-muted);
        }

        .tax-split-info {
          display: flex;
          flex-direction: column;
          font-size: 0.775rem;
        }

        .tax-sub {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .total-gold {
          font-family: var(--font-heading);
          color: #fbbf24;
          font-size: 1.05rem;
        }

        .text-green {
          display: block;
          color: #34d399;
          font-weight: 600;
          font-size: 0.825rem;
        }

        .text-red-due {
          display: block;
          color: #f87171;
          font-weight: 700;
          font-size: 0.825rem;
        }

        .form-row-2col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (min-width: 520px) {
          .form-row-2col {
            grid-template-columns: 1fr 1fr;
          }
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-primary);
          cursor: pointer;
        }

        .surcharge-notice {
          font-size: 0.75rem;
          color: #fbbf24;
          margin-top: 0.25rem;
        }

        .modal-alert-danger {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.825rem;
          margin-bottom: 1rem;
        }

        /* Print Bill Styles */
        .print-area {
          background: #ffffff;
          color: #0b0f17;
          padding: 2rem;
          border-radius: var(--radius-md);
          font-family: var(--font-body);
        }

        .bill-header {
          text-align: center;
          border-bottom: 2px solid #0b0f17;
          padding-bottom: 1rem;
          margin-bottom: 1.25rem;
        }

        .bill-header h2 {
          color: #0b0f17;
          font-size: 1.4rem;
          margin-bottom: 0.2rem;
        }

        .bill-header h3 {
          color: #475569;
          font-size: 1.05rem;
          margin-bottom: 0.35rem;
        }

        .bill-header p {
          font-size: 0.8rem;
          color: #64748b;
        }

        .bill-type-banner {
          display: inline-block;
          background: #0b0f17;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.85rem;
          padding: 0.25rem 0.85rem;
          margin-top: 0.65rem;
          border-radius: 4px;
        }

        .bill-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-size: 0.825rem;
          margin-bottom: 1.25rem;
          color: #334155;
        }

        .bill-items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
          margin-bottom: 1.5rem;
        }

        .bill-items-table th {
          border-bottom: 2px solid #cbd5e1;
          padding: 0.5rem;
          text-align: left;
          color: #1e293b;
        }

        .bill-items-table td {
          border-bottom: 1px solid #e2e8f0;
          padding: 0.65rem 0.5rem;
          color: #334155;
        }

        .bill-footer-totals {
          text-align: right;
          font-size: 0.9rem;
          line-height: 1.6;
          border-top: 1px solid #cbd5e1;
          padding-top: 0.75rem;
        }

        .bill-grand-total {
          font-size: 1.25rem;
          color: #0b0f17;
          margin: 0.35rem 0;
        }

        .btn-xs {
          font-size: 0.75rem;
          padding: 0.3rem 0.6rem;
          min-height: 30px;
        }
      `}</style>
    </div>
  );
}
