"use client";

import React, { useState } from "react";
import { X, FileSpreadsheet, AlertTriangle, ShieldCheck, CheckCircle2, Download } from "lucide-react";
import { TaxConfig, LanguageCode } from "@/lib/types";
import { toggleTaxRegimeAction, fetchTransitionalCreditReportAction } from "@/app/actions";
import { formatINR } from "@/lib/formatters";

interface TaxRegimeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TaxConfig;
  lang: LanguageCode;
  onConfigUpdated: () => void;
}

export function TaxRegimeSettingsModal({
  isOpen,
  onClose,
  config,
  lang,
  onConfigUpdated,
}: TaxRegimeSettingsModalProps) {
  const [isEnabled, setIsEnabled] = useState(config.tax_regime_enabled);
  const [gstin, setGstin] = useState(config.registration_number || "19AAAAA0000A1Z5");
  const [regDate, setRegDate] = useState(
    config.registration_date || new Date().toISOString().slice(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [transitionalData, setTransitionalData] = useState<any>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await toggleTaxRegimeAction({
        enabled: isEnabled,
        gstin: isEnabled ? gstin : undefined,
        registrationDate: isEnabled ? regDate : undefined,
      });
      onConfigUpdated();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchTransitionalCredit = async () => {
    try {
      setIsDownloadingReport(true);
      const rep = await fetchTransitionalCreditReportAction();
      setTransitionalData(rep);
    } finally {
      setIsDownloadingReport(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="title-group">
            <ShieldCheck size={22} className="modal-title-icon" />
            <div>
              <h2 className="modal-title">GST Tax Regime Architecture Controls</h2>
              <p className="modal-subtitle">
                Section 2.1 Configuration Flag — Switch between Unregistered & Registered modes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon-close" title="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            {/* Primary Toggle Switch */}
            <div className="regime-toggle-card">
              <div className="toggle-left">
                <h4 className="toggle-heading">Enable GST Tax Regime (tax_regime_enabled)</h4>
                <p className="toggle-desc">
                  When enabled, sales switch to statutory Tax Invoices with CGST/SGST, purchase
                  tax is booked to ITC ledger, Rule 45 challans are generated, and GSTR exports
                  activate.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  id="toggle-tax-regime"
                />
                <span className="slider round"></span>
              </label>
            </div>

            {isEnabled && (
              <div className="registered-fields animate-fade">
                <div className="form-group">
                  <label className="form-label">GSTIN (Registration Number) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="19AAAAA0000A1Z5"
                    required
                  />
                  <span className="form-hint">
                    15-digit GSTIN starting with 19 (West Bengal code)
                  </span>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Effective Registration Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={regDate}
                      onChange={(e) => setRegDate(e.target.value)}
                      required
                    />
                    <span className="form-hint">
                      Switchover is effective-dated; historical sales remain Cash Memos forever
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Home State Code</label>
                    <input
                      type="text"
                      className="form-input"
                      value="19 - West Bengal"
                      disabled
                    />
                    <span className="form-hint">Governs intra-state CGST + SGST vs IGST</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 18(1)(a) Transitional Credit Section (Section 2.3 Rule 5) */}
            <div className="transitional-credit-box">
              <div className="transitional-header">
                <div>
                  <h4 className="transitional-title">
                    <FileSpreadsheet size={18} />
                    <span>Section 18(1)(a) Transitional Credit Report</span>
                  </h4>
                  <p className="transitional-desc">
                    Required on registration day: Claims back input tax credit embedded in raw
                    material and stock on hand.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFetchTransitionalCredit}
                  className="btn btn-secondary btn-sm"
                  disabled={isDownloadingReport}
                >
                  <Download size={14} />
                  <span>{isDownloadingReport ? "Compiling..." : "Generate Report"}</span>
                </button>
              </div>

              {transitionalData && (
                <div className="transitional-summary animate-fade">
                  <div className="sum-item">
                    <span className="sum-label">Stock Batches Audited:</span>
                    <span className="sum-val">{transitionalData.total_stock_items_count} lots</span>
                  </div>
                  <div className="sum-item">
                    <span className="sum-label">Total Stock Value:</span>
                    <span className="sum-val">
                      {formatINR(transitionalData.total_inventory_value_inclusive)}
                    </span>
                  </div>
                  <div className="sum-item highlight-itc">
                    <span className="sum-label">Claimable Input Tax Credit:</span>
                    <span className="sum-val value-gold">
                      {formatINR(transitionalData.total_claimable_itc)}
                    </span>
                  </div>

                  <div className="transitional-table-wrapper">
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>Material & HSN</th>
                          <th>Qty</th>
                          <th>Supplier Invoice</th>
                          <th>Claimable ITC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transitionalData.items.map((it: any, idx: number) => (
                          <tr key={idx}>
                            <td>
                              <strong>{it.material_name}</strong> (HSN: {it.hsn_code})
                            </td>
                            <td>
                              {it.quantity_on_hand} {it.uom}
                            </td>
                            <td>{it.supplier_invoice_ref}</td>
                            <td className="text-gold">
                              {formatINR(it.eligible_input_tax_credit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              id="btn-save-tax-regime"
            >
              {isSubmitting ? "Saving..." : "Save Tax Regime Configuration"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-dialog-lg {
          max-width: 680px;
        }

        .title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .modal-title-icon {
          color: var(--primary);
        }

        .modal-subtitle {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .btn-icon-close {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .regime-toggle-card {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .toggle-heading {
          font-size: 1rem;
          margin: 0;
          color: var(--text-primary);
        }

        .toggle-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
          line-height: 1.4;
        }

        /* Switch CSS */
        .switch {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
          flex-shrink: 0;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background-color: rgba(255, 255, 255, 0.2);
          transition: 0.3s;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: 0.3s;
        }

        input:checked + .slider {
          background-color: var(--primary);
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        .slider.round {
          border-radius: 34px;
        }

        .slider.round:before {
          border-radius: 50%;
        }

        .registered-fields {
          background: rgba(56, 189, 248, 0.05);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: var(--radius-md);
          padding: 1.25rem;
          margin-bottom: 1.25rem;
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

        .transitional-credit-box {
          background: rgba(245, 158, 11, 0.04);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: var(--radius-md);
          padding: 1.15rem;
        }

        .transitional-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .transitional-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
          color: #fbbf24;
          margin: 0;
        }

        .transitional-desc {
          font-size: 0.775rem;
          color: var(--text-secondary);
          margin-top: 0.2rem;
        }

        .transitional-summary {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .sum-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .sum-label {
          color: var(--text-secondary);
        }

        .sum-val {
          font-weight: 700;
          color: var(--text-primary);
        }

        .highlight-itc {
          font-size: 0.95rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 0.45rem;
        }

        .value-gold {
          color: #fbbf24;
          font-family: var(--font-heading);
        }

        .transitional-table-wrapper {
          max-height: 180px;
          overflow-y: auto;
          margin-top: 0.5rem;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
        }

        .mini-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.775rem;
          text-align: left;
        }

        .mini-table th {
          background: rgba(255, 255, 255, 0.05);
          padding: 0.45rem 0.65rem;
          color: var(--text-secondary);
        }

        .mini-table td {
          padding: 0.45rem 0.65rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .text-gold {
          color: #fbbf24;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
