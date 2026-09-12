/**
 * Access control tests. The important property is that every failure mode
 * fails CLOSED — a misconfiguration must lock people out, never let them in.
 *
 * Run with:  npm run test:auth
 */

import {
  parseAllowlist, canSignIn, isPublicPath, authReadiness,
} from "../auth-config";

let passed = 0, failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected ${e}\n      actual   ${a}`); }
}

// -----------------------------------------------------------------------------
console.log("\n1. Parsing the allowlist as typed by a human");
{
  check("single address", parseAllowlist("loknathsofacenter@gmail.com"),
    ["loknathsofacenter@gmail.com"]);
  check("comma separated", parseAllowlist("a@x.com,b@y.com"), ["a@x.com", "b@y.com"]);
  check("tolerates spaces", parseAllowlist(" a@x.com , b@y.com "), ["a@x.com", "b@y.com"]);
  check("lowercases", parseAllowlist("Loknath@Gmail.COM"), ["loknath@gmail.com"]);
  check("drops entries that are not addresses", parseAllowlist("a@x.com,rubbish,b@y.com"),
    ["a@x.com", "b@y.com"]);
  check("undefined gives an empty list", parseAllowlist(undefined), []);
  check("empty string gives an empty list", parseAllowlist(""), []);
  check("trailing comma is harmless", parseAllowlist("a@x.com,"), ["a@x.com"]);
}

// -----------------------------------------------------------------------------
console.log("\n2. Sign-in decisions");
{
  const allow = ["loknathsofacenter@gmail.com"];

  check("the owner gets in",
    canSignIn("loknathsofacenter@gmail.com", true, allow).allowed, true);
  check("case does not matter",
    canSignIn("LoknathSofaCenter@Gmail.com", true, allow).allowed, true);
  check("surrounding whitespace does not matter",
    canSignIn("  loknathsofacenter@gmail.com  ", true, allow).allowed, true);

  const stranger = canSignIn("someone.else@gmail.com", true, allow);
  check("a stranger is refused", stranger.allowed, false);
  check("and told why", stranger.reason.includes("not on the allowlist"), true);
}

// -----------------------------------------------------------------------------
console.log("\n3. Every failure mode fails CLOSED");
{
  const allow = ["owner@shop.com"];

  check("no email at all is refused", canSignIn(null, true, allow).allowed, false);
  check("empty email is refused", canSignIn("", true, allow).allowed, false);
  check("undefined email is refused", canSignIn(undefined, true, allow).allowed, false);

  // An unverified Google address is not proof the person owns it.
  const unverified = canSignIn("owner@shop.com", false, allow);
  check("an unverified address is refused even when allowlisted", unverified.allowed, false);
  check("and says so", unverified.reason.includes("not verified"), true);

  // The dangerous case: someone deploys without setting the allowlist.
  const noList = canSignIn("anyone@anywhere.com", true, []);
  check("an EMPTY allowlist locks everyone out, rather than letting everyone in",
    noList.allowed, false);
  check("and explains the misconfiguration",
    noList.reason.includes("AUTH_ALLOWED_EMAILS"), true);

  check("the owner is still refused when the list is empty",
    canSignIn("owner@shop.com", true, []).allowed, false);
}

// -----------------------------------------------------------------------------
console.log("\n4. A near-miss address must not slip through");
{
  const allow = ["loknathsofacenter@gmail.com"];
  for (const attempt of [
    "loknathsofacenter@gmail.co",
    "loknathsofacenter@gmail.com.attacker.com",
    "xloknathsofacenter@gmail.com",
    "loknathsofacenter+alias@gmail.com",
    "loknathsofacenter@googlemail.com",
  ]) {
    check(`refuses ${attempt}`, canSignIn(attempt, true, allow).allowed, false);
  }
}

// -----------------------------------------------------------------------------
console.log("\n5. Which paths bypass the session check");
{
  check("the sign-in page is public", isPublicPath("/signin"), true);
  check("the auth callback is public", isPublicPath("/api/auth/callback/google"), true);
  check("the denial page is public", isPublicPath("/access-denied"), true);

  for (const p of ["/", "/sales", "/integrations", "/settings", "/analytics", "/materials"]) {
    check(`${p} requires a session`, isPublicPath(p), false);
  }

  // A path that merely starts with the same letters must not be treated as public.
  check("/signin-something-else is NOT public", isPublicPath("/signin-evil"), false);
  check("/api/authorised is NOT public", isPublicPath("/api/authorised"), false);
}

// -----------------------------------------------------------------------------
console.log("\n6. Readiness reporting");
{
  const complete = authReadiness({
    clientId: "abc.apps.googleusercontent.com",
    clientSecret: "GOCSPX-xyz",
    secret: "a-secret-that-is-at-least-32-characters",
    allowlist: "owner@shop.com",
  });
  check("a full configuration is ready", complete.ready, true);
  check("nothing missing", complete.missing, []);

  const empty = authReadiness({});
  check("an empty configuration is not ready", empty.ready, false);
  check("and lists everything needed", empty.missing.length, 4);

  const shortSecret = authReadiness({
    clientId: "x", clientSecret: "y", secret: "tooshort", allowlist: "a@b.com",
  });
  check("a short AUTH_SECRET is rejected",
    shortSecret.missing.includes("AUTH_SECRET (32+ chars)"), true);

  const noList = authReadiness({
    clientId: "x", clientSecret: "y",
    secret: "a-secret-that-is-at-least-32-characters", allowlist: "",
  });
  check("a missing allowlist blocks readiness", noList.ready, false);
}

// -----------------------------------------------------------------------------
console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
