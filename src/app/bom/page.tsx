"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { BomFormModal } from "@/components/BomFormModal";
import {
  ChevronDown,
  ChevronRight,
  Network,
  Calculator,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
} from "lucide-react";
import { Bom, BomLine, Product, Material, BomInput, ExplodedRequirement } from "@/lib/erp-types";
import { formatINR, formatDate } from "@/lib/formatters";
import {
  fetchBomPageDataAction,
  fetchBomLinesAction,
  saveBomAction,
  explodeBomAction,
} from "@/app/erp-actions";

export default function BomPage() {
  const [boms, setBoms] = useState<Bom[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [linesCache, setLinesCache] = useState<Record<number, BomLine[]>>({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Requirement calculator
  const [calcProduct, setCalcProduct] = useState<number>(0);
  const [calcQty, setCalcQty] = useState(1);
  const [requirements, setRequirements] = useState<ExplodedRequirement[] | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchBomPageDataAction();
      setBoms(data.boms);
      setProducts(data.products);
      setMaterials(data.materials);
      setCalcProduct((prev) => prev || data.products.find((p) => p.product_type === "finished")?.id || 0);
    } catch (err) {
      console.error(err);
      showToast("Failed to load BOM data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server fetch for this page
    load();
  }, [load]);

  const toggleExpand = async (bom: Bom) => {
    if (expanded === bom.id) {
      setExpanded(null);
      return;
    }
    setExpanded(bom.id);
    if (!linesCache[bom.id]) {
      const lines = await fetchBomLinesAction(bom.id);
      setLinesCache((c) => ({ ...c, [bom.id]: lines }));
    }
  };

  const handleSaveBom = async (input: BomInput) => {
    const res = await saveBomAction(input);
    if (!res.success) throw new Error(res.error);
    showToast("BOM created.");
    setLinesCache({});
    setRequirements(null);
    await load();
  };

  const runCalculation = async () => {
    if (!calcProduct) return;
    setIsCalculating(true);
    try {
      const reqs = await explodeBomAction(calcProduct, calcQty);
      setRequirements(reqs);
    } catch {
      showToast("Failed to calculate requirements", "error");
    } finally {
      setIsCalculating(false);
    }
  };

  const totalCost = requirements?.reduce((s, r) => s + r.cost, 0) ?? 0;

  return (
    <AppShell
      title="BOM & Costing"
      subtitle="Multi-level recipes with standard wastage and version history"
      actionLabel="New BOM"
      onAction={() => setIsFormOpen(true)}
    >
      {/* Requirement calculator */}
      <section className="calc-panel">
        <div className="calc-head">
          <Calculator size={18} className="calc-icon" />
          <div>
            <h2 className="calc-title">Material Requirement Calculator</h2>
            <p className="calc-sub">
              Explodes the full multi-level BOM and applies standard wastage at each level.
            </p>
          </div>
        </div>

        <div className="calc-controls">
          <div className="calc-field">
            <label className="form-label" htmlFor="calc-product">Product</label>
            <select id="calc-product" className="form-select" value={calcProduct}
              onChange={(e) => { setCalcProduct(Number(e.target.value)); setRequirements(null); }}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="calc-field calc-field-sm">
            <label className="form-label" htmlFor="calc-qty">Quantity</label>
            <input id="calc-qty" type="number" min="1" step="1" className="form-input"
              value={calcQty}
              onChange={(e) => { setCalcQty(Number(e.target.value) || 1); setRequirements(null); }} />
          </div>
          <button className="btn btn-primary calc-btn" onClick={runCalculation}
            disabled={isCalculating || !calcProduct} id="btn-calculate-requirements">
            {isCalculating ? "Calculating..." : "Calculate"}
          </button>
        </div>

        {requirements && (
          requirements.length === 0 ? (
            <div className="calc-empty">
              No active BOM found for this product. Create one to calculate requirements.
            </div>
          ) : (
            <div className="table-wrap calc-results">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Used In</th>
                    <th className="right">Net Qty</th>
                    <th className="right">Wastage</th>
                    <th className="right">Gross Qty</th>
                    <th className="right">Rate</th>
                    <th className="right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((r) => (
                    <tr key={r.material_id}>
                      <td>
                        <div className="cell-stack">
                          <span className="strong">{r.name}</span>
                          <span className="code">{r.code}</span>
                        </div>
                      </td>
                      <td><span className="path-chip">{r.path}</span></td>
                      <td className="right">{r.net_quantity.toFixed(2)} {r.uom}</td>
                      <td className="right">
                        {r.wastage_pct > 0
                          ? <span className="waste">+{r.wastage_pct}%</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td className="right">
                        <div className="cell-stack-right">
                          <span className="strong">{r.gross_quantity.toFixed(2)} {r.uom}</span>
                          {r.stock_uom !== r.uom && (
                            <span className="conv">
                              = {r.stock_equivalent.toFixed(2)} {r.stock_uom}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="right">
                        <div className="cell-stack-right">
                          <span>{formatINR(r.rate)}</span>
                          <span className="conv">per {r.stock_uom}</span>
                        </div>
                      </td>
                      <td className="right accent">{formatINR(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="right strong">
                      Standard material cost for {calcQty} unit{calcQty === 1 ? "" : "s"}
                    </td>
                    <td className="right total">{formatINR(totalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </section>

      {/* BOM list */}
      <section>
        <h2 className="section-title">Bills of Materials</h2>

        {isLoading ? (
          <div className="state-block">
            <Loader2 size={30} className="spin" />
            <p>Loading BOMs...</p>
          </div>
        ) : boms.length === 0 ? (
          <div className="state-block">
            <Network size={32} className="muted-icon" />
            <p>No BOMs defined yet. Create one to start costing production.</p>
          </div>
        ) : (
          <div className="bom-list">
            {boms.map((bom) => {
              const isOpen = expanded === bom.id;
              const lines = linesCache[bom.id];
              return (
                <div className={`bom-card ${isOpen ? "bom-card-open" : ""}`} key={bom.id}>
                  <button className="bom-head" onClick={() => toggleExpand(bom)}
                    id={`btn-expand-bom-${bom.id}`}>
                    {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                    <div className="bom-title">
                      <span className="bom-product">{bom.product_name}</span>
                      <span className="bom-code">{bom.product_code}</span>
                    </div>
                    <span className={`badge status-${bom.status}`}>{bom.status}</span>
                    <span className="bom-meta">v{bom.version}</span>
                    <span className="bom-meta hide-sm">
                      From {formatDate(bom.effective_from)}
                      {bom.effective_to ? ` → ${formatDate(bom.effective_to)}` : ""}
                    </span>
                    <span className="bom-meta">{bom.line_count} lines</span>
                  </button>

                  {isOpen && (
                    <div className="bom-body">
                      {!lines ? (
                        <div className="inline-loading"><Loader2 size={18} className="spin" /> Loading lines...</div>
                      ) : (
                        <div className="table-wrap">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Component</th>
                                <th>Type</th>
                                <th className="right">Qty</th>
                                <th className="right">Wastage</th>
                                <th className="right">Effective Qty</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((l) => (
                                <tr key={l.id}>
                                  <td>
                                    <div className="cell-stack">
                                      <span className="strong">{l.item_name}</span>
                                      <span className="code">{l.item_code}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className={`type-chip ${l.line_type === "sub_assembly" ? "type-sub" : ""}`}>
                                      {l.line_type === "sub_assembly" ? (
                                        <><Package size={11} /> Sub-assembly</>
                                      ) : "Material"}
                                    </span>
                                  </td>
                                  <td className="right">{Number(l.quantity)} {l.uom}</td>
                                  <td className="right">
                                    {l.wastage_pct > 0
                                      ? <span className="waste">+{l.wastage_pct}%</span>
                                      : <span className="muted">—</span>}
                                  </td>
                                  <td className="right strong">
                                    {(Number(l.quantity) * (1 + Number(l.wastage_pct) / 100)).toFixed(2)} {l.uom}
                                  </td>
                                  <td className="notes">{l.notes || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {bom.notes && <p className="bom-note">{bom.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <BomFormModal
        isOpen={isFormOpen}
        products={products}
        materials={materials}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSaveBom}
      />

      {toast && (
        <div className={`toast-pill ${toast.type === "error" ? "toast-error" : "toast-success"}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        .calc-panel {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 2rem;
          box-shadow: var(--shadow-sm);
        }
        .calc-head { display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 1.1rem; }
        .calc-icon { color: var(--primary); margin-top: 0.15rem; }
        .calc-title { font-size: 1.05rem; }
        .calc-sub { font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.1rem; }

        .calc-controls {
          display: grid; grid-template-columns: 1fr; gap: 0.75rem; align-items: end;
        }
        @media (min-width: 640px) {
          .calc-controls { grid-template-columns: 1fr 120px auto; }
        }
        .calc-field { display: flex; flex-direction: column; }
        .calc-btn { min-height: 46px; }

        .calc-results { margin-top: 1.25rem; }
        .calc-empty {
          margin-top: 1rem; padding: 1rem; border-radius: var(--radius-md);
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text); font-size: 0.875rem;
        }

        .section-title { font-size: 1.15rem; margin-bottom: 1rem; }

        .state-block {
          padding: 3.5rem 2rem; text-align: center; color: var(--text-secondary);
          background: var(--bg-surface); border: 1px dashed var(--border-subtle);
          border-radius: var(--radius-lg); display: flex; flex-direction: column;
          align-items: center; gap: 0.75rem;
        }
        .muted-icon { color: var(--text-muted); }
        .spin { animation: spin 1s linear infinite; color: var(--primary); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .bom-list { display: flex; flex-direction: column; gap: 0.75rem; }

        .bom-card {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);
        }
        .bom-card-open { border-color: var(--border-hover); }

        .bom-head {
          width: 100%; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
          padding: 0.95rem 1.1rem; background: transparent; border: none; cursor: pointer;
          text-align: left; color: var(--text-secondary);
        }
        .bom-head:hover { background: var(--bg-surface-elevated); }

        .bom-title { display: flex; flex-direction: column; margin-right: auto; min-width: 0; }
        .bom-product { font-family: var(--font-heading); font-weight: 700; color: var(--text-primary); }
        .bom-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.72rem; color: var(--text-muted);
        }
        .bom-meta { font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; }
        @media (max-width: 720px) { .hide-sm { display: none; } }

        .status-active {
          background: var(--status-in-stock-bg); color: var(--status-in-stock-text);
          border: 1px solid var(--status-in-stock-border); text-transform: capitalize;
        }
        .status-draft {
          background: var(--status-low-stock-bg); color: var(--status-low-stock-text);
          border: 1px solid var(--status-low-stock-border); text-transform: capitalize;
        }
        .status-archived {
          background: var(--bg-surface-elevated); color: var(--text-muted);
          border: 1px solid var(--border-subtle); text-transform: capitalize;
        }

        .bom-body { padding: 0 1.1rem 1.1rem; }
        .inline-loading {
          display: flex; align-items: center; gap: 0.5rem;
          color: var(--text-secondary); font-size: 0.875rem; padding: 0.75rem 0;
        }
        .bom-note {
          margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-secondary); font-style: italic;
        }

        .table-wrap {
          overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
        }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .data-table thead { background: var(--bg-surface-elevated); }
        .data-table th {
          text-align: left; padding: 0.7rem 0.85rem; font-size: 0.7rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap;
        }
        .data-table td {
          padding: 0.7rem 0.85rem; border-top: 1px solid var(--border-subtle); white-space: nowrap;
        }
        .data-table .right { text-align: right; }
        .data-table tfoot td {
          background: var(--bg-surface-elevated); border-top: 2px solid var(--border-hover); font-weight: 600;
        }

        .cell-stack { display: flex; flex-direction: column; gap: 0.1rem; white-space: normal; max-width: 260px; }
        .cell-stack-right { display: flex; flex-direction: column; gap: 0.1rem; align-items: flex-end; }
        .conv { font-size: 0.72rem; color: var(--text-muted); }
        .strong { font-weight: 600; color: var(--text-primary); }
        .code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.72rem; color: var(--text-muted);
        }
        .accent { color: var(--primary); font-weight: 600; }
        .total { color: var(--primary); font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; }
        .muted { color: var(--text-muted); }
        .notes { color: var(--text-secondary); white-space: normal; max-width: 220px; }

        .waste {
          background: var(--status-low-stock-bg); color: var(--status-low-stock-text);
          border: 1px solid var(--status-low-stock-border); border-radius: var(--radius-full);
          padding: 0.1rem 0.45rem; font-size: 0.72rem; font-weight: 600;
        }

        .type-chip {
          display: inline-flex; align-items: center; gap: 0.25rem;
          background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);
          color: var(--text-secondary); font-size: 0.72rem; font-weight: 600;
          padding: 0.12rem 0.5rem; border-radius: var(--radius-full);
        }
        .type-sub {
          background: var(--accent-purple-soft); color: var(--accent-purple); border-color: #e9d5ff;
        }

        .path-chip {
          font-size: 0.75rem; color: var(--text-secondary);
          background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);
          padding: 0.1rem 0.5rem; border-radius: var(--radius-full);
        }

        .toast-pill {
          position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 2000;
          display: flex; align-items: center; gap: 0.65rem; padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md); font-family: var(--font-heading);
          font-size: 0.9rem; font-weight: 600; box-shadow: var(--shadow-lg);
        }
        .toast-success { background: #15803d; color: #fff; }
        .toast-error { background: #b91c1c; color: #fff; }
      `}</style>
    </AppShell>
  );
}
