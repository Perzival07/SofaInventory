import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function AccessDeniedPage() {
  return (
    <main className="wrap">
      <div className="card">
        <div className="logo-wrap"><Logo size={110} variant="full" /></div>
        <div className="icon"><ShieldX size={26} /></div>
        <h1>Access denied</h1>
        <p>
          That Google account is not authorised for this shop. Sign-in is restricted to a
          specific allowlisted address.
        </p>
        <p className="sub">
          If this is your shop and you expected to get in, check that{" "}
          <code>AUTH_ALLOWED_EMAILS</code> contains the exact address you signed in with.
        </p>
        <Link href="/signin" className="back">Try a different account</Link>
      </div>

      <style>{`
        .wrap {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 1.5rem; background: var(--bg-main);
        }
        .card {
          width: 100%; max-width: 420px; background: var(--bg-surface);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
          padding: 2rem; box-shadow: var(--shadow-md); text-align: center;
        }
        .logo-wrap { display: flex; justify-content: center; margin-bottom: 0.75rem; }
        .icon {
          width: 52px; height: 52px; margin: 0 auto 1rem; border-radius: 50%;
          background: var(--status-out-stock-bg); border: 1px solid var(--status-out-stock-border);
          color: var(--status-out-stock-text);
          display: flex; align-items: center; justify-content: center;
        }
        h1 { font-size: 1.2rem; margin-bottom: 0.65rem; }
        p { font-size: 0.87rem; color: var(--text-secondary); line-height: 1.55; margin-bottom: 0.75rem; }
        .sub { font-size: 0.78rem; color: var(--text-muted); }
        code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem;
          background: var(--bg-surface-elevated); padding: 0.05rem 0.3rem; border-radius: 4px;
        }
        .back {
          display: inline-block; margin-top: 0.75rem; color: var(--primary);
          font-size: 0.87rem; font-weight: 600; text-decoration: none;
        }
        .back:hover { text-decoration: underline; }
      `}</style>
    </main>
  );
}
