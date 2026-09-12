import { auth } from "@/auth";
import { canSignIn, parseAllowlist, authReadiness } from "./auth-config";

export class UnauthorizedError extends Error {
  constructor(reason = "Not signed in") {
    super(reason);
    this.name = "UnauthorizedError";
  }
}

/**
 * Independent authorisation check for server actions.
 *
 * Middleware is the first gate, but server actions are directly callable
 * endpoints — anything that reads or writes business data verifies for itself
 * rather than trusting that a request reached it legitimately.
 *
 * Re-checks the allowlist on every call, not just at sign-in, so removing an
 * address takes effect immediately instead of when their token happens to expire.
 */
export async function requireSession(): Promise<{ email: string }> {
  const state = authReadiness({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    secret: process.env.AUTH_SECRET,
    allowlist: process.env.AUTH_ALLOWED_EMAILS,
  });
  if (!state.ready) {
    throw new UnauthorizedError(`Auth is not configured: ${state.missing.join(", ")}`);
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new UnauthorizedError();

  const decision = canSignIn(email, true, parseAllowlist(process.env.AUTH_ALLOWED_EMAILS));
  if (!decision.allowed) throw new UnauthorizedError(decision.reason);

  return { email: email.toLowerCase() };
}

/** True/false form for places that render a fallback rather than throwing. */
export async function hasValidSession(): Promise<boolean> {
  try {
    await requireSession();
    return true;
  } catch {
    return false;
  }
}
