"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
} from "lucide-react";
import { TaxConfig, TaxRegimePeriod, TaxRule, RegimeState, TransitionalCreditLine } from "@/lib/tax-types";
import { formatINR, formatDate, getTodayDateString } from "@/lib/formatters";
import {
  fetchTaxSettingsAction,
  fetchTransitionalCreditAction,
  enableTaxRegimeAction,
  disableTaxRegimeAction,
  updateTaxRuleAction,
} from "@/app/tax-actions";

export default function SettingsPage() {
  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [periods, setPeriods] = useState<TaxRegimePeriod[]>([]);
  const [regime, setRegime] = useState<RegimeState | null>(null);
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showEnableForm, setShowEnableForm] = useState(false);
  const [gstin, setGstin] = useState("");
  const [regDate, setRegDate] = useState(getTodayDateString());
  const [composition, setComposition] = useState(false);
  const [filing, setFiling] = useState<"monthly" | "quarterly">("quarterly");
  const [legalName, setLegalName] = useState("");
  const [busy, setBusy] = useState(false);

  const [credit, setCredit] = useState<{
    lines: TransitionalCreditLine[]; claimable_total: number; blocked_total: number;
  } | null>(null);
  const [showCredit, setShowCredit] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchTaxSettingsAction();
      setConfig(data.config);
      setPeriods(data.periods);
      setRegime(data.regime);
      setRules(data.rules);
      setGstin(data.config.registration_number ?? "");
      setLegalName(data.config.legal_name ?? "");
    } catch {
      showToast("Failed to load settings", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server fetch for this page
    load();
  }, [load]);

  const handleEnable = async () => {
    setBusy(true);
    const res = await enableTaxRegimeAction({
      registration_number: gstin,
      registration_date: regDate,
      state_code: config?.state_code ?? "19",
      composition_scheme: composition,
      filing_frequency: filing,
      legal_name: legalName || null,
    });
    setBusy(false);
    if (!res.success) {
      showToast(res.error || "Failed to enable", "error");
      return;
    }
    showToast(`Tax regime enabled with effect from ${formatDate(regDate)}.`);
    setShowEnableForm(false);
    await load();
  };

  const handleDisable = async () => {
    const date = prompt("Deregistration date (YYYY-MM-DD):", getTodayDateString());
    if (!date) return;
    setBusy(true);
    const res = await disableTaxRegimeAction(date);
    setBusy(false);
    if (!res.success) {
      showToast(res.error || "Failed to disable", "error");
      return;
    }
    showToast(`Tax regime switched off with effect from ${formatDate(date)}.`);
    await load();
  };

  const loadCredit = async () => {
    setShowCredit(true);
    if (!credit) setCredit(await fetchTransitionalCreditAction());
  };

  const toggleVerified = async (rule: TaxRule) => {
    await updateTaxRuleAction(rule.id, { verified_by_ca: !rule.verified_by_ca });
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, verified_by_ca: !r.verified_by_ca } : r)));
  };

  const registered = regime?.registered ?? false;
  const today = getTodayDateString();
  // A cancellation can be dated in the future: registration stays valid up to and
  // including that date, so surface it rather than silently still showing "Registered".
  const activePeriod = periods.find(
    (p) => p.from_date <= today && (!p.to_date || p.to_date >= today)
  );
  const pendingEndDate = activePeriod?.to_date ?? null;
  const hsnRules = rules.filter((r) => r.rule_type === "hsn_rate");
  const otherRules = rules.filter((r) => r.rule_type !== "hsn_rate");
  const unverifiedCount = rules.filter((r) => !r.verified_by_ca).length;

  if (isLoading || !config || !regime) {
    return (
      <AppShell title="Settings" subtitle="Tax regime, rules and compliance configuration">
        <div className="state-block">
          <Loader2 size={30} className="spin" />
          <p>Loading settings...</p>
        </div>
        <style jsx>{`
          .state-block {
            padding: 4rem; text-align: center; color: var(--text-secondary);
            background: var(--bg-surface); border: 1px dashed var(--border-subtle);
            border-radius: var(--radius-lg); display: flex; flex-direction: column;
            align-items: center; gap: 0.75rem;
          }
          .spin { animation: spin 1s linear infinite; color: var(--primary); }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings" subtitle="Tax regime, rules and compliance configuration">
      {/* Regime status */}
      <section className={`regime-card ${registered ? "regime-on" : "regime-off"}`}>
        <div className="regime-head">
          <div className={`regime-icon ${registered ? "icon-on" : "icon-off"}`}>
            {registered ? <ShieldCheck size={22} /> : <ShieldOff size={22} />}
          </div>
          <div className="regime-title-block">
            <h2 className="regime-title">
              {registered
                ? regime.composition_scheme ? "Registered — Composition Scheme" : "Registered under GST"
                : "Not registered under GST"}
            </h2>
            <p className="regime-sub">
              {registered
                ? `${regime.registration_number} · effective from ${formatDate(config.registration_date)}`
                : "Operating below the registration threshold. The full tax system is built and dormant."}
            </p>
            {registered && pendingEndDate && (
              <p className="pending-end">
                <AlertTriangle size={13} />
                Cancellation dated {formatDate(pendingEndDate)} — registration stays in force
                through that date, then documents revert to cash memos.
              </p>
            )}
          </div>
          {!registered ? (
            <button className="btn btn-primary" onClick={() => setShowEnableForm((v) => !v)} id="btn-enable-regime">
              Enable Tax Regime
            </button>
          ) : (
            <button className="btn btn-danger" onClick={handleDisable} disabled={busy} id="btn-disable-regime">
              Deregister
            </button>
          )}
        </div>

        {showEnableForm && !registered && (
          <div className="enable-form">
            <div className="warn-strip">
              <AlertTriangle size={16} />
              <span>
                This is effective-dated and never retroactive. Every document dated before the
                registration date keeps its current treatment permanently.
              </span>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="in-gstin">GSTIN *</label>
                <input id="in-gstin" className="form-input" value={gstin} placeholder="19ABCDE1234F1Z5"
                  onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} />
                <span className="form-hint">Must begin with 19 for West Bengal</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="in-regdate">Effective From *</label>
                <input id="in-regdate" type="date" className="form-input" value={regDate}
                  onChange={(e) => setRegDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="in-legal">Legal Name</label>
                <input id="in-legal" className="form-input" value={legalName}
                  onChange={(e) => setLegalName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="in-filing">Filing Frequency</label>
                <select id="in-filing" className="form-select" value={filing}
                  onChange={(e) => setFiling(e.target.value as "monthly" | "quarterly")}>
                  <option value="quarterly">Quarterly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <label className="check-row">
              <input type="checkbox" checked={composition} onChange={(e) => setComposition(e.target.checked)} />
              <span>
                Composition scheme — issues bill of supply instead of tax invoice, and input credit
                is <strong>not</strong> available, so purchase costing stays GST-inclusive.
              </span>
            </label>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowEnableForm(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleEnable} disabled={busy} id="btn-confirm-enable">
                {busy ? "Enabling..." : "Enable Tax Regime"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* What the flag controls */}
      <section className="panel">
        <h2 className="panel-title">What the flag controls</h2>
        <p className="panel-sub">
          The highlighted column is what the system is doing right now.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Area</th>
                <th className={!registered ? "col-active" : ""}>Unregistered</th>
                <th className={registered ? "col-active" : ""}>Registered</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Sales document", "Cash memo, no tax columns, own series", "Tax invoice, CGST/SGST/IGST split, HSN, own series"],
                ["Purchase costing", "GST-inclusive landed cost — tax is a sunk cost", "Net of tax — tax posted to input credit ledger"],
                ["Job work dispatch", "Internal delivery challan for stock control", "Rule 45 challan, ITC-04, 1yr/3yr deadline alerts"],
                ["E-way bill", "Not generated; warning if buyer is registered", "Generated above threshold; intra-state job work exempt"],
                ["Statutory output", "None", "GSTR-1 / GSTR-3B data, HSN summary, ITC register"],
                ["Turnover watchdog", "Active and prominent", "Informational metric only"],
              ].map(([area, off, on]) => (
                <tr key={area}>
                  <td className="strong">{area}</td>
                  <td className={!registered ? "col-active" : "dim"}>{off}</td>
                  <td className={registered ? "col-active" : "dim"}>{on}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Registration history */}
      {periods.length > 0 && (
        <section className="panel">
          <h2 className="panel-title"><History size={17} /> Registration history</h2>
          <p className="panel-sub">
            Documents resolve their tax treatment against these periods, not the current flag.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>From</th><th>To</th><th>GSTIN</th><th>Scheme</th></tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.from_date)}</td>
                    <td>{p.to_date ? formatDate(p.to_date) : <span className="chip-live">Current</span>}</td>
                    <td className="mono">{p.registration_number}</td>
                    <td>{p.composition_scheme ? "Composition" : "Regular"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Transitional credit */}
      <section className="panel">
        <h2 className="panel-title"><FileText size={17} /> Transitional credit report</h2>
        <p className="panel-sub">
          Credit claimable on inputs held in stock as at the registration date. Prepare this
          before enabling the regime — it is the highest-value output of the switchover.
        </p>

        {!showCredit ? (
          <button className="btn btn-secondary" onClick={loadCredit} id="btn-load-credit">
            Generate report
          </button>
        ) : !credit ? (
          <div className="inline-loading"><Loader2 size={18} className="spin" /> Computing...</div>
        ) : (
          <>
            <div className="credit-summary">
              <div>
                <span className="sum-label">Claimable credit</span>
                <span className="sum-value ok">{formatINR(credit.claimable_total)}</span>
              </div>
              <div>
                <span className="sum-label">Blocked — missing documents</span>
                <span className="sum-value bad">{formatINR(credit.blocked_total)}</span>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Material</th><th>Batch</th><th className="right">Qty</th>
                    <th>Supplier</th><th>Invoice</th><th className="right">Rate</th>
                    <th className="right">Embedded tax</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {credit.lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div className="cell-stack">
                          <span className="strong">{l.material_name}</span>
                          <span className="mono">{l.material_code}</span>
                        </div>
                      </td>
                      <td className="mono">{l.batch_no}</td>
                      <td className="right">{l.quantity} {l.stock_uom}</td>
                      <td>{l.supplier_name || "—"}</td>
                      <td className="mono">{l.supplier_invoice_no || "—"}</td>
                      <td className="right">{l.tax_rate}%</td>
                      <td className="right strong">{formatINR(l.embedded_tax)}</td>
                      <td>
                        {l.claimable
                          ? <span className="chip-ok">Claimable</span>
                          : <span className="chip-bad" title={l.blocker ?? ""}>{l.blocker}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Tax rules */}
      <section className="panel">
        <h2 className="panel-title">Tax rules</h2>
        <p className="panel-sub">
          Thresholds, rates and exemptions are configuration, not code. Edit them here when rules change.
        </p>

        {unverifiedCount > 0 && (
          <div className="warn-strip">
            <AlertTriangle size={16} />
            <span>
              <strong>{unverifiedCount} rules are not yet verified by a chartered accountant.</strong>{" "}
              These values are my best-effort defaults and must be confirmed with your CA in Barasat
              before you rely on them for filing. Tick each row once confirmed.
            </span>
          </div>
        )}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Rule</th><th className="right">Value</th><th>Notes</th><th className="right">CA verified</th></tr>
            </thead>
            <tbody>
              {otherRules.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="cell-stack">
                      <span className="strong">{r.rule_key.replace(/_/g, " ")}</span>
                      <span className="mono">{r.rule_type}</span>
                    </div>
                  </td>
                  <td className="right strong">
                    {r.rule_key.includes("threshold") || r.rule_key.includes("turnover")
                      ? formatINR(r.numeric_value ?? 0)
                      : `${r.numeric_value}${r.rule_key.includes("months") ? " months" : ""}`}
                  </td>
                  <td className="notes">{r.notes}</td>
                  <td className="right">
                    <input type="checkbox" checked={r.verified_by_ca}
                      onChange={() => toggleVerified(r)} aria-label={`Mark ${r.rule_key} verified`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="sub-head">HSN rate suggestions</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>HSN</th><th>Description</th><th className="right">Rate</th><th className="right">CA verified</th></tr>
            </thead>
            <tbody>
              {hsnRules.map((r) => (
                <tr key={r.id}>
                  <td className="mono strong">{r.rule_key}</td>
                  <td>{r.text_value}</td>
                  <td className="right strong">{r.numeric_value}%</td>
                  <td className="right">
                    <input type="checkbox" checked={r.verified_by_ca}
                      onChange={() => toggleVerified(r)} aria-label={`Mark HSN ${r.rule_key} verified`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {toast && (
        <div className={`toast-pill ${toast.type === "error" ? "toast-error" : "toast-success"}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        .regime-card {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .regime-off { border-left: 4px solid var(--text-muted); }
        .regime-on { border-left: 4px solid var(--status-in-stock-text); }

        .regime-head { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .regime-icon {
          width: 46px; height: 46px; border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
        }
        .icon-off { background: var(--bg-surface-elevated); color: var(--text-muted); border: 1px solid var(--border-subtle); }
        .icon-on { background: var(--status-in-stock-bg); color: var(--status-in-stock-text); border: 1px solid var(--status-in-stock-border); }
        .regime-title-block { flex: 1; min-width: 200px; }
        .regime-title { font-size: 1.1rem; }
        .regime-sub { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.15rem; }
        .pending-end {
          display: flex; align-items: center; gap: 0.35rem; margin-top: 0.4rem;
          font-size: 0.8rem; color: var(--status-low-stock-text); font-weight: 500;
        }

        .enable-form { margin-top: 1.25rem; border-top: 1px solid var(--border-subtle); padding-top: 1.15rem; }
        .form-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
        @media (min-width: 640px) { .form-grid { grid-template-columns: 1fr 1fr; } }
        .form-actions { display: flex; justify-content: flex-end; gap: 0.65rem; margin-top: 0.5rem; }

        .check-row {
          display: flex; gap: 0.6rem; align-items: flex-start; font-size: 0.85rem;
          color: var(--text-secondary); margin: 0.5rem 0 1rem; cursor: pointer; line-height: 1.5;
        }
        .check-row input { margin-top: 0.2rem; width: 16px; height: 16px; accent-color: var(--primary); flex-shrink: 0; }

        .warn-strip {
          display: flex; gap: 0.6rem; align-items: flex-start;
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text); border-radius: var(--radius-md);
          padding: 0.75rem 0.9rem; font-size: 0.825rem; line-height: 1.5; margin-bottom: 1.1rem;
        }

        .panel {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .panel-title { font-size: 1.05rem; display: flex; align-items: center; gap: 0.45rem; }
        .panel-sub { font-size: 0.825rem; color: var(--text-secondary); margin: 0.2rem 0 1rem; }
        .sub-head { font-size: 0.925rem; margin: 1.35rem 0 0.75rem; }

        .table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .data-table thead { background: var(--bg-surface-elevated); }
        .data-table th {
          text-align: left; padding: 0.65rem 0.8rem; font-size: 0.68rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap;
        }
        .data-table td { padding: 0.65rem 0.8rem; border-top: 1px solid var(--border-subtle); vertical-align: top; }
        .data-table .right { text-align: right; }
        .col-active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
        .dim { color: var(--text-muted); }
        .strong { font-weight: 600; color: var(--text-primary); }
        .notes { color: var(--text-secondary); font-size: 0.8rem; max-width: 320px; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; color: var(--text-muted); }
        .cell-stack { display: flex; flex-direction: column; gap: 0.1rem; }

        .credit-summary {
          display: flex; flex-wrap: wrap; gap: 2rem; background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.9rem 1.1rem; margin-bottom: 1rem;
        }
        .credit-summary > div { display: flex; flex-direction: column; }
        .sum-label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); }
        .sum-value { font-family: var(--font-heading); font-size: 1.35rem; font-weight: 700; }
        .sum-value.ok { color: var(--status-in-stock-text); }
        .sum-value.bad { color: var(--status-out-stock-text); }

        .chip-ok {
          background: var(--status-in-stock-bg); color: var(--status-in-stock-text);
          border: 1px solid var(--status-in-stock-border); border-radius: var(--radius-full);
          padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 600; white-space: nowrap;
        }
        .chip-bad {
          background: var(--status-out-stock-bg); color: var(--status-out-stock-text);
          border: 1px solid var(--status-out-stock-border); border-radius: var(--radius-full);
          padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 600;
        }
        .chip-live {
          background: var(--status-in-stock-bg); color: var(--status-in-stock-text);
          border: 1px solid var(--status-in-stock-border); border-radius: var(--radius-full);
          padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 600;
        }

        .inline-loading {
          display: flex; align-items: center; gap: 0.5rem;
          color: var(--text-secondary); font-size: 0.875rem; padding: 0.5rem 0;
        }
        .spin { animation: spin 1s linear infinite; color: var(--primary); }
        @keyframes spin { to { transform: rotate(360deg); } }

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
