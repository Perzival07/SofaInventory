"use client";

import React, { useState } from "react";
import { Trees, Scissors, AlertCircle, Plus, Sparkles, Layers, ShieldAlert } from "lucide-react";
import { RawMaterialItem, OffcutScrapItem, LanguageCode } from "@/lib/types";
import { formatINR } from "@/lib/formatters";
import { addOffcutScrapAction } from "@/app/actions";

interface RawMaterialStoreViewProps {
  materials: RawMaterialItem[];
  offcuts: OffcutScrapItem[];
  lang: LanguageCode;
  onRefresh: () => void;
  monsoonActive: boolean;
}

export function RawMaterialStoreView({
  materials,
  offcuts,
  lang,
  onRefresh,
  monsoonActive,
}: RawMaterialStoreViewProps) {
  const [activeTab, setActiveTab] = useState<"materials" | "offcuts">("materials");
  const [isAddScrapOpen, setIsAddScrapOpen] = useState(false);
  const [scrapType, setScrapType] = useState<OffcutScrapItem["material_type"]>("WOOD_OFFCUT");
  const [dimensions, setDimensions] = useState("4.5 ft x 6 inch x 2 inch");
  const [quantity, setQuantity] = useState(5);
  const [approxValue, setApproxValue] = useState(1200);
  const [location, setLocation] = useState("Rack B-2 (Seasoned Sal)");

  const handleAddScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    await addOffcutScrapAction({
      material_id: materials[0]?.id || 1,
      material_name: "Lumber / Wood Offcut",
      material_type: scrapType,
      dimensions,
      quantity,
      approx_value: approxValue,
      location,
    });
    setIsAddScrapOpen(false);
    onRefresh();
  };

  return (
    <div className="rm-store-root">
      {/* Sub-navigation */}
      <div className="rm-sub-header">
        <div className="tab-pill-group">
          <button
            className={`sub-tab-btn ${activeTab === "materials" ? "active" : ""}`}
            onClick={() => setActiveTab("materials")}
          >
            <Trees size={16} />
            <span>Raw Materials & Dye Lots ({materials.length})</span>
          </button>
          <button
            className={`sub-tab-btn ${activeTab === "offcuts" ? "active" : ""}`}
            onClick={() => setActiveTab("offcuts")}
          >
            <Scissors size={16} />
            <span>Offcuts & Scrap Remnants ({offcuts.length})</span>
          </button>
        </div>

        {activeTab === "offcuts" && (
          <button
            onClick={() => setIsAddScrapOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={16} />
            <span>Log Usable Offcut Scrap</span>
          </button>
        )}
      </div>

      {activeTab === "materials" ? (
        <div className="materials-grid">
          {materials.map((mat) => {
            const isTimber = mat.category === "TIMBER";
            const isFabric = mat.category === "FABRIC_LEATHER";
            const moistureWarning =
              isTimber &&
              mat.timber_attrs &&
              mat.timber_attrs.moisture_pct > (monsoonActive ? 15.0 : 12.0);

            return (
              <div key={mat.id} className="material-card">
                <div className="mat-header">
                  <span className="badge badge-category">{mat.category}</span>
                  <span className="mat-sku">{mat.sku}</span>
                </div>

                <h4 className="mat-name">{mat.name}</h4>

                {/* Stock Breakdown (Store vs Allocated vs Vendor) */}
                <div className="stock-breakdown">
                  <div className="st-col">
                    <span className="st-label">Available Free</span>
                    <span className="st-val st-val-free">
                      {mat.available_free_stock} {mat.uom.stock_uom}
                    </span>
                  </div>
                  <div className="st-col">
                    <span className="st-label">In Factory WIP</span>
                    <span className="st-val st-val-wip">
                      {mat.allocated_to_wip} {mat.uom.stock_uom}
                    </span>
                  </div>
                  <div className="st-col">
                    <span className="st-label">With Vendor (Asset)</span>
                    <span className="st-val st-val-vendor">
                      {mat.issued_to_vendors} {mat.uom.stock_uom}
                    </span>
                  </div>
                </div>

                {/* Multi-UOM Details */}
                <div className="uom-pill">
                  <span>Multi-UOM: 1 {mat.uom.purchase_uom} = {mat.uom.conversion_ratio} {mat.uom.consumption_uom}</span>
                </div>

                {/* Timber Moisture & Seasoning Inspection */}
                {isTimber && mat.timber_attrs && (
                  <div
                    className={`attribute-box ${
                      moistureWarning ? "box-warning-moisture" : ""
                    }`}
                  >
                    <div className="attr-row">
                      <span className="attr-k">Species & Grade:</span>
                      <span className="attr-v">
                        {mat.timber_attrs.species} ({mat.timber_attrs.grade})
                      </span>
                    </div>
                    <div className="attr-row">
                      <span className="attr-k">Moisture Content:</span>
                      <span className="attr-v">
                        <strong>{mat.timber_attrs.moisture_pct}%</strong>
                        {moistureWarning ? " ⚠️ (Exceeds limit)" : " ✓ Seasoned"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Fabric Dye Lot Tracking & Warning */}
                {isFabric && mat.fabric_attrs && (
                  <div className="attribute-box box-dye-lot">
                    <div className="attr-row">
                      <span className="attr-k">Dye Lot #:</span>
                      <span className="badge badge-dye-lot">
                        {mat.fabric_attrs.dye_lot}
                      </span>
                    </div>
                    <p className="dye-hint">
                      Single-lot enforcement active: Do not mix with other lots for the same sofa.
                    </p>
                  </div>
                )}

                <div className="mat-cost-row">
                  <span className="mat-cost-label">Landed Unit Cost:</span>
                  <span className="mat-cost-val">
                    {formatINR(mat.current_cost_per_stock_uom)} / {mat.uom.stock_uom}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Offcut Scrap Inventory */
        <div className="offcuts-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Scrap Type</th>
                <th>Material</th>
                <th>Dimensions (L x W)</th>
                <th>Quantity</th>
                <th>Approx Value</th>
                <th>Workshop Location</th>
              </tr>
            </thead>
            <tbody>
              {offcuts.map((sc) => (
                <tr key={sc.id} className="table-row">
                  <td>
                    <span className="badge badge-category">{sc.material_type}</span>
                  </td>
                  <td><strong>{sc.material_name}</strong></td>
                  <td>{sc.dimensions}</td>
                  <td>{sc.quantity} pcs</td>
                  <td className="text-gold">{formatINR(sc.approx_value)}</td>
                  <td>{sc.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Scrap Modal */}
      {isAddScrapOpen && (
        <div className="modal-overlay" onClick={() => setIsAddScrapOpen(false)}>
          <div className="modal-dialog modal-dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Log Usable Offcut Scrap</h3>
              <button onClick={() => setIsAddScrapOpen(false)} className="btn-icon-close">
                ×
              </button>
            </div>
            <form onSubmit={handleAddScrap}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Scrap Material Type</label>
                  <select
                    className="form-select"
                    value={scrapType}
                    onChange={(e) => setScrapType(e.target.value as any)}
                  >
                    <option value="WOOD_OFFCUT">Solid Wood Offcut</option>
                    <option value="PLY_REMNANT">Plywood Remnant Piece</option>
                    <option value="FABRIC_SCRAP">Fabric / Velvet Remnant</option>
                    <option value="FOAM_OFFCUT">Foam Cushion Offcut</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Dimensions (Length x Width x Thickness)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Reusable Value (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={approxValue}
                    onChange={(e) => setApproxValue(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Workshop Storage Rack</label>
                  <input
                    type="text"
                    className="form-input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddScrapOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Remnant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .rm-store-root {
          margin-top: 1rem;
        }

        .rm-sub-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .tab-pill-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sub-tab-btn {
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

        .sub-tab-btn.active {
          background: var(--bg-surface-elevated);
          color: var(--primary);
          border-color: var(--primary);
        }

        .materials-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (min-width: 680px) {
          .materials-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1080px) {
          .materials-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .material-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .mat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mat-sku {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .mat-name {
          font-size: 1.05rem;
          line-height: 1.35;
          margin: 0;
          min-height: 2.8rem;
        }

        .stock-breakdown {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.5rem;
          text-align: center;
        }

        .st-col {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .st-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .st-val {
          font-size: 0.85rem;
          font-weight: 700;
        }

        .st-val-free {
          color: #34d399;
        }

        .st-val-wip {
          color: #38bdf8;
        }

        .st-val-vendor {
          color: #c084fc;
        }

        .uom-pill {
          font-size: 0.75rem;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          padding: 0.3rem 0.65rem;
          border-radius: var(--radius-sm);
        }

        .attribute-box {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.85rem;
          font-size: 0.8rem;
        }

        .box-warning-moisture {
          border-color: rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.08);
          color: #fca5a5;
        }

        .box-dye-lot {
          border-color: rgba(168, 85, 247, 0.3);
        }

        .attr-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.2rem;
        }

        .badge-dye-lot {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          font-size: 0.725rem;
          font-weight: 700;
        }

        .dye-hint {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 0.35rem;
        }

        .mat-cost-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--border-subtle);
          padding-top: 0.65rem;
          margin-top: auto;
          font-size: 0.85rem;
        }

        .mat-cost-label {
          color: var(--text-secondary);
        }

        .mat-cost-val {
          font-family: var(--font-heading);
          font-weight: 700;
          color: #fbbf24;
        }

        .offcuts-table-wrapper {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          overflow-x: auto;
        }

        .text-gold {
          color: #fbbf24;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
