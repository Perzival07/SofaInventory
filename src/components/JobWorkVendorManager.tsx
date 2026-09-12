"use client";

import React, { useState } from "react";
import { UserCheck, Plus, CheckCircle2, AlertCircle, FileText, Calculator, ArrowRight } from "lucide-react";
import { JobWorkVendor, JobWorkOrder, LanguageCode } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/formatters";
import { CostingEngine, MakeVsBuyAnalysis } from "@/lib/costing-engine";
import { createJobWorkDispatchAction, reconcileJobWorkReturnAction } from "@/app/actions";

interface JobWorkVendorManagerProps {
  vendors: JobWorkVendor[];
  jobWorkOrders: JobWorkOrder[];
  lang: LanguageCode;
  onRefresh: () => void;
  taxEnabled: boolean;
}

export function JobWorkVendorManager({
  vendors,
  jobWorkOrders,
  lang,
  onRefresh,
  taxEnabled,
}: JobWorkVendorManagerProps) {
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState<number | null>(null);
  const [reconcileQty, setReconcileQty] = useState(1);
  const [scrapNotes, setScrapNotes] = useState("");

  // New Dispatch Form State
  const [selectedVendor, setSelectedVendor] = useState<number>(vendors[0]?.id || 1);
  const [opType, setOpType] = useState<JobWorkOrder["operation_type"]>("POLISHING");
  const [targetItem, setTargetItem] = useState("Dining Table & 6 Chair Frames (Walnut PU Finish)");
  const [qtyExpected, setQtyExpected] = useState(3);
  const [ratePerUnit, setRatePerUnit] = useState(3500);
  const [materialQtyToIssue, setMaterialQtyToIssue] = useState(8);
  const [dueDate, setDueDate] = useState("2026-09-22");

  // Make-vs-Buy Quick Calculator State
  const [showMakeVsBuy, setShowMakeVsBuy] = useState(false);
  const [makeVsBuyResult, setMakeVsBuyResult] = useState<MakeVsBuyAnalysis | null>(null);

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createJobWorkDispatchAction({
      vendor_id: selectedVendor,
      operation_type: opType,
      target_item_description: targetItem,
      quantity_expected: qtyExpected,
      rate_per_unit: ratePerUnit,
      material_id: 1, // Sal wood
      quantity_to_issue: materialQtyToIssue,
      due_date: dueDate,
    });
    setIsDispatchOpen(false);
    onRefresh();
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReconcileOpen) return;
    await reconcileJobWorkReturnAction({
      jwoId: isReconcileOpen,
      quantityReceived: reconcileQty,
      scrapNotes: scrapNotes || undefined,
    });
    setIsReconcileOpen(null);
    onRefresh();
  };

  const runMakeVsBuyCalc = () => {
    const res = CostingEngine.evaluateMakeVsBuy({
      itemName: "Chesterfield Sofa Frame Upholstery",
      inHouseMaterialCost: 18500,
      inHouseLabourCost: 4500,
      inHouseOverheadCost: 1200,
      vendorLabourCharge: 5200,
      vendorGstRegistered: true,
    });
    setMakeVsBuyResult(res);
    setShowMakeVsBuy(true);
  };

  return (
    <div className="jobwork-root">
      {/* Notice Banner: Our Asset */}
      <div className="asset-notice-banner">
        <UserCheck size={20} className="notice-icon" />
        <div className="notice-text">
          <strong>LEGAL ASSET NOTICE:</strong> Raw materials issued to job workers remain{" "}
          <u>our exclusive legal property</u> and are tracked in the <em>"Stock with Vendor"</em>{" "}
          account. They are never treated as consumed until goods are returned and reconciled.
        </div>
      </div>

      <div className="jw-top-bar">
        <div>
          <h3 className="section-title">Job Work & Outsourced Manufacturing Orders</h3>
          <p className="section-sub">
            Challan-based stock transfers with local Barasat polishers, upholsterers, and carvers
          </p>
        </div>
        <div className="jw-actions">
          <button
            onClick={runMakeVsBuyCalc}
            className="btn btn-secondary btn-sm"
            id="btn-make-vs-buy"
          >
            <Calculator size={16} />
            <span>Make vs Buy Analysis</span>
          </button>
          <button
            onClick={() => setIsDispatchOpen(true)}
            className="btn btn-primary btn-sm"
            id="btn-new-job-work-challan"
          >
            <Plus size={16} />
            <span>Issue Delivery Challan</span>
          </button>
        </div>
      </div>

      {/* Make vs Buy Modal / Panel */}
      {showMakeVsBuy && makeVsBuyResult && (
        <div className="make-vs-buy-panel animate-fade">
          <div className="mvb-header">
            <h4 className="mvb-title">Make-vs-Buy Decision Engine (Tax-Adjusted)</h4>
            <button onClick={() => setShowMakeVsBuy(false)} className="btn-close-sm">
              ×
            </button>
          </div>
          <p className="mvb-expl">{makeVsBuyResult.regime_impact_explanation}</p>
          <div className="mvb-grid">
            <div className="mvb-box in-house">
              <span className="mvb-label">In-House Manufacturing</span>
              <span className="mvb-cost">{formatINR(makeVsBuyResult.total_in_house_cost)}</span>
              <span className="mvb-sub">Material: {formatINR(makeVsBuyResult.in_house_material_cost)} + Labour: {formatINR(makeVsBuyResult.in_house_labour_cost)}</span>
            </div>
            <div className="mvb-box outsource">
              <span className="mvb-label">Outsource to Job Worker</span>
              <span className="mvb-cost">{formatINR(makeVsBuyResult.total_vendor_effective_cost)}</span>
              <span className="mvb-sub">Base: {formatINR(makeVsBuyResult.vendor_base_charge)} + Unrecoverable GST: {formatINR(makeVsBuyResult.unrecoverable_tax_cost)}</span>
            </div>
          </div>
          <div className="mvb-recommendation">
            Recommendation:{" "}
            <strong>
              {makeVsBuyResult.recommendation === "MAKE_IN_HOUSE"
                ? "MAKE IN-HOUSE (Save ₹" + Math.abs(makeVsBuyResult.cost_difference) + " per unit)"
                : "OUTSOURCE (Job work is cheaper)"}
            </strong>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="table-responsive-wrapper">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Challan #</th>
              <th>Vendor</th>
              <th>Operation</th>
              <th>Target Goods</th>
              <th>Materials Issued (Our Asset)</th>
              <th>Due Date</th>
              <th>Return Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobWorkOrders.map((jwo) => {
              const isReconciled = jwo.status === "RECONCILED";
              const isRule45 = jwo.challan_number.startsWith("CH-R45");

              return (
                <tr key={jwo.id} className="table-row">
                  <td>
                    <strong>{jwo.challan_number}</strong>
                    <span className="block-hint">
                      {isRule45 ? "Rule 45 Statutory Challan" : "Internal Control Challan"}
                    </span>
                  </td>
                  <td>
                    <strong>{jwo.vendor_name}</strong>
                    <span className="block-hint">{formatDate(jwo.challan_date)}</span>
                  </td>
                  <td>
                    <span className="badge badge-category">{jwo.operation_type}</span>
                  </td>
                  <td>
                    <strong>{jwo.target_item_description}</strong>
                    <span className="block-hint">Expected: {jwo.quantity_expected} units</span>
                  </td>
                  <td>
                    {jwo.materials_issued.map((m, idx) => (
                      <span key={idx} className="badge badge-our-asset">
                        {m.quantity_issued} {m.uom} {m.material_name}
                      </span>
                    ))}
                  </td>
                  <td>{formatDate(jwo.due_date)}</td>
                  <td>
                    {isReconciled ? (
                      <span className="badge badge-in-stock">Reconciled ({jwo.quantity_received} rcvd)</span>
                    ) : (
                      <span className="badge badge-low-stock">
                        Pending ({jwo.quantity_received} / {jwo.quantity_expected})
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    {!isReconciled && (
                      <button
                        onClick={() => {
                          setIsReconcileOpen(jwo.id);
                          setReconcileQty(jwo.quantity_expected - jwo.quantity_received);
                        }}
                        className="btn btn-primary btn-xs"
                      >
                        Receive & Reconcile
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Dispatch Modal */}
      {isDispatchOpen && (
        <div className="modal-overlay" onClick={() => setIsDispatchOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Issue Delivery Challan to Job Worker</h3>
              <button onClick={() => setIsDispatchOpen(false)} className="btn-icon-close">
                ×
              </button>
            </div>
            <form onSubmit={handleDispatchSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Karigar / Vendor *</label>
                  <select
                    className="form-select"
                    value={selectedVendor}
                    onChange={(e) => setSelectedVendor(parseInt(e.target.value))}
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.trade_name} ({v.capabilities.join(", ")})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Outsourced Operation *</label>
                    <select
                      className="form-select"
                      value={opType}
                      onChange={(e) => setOpType(e.target.value as any)}
                    >
                      <option value="POLISHING">Melamine / PU Polishing</option>
                      <option value="UPHOLSTERY">Fabric & Foam Upholstery</option>
                      <option value="CNC_CUTTING">CNC Woodcarving</option>
                      <option value="FRAME_WORK">Sub-assembly Carpentry</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Agreed Rate per Unit (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={ratePerUnit}
                      onChange={(e) => setRatePerUnit(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Finished Goods Description *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={targetItem}
                    onChange={(e) => setTargetItem(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Raw Material to Issue (Our Asset) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={materialQtyToIssue}
                      onChange={(e) => setMaterialQtyToIssue(parseInt(e.target.value) || 0)}
                    />
                    <span className="form-hint">Deducted from store, added to Vendor Asset</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Expected Completion Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="challan-format-notice">
                  Format: <strong>{taxEnabled ? "Rule 45 Statutory Challan (CH-R45-...)" : "Internal Delivery Challan (IDC-...)"}</strong>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsDispatchOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Dispatch Material & Issue Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Return Modal */}
      {isReconcileOpen && (
        <div className="modal-overlay" onClick={() => setIsReconcileOpen(null)}>
          <div className="modal-dialog modal-dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Vendor Goods Received & 3-Way Match</h3>
              <button onClick={() => setIsReconcileOpen(null)} className="btn-icon-close">
                ×
              </button>
            </div>
            <form onSubmit={handleReconcileSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Quantity Received Today (Units)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={reconcileQty}
                    onChange={(e) => setReconcileQty(parseInt(e.target.value) || 0)}
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Scrap / Remnant Return Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 2 wood offcuts returned, sawdust retained"
                    value={scrapNotes}
                    onChange={(e) => setScrapNotes(e.target.value)}
                  />
                  <span className="form-hint">Verified against agreed wastage norm</span>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsReconcileOpen(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm GRN & Release Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .jobwork-root {
          margin-top: 1rem;
        }

        .asset-notice-banner {
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: var(--radius-md);
          padding: 0.85rem 1.15rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          color: #e9d5ff;
          font-size: 0.85rem;
        }

        .notice-icon {
          color: #c084fc;
          flex-shrink: 0;
        }

        .jw-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .jw-actions {
          display: flex;
          gap: 0.65rem;
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

        .make-vs-buy-panel {
          background: var(--bg-surface);
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .mvb-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .mvb-title {
          font-size: 1rem;
          color: #fbbf24;
          margin: 0;
        }

        .btn-close-sm {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1.2rem;
          cursor: pointer;
        }

        .mvb-expl {
          font-size: 0.825rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          line-height: 1.45;
        }

        .mvb-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .mvb-box {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .mvb-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .mvb-cost {
          font-family: var(--font-heading);
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .mvb-sub {
          font-size: 0.725rem;
          color: var(--text-muted);
        }

        .mvb-recommendation {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: var(--radius-sm);
          padding: 0.5rem 0.75rem;
          color: #34d399;
          font-size: 0.85rem;
        }

        .block-hint {
          display: block;
          font-size: 0.725rem;
          color: var(--text-muted);
        }

        .badge-our-asset {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          font-size: 0.7rem;
        }

        .challan-format-notice {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .form-row-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.85rem;
        }

        .btn-xs {
          font-size: 0.75rem;
          padding: 0.35rem 0.65rem;
          min-height: 30px;
        }
      `}</style>
    </div>
  );
}
