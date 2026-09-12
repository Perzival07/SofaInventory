"use client";

import { LogOut, User } from "lucide-react";
import { signOutAction } from "@/app/auth-actions";

export function SessionFooter({ email, name }: { email: string | null; name: string | null }) {
  if (!email) return null;

  return (
    <div className="session">
      <div className="who">
        <div className="avatar"><User size={14} /></div>
        <div className="ids">
          <span className="name">{name ?? "Signed in"}</span>
          <span className="email" title={email}>{email}</span>
        </div>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="out" title="Sign out" id="btn-signout">
          <LogOut size={14} />
        </button>
      </form>

      <style jsx>{`
        .session {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.55rem 0.7rem; margin-bottom: 0.6rem;
          background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
        }
        .who { display: flex; align-items: center; gap: 0.5rem; min-width: 0; flex: 1; }
        .avatar {
          width: 26px; height: 26px; min-width: 26px; border-radius: 50%;
          background: var(--primary-soft); border: 1px solid var(--primary-soft-border);
          color: var(--primary); display: flex; align-items: center; justify-content: center;
        }
        .ids { display: flex; flex-direction: column; min-width: 0; }
        .name {
          font-size: 0.78rem; font-weight: 600; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .email {
          font-size: 0.68rem; color: var(--text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .out {
          width: 28px; height: 28px; border-radius: var(--radius-sm);
          background: transparent; border: 1px solid var(--border-subtle);
          color: var(--text-secondary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .out:hover {
          background: var(--status-out-stock-bg); color: var(--status-out-stock-text);
          border-color: var(--status-out-stock-border);
        }
      `}</style>
    </div>
  );
}
