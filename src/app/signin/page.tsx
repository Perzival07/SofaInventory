import { ShieldAlert, LogIn } from "lucide-react";
import { signIn } from "@/auth";
import { Logo } from "@/components/Logo";
import { authReadiness } from "@/lib/auth-config";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; from?: string; error?: string }>;
}) {
  const params = await searchParams;
  const readiness = authReadiness({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    secret: process.env.AUTH_SECRET,
    allowlist: process.env.AUTH_ALLOWED_EMAILS,
  });

  return (
    <main className="wrap">
      <div className="card">
        <div className="brand">
          <Logo size={150} variant="full" priority />
          <p className="tagline">Production &amp; Inventory</p>
        </div>

        {!readiness.ready ? (
          <div className="setup">
            <div className="setup-head">
              <ShieldAlert size={18} />
              <h2>Sign-in is not configured yet</h2>
            </div>
            <p>
              The app is locked until these environment variables are set. Until then
              nobody can sign in — including you — which is deliberate: a half-configured
              deployment must not be an open ERP.
            </p>
            <ul>
              {readiness.missing.map((m) => <li key={m}><code>{m}</code></li>)}
            </ul>
            <div className="steps">
              <p className="steps-title">To finish setup</p>
              <ol>
                <li>
                  In Google Cloud Console, create an OAuth client ID (Web application) and add
                  {" "}<code>https://YOUR-DOMAIN/api/auth/callback/google</code> as an authorised
                  redirect URI.
                </li>
                <li>
                  On Vercel: Project → Settings → Environment Variables, add{" "}
                  <code>AUTH_GOOGLE_ID</code>, <code>AUTH_GOOGLE_SECRET</code>,{" "}
                  <code>AUTH_SECRET</code> (32+ random characters) and{" "}
                  <code>AUTH_ALLOWED_EMAILS</code>.
                </li>
                <li>Redeploy.</li>
              </ol>
              <p className="local">
                Locally, put the same four in <code>.env.local</code> and use{" "}
                <code>http://localhost:3000/api/auth/callback/google</code> as the redirect URI.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="lede">Sign in with the Google account authorised for this shop.</p>

            {params.error && (
              <div className="err">
                Sign-in did not complete. If you used a different Google account, try again
                with the authorised one.
              </div>
            )}

            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: params.from || "/" });
              }}
            >
              <button type="submit" className="google-btn" id="btn-google-signin">
                <LogIn size={17} />
                <span>Continue with Google</span>
              </button>
            </form>

            <p className="note">
              Only allowlisted accounts can sign in. Everyone else is refused even with a
              valid Google login.
            </p>
          </>
        )}
      </div>

      <style>{`
        .wrap {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 1.5rem; background: var(--bg-main);
        }
        .card {
          width: 100%; max-width: 460px; background: var(--bg-surface);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
          padding: 2rem; box-shadow: var(--shadow-md);
        }
        .brand {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.4rem; margin-bottom: 1.5rem;
        }
        .tagline {
          font-size: 0.78rem; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;
        }

        .lede {
          font-size: 0.9rem; color: var(--text-secondary);
          margin-bottom: 1.25rem; text-align: center;
        }

        .google-btn {
          width: 100%; display: inline-flex; align-items: center; justify-content: center;
          gap: 0.6rem; min-height: 48px; border-radius: var(--radius-md);
          background: var(--primary); color: #fff; border: none;
          font-family: var(--font-heading); font-size: 0.95rem; font-weight: 600;
          cursor: pointer; transition: background-color 150ms;
        }
        .google-btn:hover { background: var(--primary-hover); }

        .note {
          font-size: 0.76rem; color: var(--text-muted); margin-top: 1rem;
          line-height: 1.5; text-align: center;
        }
        .err {
          background: var(--status-out-stock-bg); border: 1px solid var(--status-out-stock-border);
          color: var(--status-out-stock-text); border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem; font-size: 0.82rem; margin-bottom: 1rem; line-height: 1.45;
        }

        .setup {
          background: var(--status-low-stock-bg); border: 1px solid var(--status-low-stock-border);
          border-radius: var(--radius-md); padding: 1rem 1.15rem; color: var(--status-low-stock-text);
        }
        .setup-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .setup-head h2 { font-size: 0.95rem; }
        .setup p { font-size: 0.82rem; line-height: 1.55; margin-bottom: 0.75rem; }
        .setup ul { margin: 0 0 0.85rem 1.1rem; }
        .setup li { font-size: 0.82rem; margin-bottom: 0.25rem; }
        .setup code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.76rem;
          background: rgba(0,0,0,0.07); padding: 0.05rem 0.3rem; border-radius: 4px;
        }
        .steps { border-top: 1px solid var(--status-low-stock-border); padding-top: 0.85rem; }
        .steps-title { font-weight: 700; margin-bottom: 0.4rem; }
        .steps ol { margin: 0 0 0.5rem 1.1rem; }
        .steps li { font-size: 0.8rem; margin-bottom: 0.45rem; line-height: 1.5; }
        .local { font-size: 0.78rem; opacity: 0.9; margin: 0; }
      `}</style>
    </main>
  );
}
