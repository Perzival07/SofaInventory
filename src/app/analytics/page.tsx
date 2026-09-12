"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Loader2, TrendingUp, Layers, Clock, Scale, Download, CalendarRange, AlertTriangle,
} from "lucide-react";
import { formatINR } from "@/lib/formatters";
import { AGEING_ORDER } from "@/lib/analytics-logic";
import { fetchAnalyticsAction, fyExportCsvAction, AnalyticsPageData } from "@/app/analytics-actions";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try { setData(await fetchAnalyticsAction()); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const downloadCsv = async () => {
    setDownloading(true);
    const { csv, filename } = await fyExportCsvAction();
    setDownloading(false);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !data) {
    return (
      <AppShell title="Analytics" subtitle="Valuation, margin, ageing and seasonality">
        <div className="state"><Loader2 size={28} className="spin" /><p>Loading...</p></div>
        <style jsx>{`
          .state { padding: 4rem; text-align: center; color: var(--text-secondary);
            display: flex; flex-direction: column; align-items: center; gap: 0.7rem; }
          .spin { animation: spin 1s linear infinite; color: var(--primary); }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </AppShell>
    );
  }

  const v = data.valuation;
  const maxRevenue = Math.max(1, ...data.seasonality.map((m) => m.revenue));
  const uncosted = data.margins.filter((m) => m.cost === 0 && m.revenue > 0);

  return (
    <AppShell title="Analytics" subtitle="Stock valuation, true margin, dead stock and seasonality">
      {/* Valuation */}
      <section className="panel">
        <h2 className="p-title"><Layers size={17} /> Stock Valuation</h2>
        <p className="p-sub">All four states, valued at actual cost.</p>
        <div className="val-grid">
          {[
            ["Raw material", v.raw_material],
            ["With job workers", v.with_vendor],
            ["Work in progress", v.wip],
            ["Finished goods", v.finished_goods],
          ].map(([label, amount]) => (
            <div className="val-card" key={label as string}>
              <span className="vl">{label}</span>
              <span className="vv">{formatINR(amount as number)}</span>
              <div className="vbar">
                <div className="vfill" style={{ width: `${v.total ? ((amount as number) / v.total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
          <div className="val-card total">
            <span className="vl">Total inventory</span>
            <span className="vv">{formatINR(v.total)}</span>
          </div>
        </div>
      </section>

      {/* Margin */}
      <section className="panel">
        <h2 className="p-title"><TrendingUp size={17} /> Gross Margin by SKU</h2>
        <p className="p-sub">On actual production cost carried by each unit, not a standard rate.</p>

        {uncosted.length > 0 && (
          <div className="warn">
            <AlertTriangle size={15} />
            <span>
              {uncosted.length} product(s) sold with no cost captured, so they show 100% margin.
              Record actual cost on finished units to make this figure real.
            </span>
          </div>
        )}

        {data.margins.length === 0 ? <div className="empty">No billed sales yet.</div> : (
          <div className="tw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Product</th><th className="r">Units</th><th className="r">Revenue</th>
                  <th className="r">Actual cost</th><th className="r">Gross margin</th><th className="r">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {data.margins.map((m) => (
                  <tr key={m.product_id}>
                    <td className="b">{m.product_name}</td>
                    <td className="r">{m.units_sold}</td>
                    <td className="r">{formatINR(m.revenue)}</td>
                    <td className="r">
                      {m.cost > 0 ? formatINR(m.cost) : <span className="bad">not captured</span>}
                    </td>
                    <td className="r b accent">{formatINR(m.gross_margin)}</td>
                    <td className="r">
                      <span className={m.margin_pct < 20 ? "bad" : m.margin_pct > 90 ? "muted" : "good"}>
                        {m.margin_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Seasonality */}
      <section className="panel">
        <h2 className="p-title"><CalendarRange size={17} /> Seasonality</h2>
        <p className="p-sub">
          Financial year, April to March, tagged by Bengali trade season rather than Gregorian quarter.
        </p>
        <div className="season">
          {data.seasonality.map((m) => (
            <div className="s-row" key={m.month_index}>
              <span className="s-month">{m.month_label.slice(0, 3)}</span>
              <div className="s-bar">
                <div className="s-fill" style={{ width: `${(m.revenue / maxRevenue) * 100}%` }} />
              </div>
              <span className="s-val">{m.revenue > 0 ? formatINR(m.revenue) : "—"}</span>
              <span className="s-season">{m.season ?? ""}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Ageing */}
      <section className="panel">
        <h2 className="p-title"><Clock size={17} /> Dead Stock &amp; Ageing</h2>
        <div className="age-cols">
          {[["Raw material", data.deadStock.raw_ageing], ["Finished goods", data.deadStock.fg_ageing]].map(
            ([label, buckets]) => (
              <div key={label as string}>
                <h3 className="sub">{label as string}</h3>
                <div className="tw">
                  <table className="dt">
                    <thead><tr><th>Age</th><th className="r">Items</th><th className="r">Value</th></tr></thead>
                    <tbody>
                      {(buckets as typeof data.deadStock.raw_ageing).map((b) => (
                        <tr key={b.label} className={b.label === AGEING_ORDER[4] && b.count > 0 ? "row-warn" : ""}>
                          <td>{b.label}</td>
                          <td className="r">{b.count || "—"}</td>
                          <td className="r b">{b.value > 0 ? formatINR(b.value) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* Make vs buy */}
      {data.makeVsBuy.length > 0 && (
        <section className="panel">
          <h2 className="p-title"><Scale size={17} /> Make vs Buy</h2>
          <div className="tw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Operation</th><th className="r">In-house</th>
                  <th className="r">Outsourced (effective)</th><th>Cheaper</th>
                </tr>
              </thead>
              <tbody>
                {data.makeVsBuy.map((l, i) => (
                  <tr key={i}>
                    <td className="b">{l.operation}</td>
                    <td className="r">{formatINR(l.in_house_cost)}</td>
                    <td className="r">{formatINR(l.job_work_effective_cost)}</td>
                    <td>
                      <span className={`chip ${l.cheaper === "make" ? "c-make" : "c-buy"}`}>
                        {l.cheaper === "make" ? "Make" : "Buy"} · {formatINR(l.difference)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FY export */}
      <section className="panel">
        <div className="fy-head">
          <div>
            <h2 className="p-title"><Download size={17} /> Financial Year Export</h2>
            <p className="p-sub">
              FY {data.fyExport.financial_year} — the figures your accountant asks for,
              produced whether or not the shop is registered.
            </p>
          </div>
          <button className="btn btn-primary" onClick={downloadCsv} disabled={downloading} id="btn-download-fy">
            <Download size={15} /><span>{downloading ? "Preparing..." : "Download CSV"}</span>
          </button>
        </div>
        <div className="tw">
          <table className="dt">
            <thead><tr><th>Section</th><th>Item</th><th className="r">Amount</th><th>Note</th></tr></thead>
            <tbody>
              {data.fyExport.rows.map((r, i) => (
                <tr key={i}>
                  <td className="muted">{r.section}</td>
                  <td className="b">{r.label}</td>
                  <td className="r b">{formatINR(r.value)}</td>
                  <td className="note">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .panel {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .p-title { font-size: 1.05rem; display: flex; align-items: center; gap: 0.45rem; }
        .p-sub { font-size: 0.8rem; color: var(--text-secondary); margin: 0.2rem 0 1rem; line-height: 1.45; }
        .sub { font-size: 0.85rem; margin-bottom: 0.6rem; color: var(--text-secondary); }
        .empty { padding: 1.75rem; text-align: center; color: var(--text-secondary); }

        .val-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
        @media (min-width: 900px) { .val-grid { grid-template-columns: repeat(5, 1fr); } }
        .val-card {
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.85rem; display: flex; flex-direction: column; gap: 0.3rem;
        }
        .val-card.total { background: var(--primary-soft); border-color: var(--primary-soft-border); }
        .vl { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--text-secondary); font-weight: 600; }
        .vv { font-family: var(--font-heading); font-size: 1.15rem; font-weight: 700; color: var(--text-primary); }
        .val-card.total .vv { color: var(--primary); }
        .vbar { height: 4px; background: var(--bg-surface-elevated); border-radius: var(--radius-full); }
        .vfill { height: 100%; background: var(--primary); border-radius: var(--radius-full); }

        .season { display: flex; flex-direction: column; gap: 0.35rem; }
        .s-row { display: grid; grid-template-columns: 38px 1fr 90px; gap: 0.6rem; align-items: center; }
        @media (min-width: 720px) { .s-row { grid-template-columns: 38px 1fr 100px 170px; } }
        .s-month { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); }
        .s-bar { height: 16px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); overflow: hidden; }
        .s-fill { height: 100%; background: var(--primary); border-radius: var(--radius-sm); }
        .s-val { font-size: 0.78rem; text-align: right; font-weight: 600; color: var(--text-primary); }
        .s-season { font-size: 0.7rem; color: var(--text-muted); display: none; }
        @media (min-width: 720px) { .s-season { display: block; } }

        .age-cols { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
        @media (min-width: 800px) { .age-cols { grid-template-columns: 1fr 1fr; } }

        .fy-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }

        .warn {
          display: flex; gap: 0.55rem; align-items: flex-start; margin-bottom: 1rem;
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          color: var(--status-low-stock-text); border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem; font-size: 0.8rem; line-height: 1.45;
        }

        .tw { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
        .dt { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .dt thead { background: var(--bg-surface-elevated); }
        .dt th { text-align: left; padding: 0.6rem 0.8rem; font-size: 0.66rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap; }
        .dt td { padding: 0.6rem 0.8rem; border-top: 1px solid var(--border-subtle); white-space: nowrap; }
        .dt .r { text-align: right; }
        .row-warn { background: var(--status-out-stock-bg); }
        .b { font-weight: 600; color: var(--text-primary); }
        .accent { color: var(--primary); }
        .good { color: var(--status-in-stock-text); font-weight: 600; }
        .bad { color: var(--status-out-stock-text); font-weight: 600; }
        .muted { color: var(--text-muted); }
        .note { color: var(--text-muted); font-size: 0.75rem; white-space: normal; max-width: 260px; }

        .chip { border-radius: var(--radius-full); padding: 0.1rem 0.5rem; font-size: 0.7rem; font-weight: 600; }
        .c-make { background: var(--accent-purple-soft); color: var(--accent-purple); border: 1px solid #e9d5ff; }
        .c-buy { background: var(--accent-blue-soft); color: var(--accent-blue); border: 1px solid #bae6fd; }
      `}</style>
    </AppShell>
  );
}
