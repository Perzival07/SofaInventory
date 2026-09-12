/**
 * Access control policy — pure functions, so the rules that decide who gets in
 * can be tested without standing up an OAuth flow.
 */

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Parse the allowlist from configuration.
 *
 * Comma-separated, case-insensitive, whitespace tolerant, because this gets
 * typed into a Vercel environment variable by hand.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
}

/**
 * Decide whether a Google identity may sign in.
 *
 * Deliberately fails CLOSED: an empty allowlist locks everyone out rather than
 * letting everyone in. A misconfigured deployment must not become an open door.
 */
export function canSignIn(
  email: string | null | undefined,
  emailVerified: boolean,
  allowlist: string[]
): AccessDecision {
  if (!email) {
    return { allowed: false, reason: "Google did not return an email address" };
  }

  // Google can return an unverified address on some account types; treating it
  // as proof of identity would let someone claim an address they do not own.
  if (!emailVerified) {
    return { allowed: false, reason: "This Google account's email is not verified" };
  }

  if (allowlist.length === 0) {
    return {
      allowed: false,
      reason:
        "No allowlist is configured. Set AUTH_ALLOWED_EMAILS before anyone can sign in.",
    };
  }

  const normalised = email.trim().toLowerCase();
  if (!allowlist.includes(normalised)) {
    return { allowed: false, reason: `${email} is not on the allowlist` };
  }

  return { allowed: true, reason: "Allowed" };
}

/** Routes reachable without a session. Everything else requires one. */
export const PUBLIC_PATHS = ["/signin", "/api/auth", "/access-denied"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Whether auth is configured well enough to actually enforce anything. */
export function authReadiness(env: {
  clientId?: string;
  clientSecret?: string;
  secret?: string;
  allowlist?: string;
}): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!env.clientId) missing.push("AUTH_GOOGLE_ID");
  if (!env.clientSecret) missing.push("AUTH_GOOGLE_SECRET");
  if (!env.secret || env.secret.length < 32) missing.push("AUTH_SECRET (32+ chars)");
  if (parseAllowlist(env.allowlist).length === 0) missing.push("AUTH_ALLOWED_EMAILS");
  return { ready: missing.length === 0, missing };
}
