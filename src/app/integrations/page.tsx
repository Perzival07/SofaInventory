"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Loader2, KeyRound, ShieldAlert, Check, Trash2, Eye, Copy,
  CheckCircle2, AlertCircle, Lock, Database,
} from "lucide-react";
import { IntegrationDef } from "@/lib/integrations-types";
import {
  fetchIntegrationsAction, saveCredentialAction, deleteCredentialAction,
  verifyCredentialAction, generateAppSecretAction, IntegrationsPageData,
} from "@/app/integrations-actions";

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const load = useCallback(async () => {
    try { setData(await fetchIntegrationsAction()); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (service: string, field: string) => {
    const key = `${service}.${field}`;
    const value = drafts[key];
    if (!value?.trim()) return;

    setBusyKey(key);
    const res = await saveCredentialAction(service, field, value);
    setBusyKey(null);

    if (!res.success) { showToast(res.error ?? "Failed", "error"); return; }
    setDrafts((d) => ({ ...d, [key]: "" }));
    showToast("Saved and encrypted.");
    load();
  };

  const remove = async (service: string, field: string) => {
    if (!confirm(`Remove this credential? Anything using it will stop working.`)) return;
    await deleteCredentialAction(service, field);
    showToast("Credential removed.");
    load();
  };

  const verify = async (service: string, field: string) => {
    const res = await verifyCredentialAction(service, field);
    showToast(
      res.ok
        ? `Readable — ${res.length} characters decrypt correctly.`
        : `Cannot read: ${res.reason}`,
      res.ok ? "success" : "error"
    );
  };

  const genSecret = async () => {
    const { secret } = await generateAppSecretAction();
    setGenerated(secret);
    setCopied(false);
  };

  if (isLoading || !data) {
    return (
      <AppShell title="Integrations & Keys" subtitle="External service credentials">
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

  const stored = (code: string, field: string) =>
    data.statuses.find((s) => s.code === code)?.credentials.find((c) => c.field_key === field);

  return (
    <AppShell
      title="Integrations & Keys"
      subtitle="Credentials for external services, encrypted at rest"
    >
      {/* The gap that matters most */}
      {!data.auth_configured && (
        <section className="alert danger">
          <ShieldAlert size={20} />
          <div>
            <h2>This page has no login protecting it</h2>
            <p>
              Sign-in has not been built yet, so anyone who reaches this URL can add or
              remove credentials. Keys are encrypted in the database and are never sent back
              to this screen in full, but that does not stop someone from replacing them.
            </p>
            <p className="em">
              Do not enter live production keys until Google Sign-In is wired up and enforced.
              Test keys, or keys you can rotate cheaply, are fine.
            </p>
          </div>
        </section>
      )}

      {/* Encryption key */}
      <section className={`alert ${data.app_secret_configured ? "ok" : "warn"}`}>
        {data.app_secret_configured ? <Lock size={20} /> : <KeyRound size={20} />}
        <div>
          <h2>
            {data.app_secret_configured
              ? "Encryption active"
              : "APP_SECRET is not set — nothing can be saved"}
          </h2>
          {data.app_secret_configured ? (
            <p>
              Credentials are encrypted with AES-256-GCM before being written, using a key
              derived from your <code>APP_SECRET</code>. Changing that value makes every
              stored credential unreadable, so keep it safe.
            </p>
          ) : (
            <>
              <p>
                Credentials are refused rather than stored in plain text. Set an{" "}
                <code>APP_SECRET</code> environment variable of at least 32 characters, then
                reload.
              </p>
              <div className="gen">
                <button className="btn btn-secondary btn-sm" onClick={genSecret} id="btn-gen-secret">
                  Generate a secret
                </button>
                {generated && (
                  <div className="gen-out">
                    <code>{generated}</code>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { navigator.clipboard?.writeText(generated); setCopied(true); }}>
                      <Copy size={13} /><span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                )}
              </div>
              <p className="steps">
                On Vercel: Project → Settings → Environment Variables → add{" "}
                <code>APP_SECRET</code> → redeploy. Locally: add it to{" "}
                <code>.env.local</code>.
              </p>
            </>
          )}
        </div>
      </section>

      {!data.database_configured && (
        <section className="alert warn">
          <Database size={20} />
          <div>
            <h2>Running in in-memory demo mode</h2>
            <p>
              No <code>POSTGRES_URL</code> is set, so anything saved here disappears when the
              server restarts. Connect Vercel Postgres to persist credentials.
            </p>
          </div>
        </section>
      )}

      {/* Services */}
      {data.definitions.map((def: IntegrationDef) => {
        const status = data.statuses.find((s) => s.code === def.code);
        return (
          <section className="svc" key={def.code}>
            <div className="svc-head">
              <div>
                <h2 className="svc-name">
                  {def.name}
                  {status?.configured
                    ? <span className="chip ok-chip"><Check size={11} /> Configured</span>
                    : <span className="chip idle">{status?.filled ?? 0} of {status?.total ?? 0} set</span>}
                  {def.planned && <span className="chip planned">Not yet wired</span>}
                </h2>
                <p className="svc-purpose">{def.purpose}</p>
                <p className="svc-used"><strong>Used by:</strong> {def.used_by}</p>
              </div>
            </div>

            <p className="docs">{def.docs_hint}</p>

            <div className="fields">
              {def.fields.map((f) => {
                const key = `${def.code}.${f.key}`;
                const existing = stored(def.code, f.key);
                return (
                  <div className="field" key={f.key}>
                    <div className="f-label">
                      <label htmlFor={`in-${key}`}>{f.label}</label>
                      {f.kind === "secret" && <span className="secret-tag">secret</span>}
                    </div>

                    {existing && (
                      <div className="existing">
                        <code className="masked">{existing.masked_value}</code>
                        <span className="upd">updated {existing.updated_at}</span>
                        <button className="mini" onClick={() => verify(def.code, f.key)}
                          title="Check it still decrypts" id={`btn-verify-${key}`}>
                          <Eye size={13} /> Verify
                        </button>
                        <button className="mini danger" onClick={() => remove(def.code, f.key)}
                          title="Remove" id={`btn-del-${key}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    <div className="f-input">
                      <input
                        id={`in-${key}`}
                        type={f.kind === "secret" ? "password" : "text"}
                        className="form-input"
                        placeholder={existing ? "Enter a new value to replace" : f.placeholder}
                        value={drafts[key] ?? ""}
                        autoComplete="off"
                        disabled={!data.app_secret_configured}
                        onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      />
                      <button className="btn btn-primary btn-sm"
                        onClick={() => save(def.code, f.key)}
                        disabled={!data.app_secret_configured || !drafts[key]?.trim() || busyKey === key}
                        id={`btn-save-${key}`}>
                        {busyKey === key ? "Saving..." : existing ? "Replace" : "Save"}
                      </button>
                    </div>
                    {f.hint && <span className="f-hint">{f.hint}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="footnote">
        Stored values are never returned to this page in full — only the masked form above.
        Every save and delete is written to the audit log, without the value itself.
      </p>

      {toast && (
        <div className={`toast ${toast.type === "error" ? "t-err" : "t-ok"}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        .alert {
          display: flex; gap: 0.85rem; align-items: flex-start;
          border-radius: var(--radius-lg); padding: 1.1rem 1.25rem; margin-bottom: 1.25rem;
          border: 1px solid var(--border-subtle); border-left-width: 4px;
        }
        .alert h2 { font-size: 0.98rem; margin-bottom: 0.35rem; }
        .alert p { font-size: 0.83rem; line-height: 1.55; margin-bottom: 0.4rem; }
        .alert p:last-child { margin-bottom: 0; }
        .alert code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.78rem; background: rgba(0,0,0,0.06);
          padding: 0.05rem 0.3rem; border-radius: 4px;
        }
        .alert.danger {
          background: var(--status-out-stock-bg); border-color: var(--status-out-stock-border);
          border-left-color: var(--status-out-stock-text); color: var(--status-out-stock-text);
        }
        .alert.warn {
          background: var(--status-low-stock-bg); border-color: var(--status-low-stock-border);
          border-left-color: #d97706; color: var(--status-low-stock-text);
        }
        .alert.ok {
          background: var(--status-in-stock-bg); border-color: var(--status-in-stock-border);
          border-left-color: var(--status-in-stock-text); color: var(--status-in-stock-text);
        }
        .em { font-weight: 600; }
        .steps { opacity: 0.9; }
        .gen { margin: 0.6rem 0; }
        .gen-out {
          display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; flex-wrap: wrap;
        }
        .gen-out code {
          font-size: 0.75rem; word-break: break-all; background: var(--bg-surface);
          padding: 0.4rem 0.55rem; border-radius: var(--radius-sm);
          border: 1px solid var(--border-subtle);
        }

        .svc {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.25rem;
          box-shadow: var(--shadow-sm);
        }
        .svc-name {
          font-size: 1.02rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
        }
        .svc-purpose { font-size: 0.83rem; color: var(--text-secondary); margin-top: 0.25rem; line-height: 1.45; }
        .svc-used { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; }
        .docs {
          font-size: 0.78rem; color: var(--text-secondary); background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          padding: 0.55rem 0.75rem; margin: 0.85rem 0 1rem; line-height: 1.45;
        }

        .chip {
          display: inline-flex; align-items: center; gap: 0.2rem;
          border-radius: var(--radius-full); padding: 0.1rem 0.5rem;
          font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
        }
        .ok-chip {
          background: var(--status-in-stock-bg); color: var(--status-in-stock-text);
          border: 1px solid var(--status-in-stock-border);
        }
        .idle {
          background: var(--bg-surface-elevated); color: var(--text-muted);
          border: 1px solid var(--border-subtle);
        }
        .planned {
          background: var(--accent-purple-soft); color: var(--accent-purple); border: 1px solid #e9d5ff;
        }

        .fields { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .f-label { display: flex; align-items: center; gap: 0.4rem; }
        .f-label label {
          font-family: var(--font-heading); font-size: 0.84rem;
          font-weight: 600; color: var(--text-secondary);
        }
        .secret-tag {
          font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
          color: var(--primary); background: var(--primary-soft);
          border: 1px solid var(--primary-soft-border);
          padding: 0.05rem 0.35rem; border-radius: var(--radius-full);
        }

        .existing {
          display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap;
          background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md); padding: 0.45rem 0.7rem;
        }
        .masked {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.8rem; color: var(--text-primary);
        }
        .upd { font-size: 0.7rem; color: var(--text-muted); margin-right: auto; }
        .mini {
          display: inline-flex; align-items: center; gap: 0.25rem;
          border: 1px solid var(--border-subtle); background: var(--bg-surface);
          color: var(--text-secondary); border-radius: var(--radius-sm);
          padding: 0.2rem 0.45rem; font-size: 0.72rem; cursor: pointer;
        }
        .mini:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
        .mini.danger:hover {
          background: var(--status-out-stock-bg); color: var(--status-out-stock-text);
          border-color: var(--status-out-stock-border);
        }

        .f-input { display: flex; gap: 0.5rem; align-items: center; }
        .f-input :global(.form-input) { flex: 1; }
        .f-hint { font-size: 0.75rem; color: var(--text-muted); }

        .footnote {
          font-size: 0.76rem; color: var(--text-muted); line-height: 1.55;
          padding: 0 0.25rem 1rem;
        }

        .toast {
          position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 2000;
          display: flex; align-items: center; gap: 0.65rem; padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md); font-family: var(--font-heading);
          font-size: 0.86rem; font-weight: 600; box-shadow: var(--shadow-lg); max-width: 440px;
        }
        .t-ok { background: #15803d; color: #fff; }
        .t-err { background: #b45309; color: #fff; }
      `}</style>
    </AppShell>
  );
}
