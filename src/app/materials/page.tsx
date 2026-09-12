"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { MaterialFormModal } from "@/components/MaterialFormModal";
import { BatchesModal } from "@/components/BatchesModal";
import {
  Search,
  Layers,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Flame,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  Material,
  MaterialCategory,
  MaterialInput,
  MaterialType,
  MATERIAL_TYPE_LABELS,
  Uom,
} from "@/lib/erp-types";
import { formatINR } from "@/lib/formatters";
import {
  fetchMaterialsAction,
  saveMaterialAction,
  deactivateMaterialAction,
} from "@/app/erp-actions";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [formTarget, setFormTarget] = useState<Material | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [batchTarget, setBatchTarget] = useState<Material | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchMaterialsAction(search, typeFilter);
      setMaterials(data.materials);
      setCategories(data.categories);
      setUoms(data.uoms);
    } catch (err) {
      console.error(err);
      showToast("Failed to load materials", "error");
    } finally {
      setIsLoading(false);
    }
  }, [search, typeFilter, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server whenever search/type filter change
    load();
  }, [load]);

  const handleSave = async (input: MaterialInput, id?: number) => {
    const res = await saveMaterialAction(input, id);
    if (!res.success) throw new Error(res.error);
    showToast(id ? "Material updated." : `Material "${input.name}" created.`);
    await load();
  };

  const handleDelete = async (m: Material) => {
    if (!confirm(`Remove "${m.name}" from the material master?`)) return;
    const res = await deactivateMaterialAction(m.id);
    if (!res.success) {
      showToast(res.error || "Failed to remove material", "error");
      return;
    }
    showToast("Material removed.");
    await load();
  };

  const types = ["All", ...Object.keys(MATERIAL_TYPE_LABELS)];
  const lowStock = materials.filter(
    (m) => m.reorder_level > 0 && (m.stock_quantity ?? 0) <= m.reorder_level
  ).length;
  // Valued at actual batch cost, not standard rate, so it reconciles with
  // stock held by vendors and with what was actually paid.
  const stockValue = materials.reduce((sum, m) => sum + (m.stock_value ?? 0), 0);

  return (
    <AppShell
      title="Raw Materials"
      subtitle="Material master with multi-UOM, batch and dye-lot tracking"
      actionLabel="New Material"
      onAction={() => {
        setFormTarget(null);
        setIsFormOpen(true);
      }}
    >
      {/* KPI row */}
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-label">Active Materials</span>
          <span className="kpi-value">{materials.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Raw Material Value</span>
          <span className="kpi-value accent">{formatINR(stockValue)}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Below Reorder Level</span>
          <span className={`kpi-value ${lowStock > 0 ? "danger" : ""}`}>{lowStock}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="search-wrap">
          <Search size={17} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by material name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="input-material-search"
          />
        </div>
        <div className="type-pills">
          {types.map((t) => (
            <button
              key={t}
              className={`type-pill ${typeFilter === t ? "type-pill-active" : ""}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === "All" ? "All" : MATERIAL_TYPE_LABELS[t as MaterialType]}
            </button>
          ))}
        </div>
      </div>

      {/* Material list */}
      {isLoading ? (
        <div className="state-block">
          <Loader2 size={30} className="spin" />
          <p>Loading material master...</p>
        </div>
      ) : materials.length === 0 ? (
        <div className="state-block">
          <p>No materials found. Create your first raw material to get started.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="mat-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Type</th>
                <th>UOM Conversion</th>
                <th className="right">In Stock</th>
                <th className="right">Std. Rate</th>
                <th>Tracking</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const stock = m.stock_quantity ?? 0;
                const isLow = m.reorder_level > 0 && stock <= m.reorder_level;
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="mat-name-cell">
                        <span className="mat-name">{m.name}</span>
                        <span className="mat-code">{m.code}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-category">
                        {MATERIAL_TYPE_LABELS[m.material_type]}
                      </span>
                    </td>
                    <td>
                      <div className="uom-chain">
                        <span>1 {m.purchase_uom}</span>
                        <ArrowRight size={12} />
                        <span>{m.purchase_to_stock_factor} {m.stock_uom}</span>
                        <ArrowRight size={12} />
                        <span>
                          {(m.purchase_to_stock_factor * m.stock_to_consumption_factor).toLocaleString("en-IN")}{" "}
                          {m.consumption_uom}
                        </span>
                      </div>
                    </td>
                    <td className="right">
                      <div className="stock-cell">
                        <span className={`stock-qty ${isLow ? "low" : ""}`}>
                          {stock.toLocaleString("en-IN")} {m.stock_uom}
                        </span>
                        {isLow && (
                          <span className="badge badge-low-stock">
                            <AlertTriangle size={11} /> Reorder
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="right rate">{formatINR(m.standard_rate)}</td>
                    <td>
                      <div className="flags">
                        {m.tracks_batch && <span className="flag">Batch</span>}
                        {m.tracks_dye_lot && <span className="flag flag-lot">Dye lot</span>}
                        {m.shelf_life_days !== null && <span className="flag">Expiry</span>}
                        {m.is_hazardous && (
                          <span className="flag flag-haz"><Flame size={10} /> Hazmat</span>
                        )}
                        {m.is_offcut && <span className="flag">Offcut</span>}
                        {!m.tracks_batch && !m.tracks_dye_lot && m.shelf_life_days === null &&
                          !m.is_hazardous && !m.is_offcut && <span className="muted">—</span>}
                      </div>
                    </td>
                    <td className="right">
                      <div className="actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setBatchTarget(m)}
                          id={`btn-batches-${m.id}`}
                          title="View batches and lots"
                        >
                          <Layers size={14} />
                          <span>Batches</span>
                          {(m.batch_count ?? 0) > 0 && (
                            <span className="btn-count">{m.batch_count}</span>
                          )}
                        </button>
                        <button
                          className="btn-row-icon"
                          onClick={() => { setFormTarget(m); setIsFormOpen(true); }}
                          aria-label={`Edit ${m.name}`}
                          title="Edit material"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn-row-icon btn-row-icon-danger"
                          onClick={() => handleDelete(m)}
                          aria-label={`Remove ${m.name}`}
                          title="Remove material"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MaterialFormModal
        isOpen={isFormOpen}
        material={formTarget}
        categories={categories}
        uoms={uoms}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSave}
      />

      <BatchesModal
        material={batchTarget}
        isOpen={Boolean(batchTarget)}
        onClose={() => setBatchTarget(null)}
        onChanged={load}
      />

      {toast && (
        <div className={`toast-pill ${toast.type === "error" ? "toast-error" : "toast-success"}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        .kpi-row {
          display: grid; grid-template-columns: 1fr; gap: 0.85rem; margin-bottom: 1.5rem;
        }
        @media (min-width: 560px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }

        .kpi-card {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1rem 1.15rem;
          display: flex; flex-direction: column; gap: 0.25rem;
        }
        .kpi-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-secondary); font-weight: 600; }
        .kpi-value { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 700; }
        .kpi-value.accent { color: var(--primary); }
        .kpi-value.danger { color: var(--status-out-stock-text); }

        .filters { display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.35rem; }

        .search-wrap { position: relative; display: flex; align-items: center; max-width: 460px; }
        .search-icon { position: absolute; left: 0.9rem; color: var(--text-secondary); pointer-events: none; }
        .search-input {
          width: 100%; background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.95rem;
          padding: 0.65rem 1rem 0.65rem 2.5rem; min-height: 46px; outline: none;
        }
        .search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--border-focus); }

        .type-pills { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.25rem; scrollbar-width: none; }
        .type-pills::-webkit-scrollbar { display: none; }
        .type-pill {
          background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-secondary);
          font-size: 0.85rem; font-weight: 500; padding: 0.45rem 0.95rem; min-height: 38px;
          border-radius: var(--radius-full); white-space: nowrap; cursor: pointer;
          transition: all var(--transition-fast);
        }
        .type-pill:hover { border-color: var(--border-hover); color: var(--text-primary); }
        .type-pill-active { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }

        .state-block {
          padding: 4rem 2rem; text-align: center; color: var(--text-secondary);
          background: var(--bg-surface); border: 1px dashed var(--border-subtle);
          border-radius: var(--radius-lg);
          display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
        }
        .spin { animation: spin 1s linear infinite; color: var(--primary); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .table-wrap {
          overflow-x: auto; background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
        }
        .mat-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .mat-table thead { background: var(--bg-surface-elevated); border-bottom: 1px solid var(--border-subtle); }
        .mat-table th {
          text-align: left; padding: 0.85rem 1rem; font-family: var(--font-heading);
          font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--text-secondary); white-space: nowrap;
        }
        .mat-table td { padding: 0.85rem 1rem; border-top: 1px solid var(--border-subtle); vertical-align: middle; }
        .mat-table .right { text-align: right; }

        .mat-name-cell { display: flex; flex-direction: column; gap: 0.15rem; max-width: 260px; }
        .mat-name { font-weight: 600; color: var(--text-primary); }
        .mat-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.75rem; color: var(--text-muted);
        }

        .uom-chain {
          display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;
          font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap;
        }

        .stock-cell { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; }
        .stock-qty { font-weight: 700; color: var(--text-primary); white-space: nowrap; }
        .stock-qty.low { color: var(--status-out-stock-text); }
        .rate { font-weight: 600; color: var(--primary); white-space: nowrap; }

        .flags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
        .flag {
          display: inline-flex; align-items: center; gap: 0.2rem;
          background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);
          color: var(--text-secondary); font-size: 0.7rem; font-weight: 600;
          padding: 0.1rem 0.45rem; border-radius: var(--radius-full); white-space: nowrap;
        }
        .flag-lot { background: var(--accent-blue-soft); color: var(--accent-blue); border-color: #bae6fd; }
        .flag-haz { background: var(--status-out-stock-bg); color: var(--status-out-stock-text); border-color: var(--status-out-stock-border); }
        .muted { color: var(--text-muted); }

        .actions { display: flex; align-items: center; justify-content: flex-end; gap: 0.4rem; }
        .btn-count {
          background: rgba(255,255,255,0.25); border-radius: var(--radius-full);
          padding: 0 0.35rem; font-size: 0.7rem; min-width: 18px;
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
