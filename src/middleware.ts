import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { isPublicPath, authReadiness } from "@/lib/auth-config";

/**
 * Gate every route behind a VERIFIED session.
 *
 * An earlier version checked only that a cookie named authjs.session-token
 * existed, which meant anyone could forge one and walk straight in. The session
 * is now verified by Auth.js — `req.auth` is null unless the JWT signature
 * checks out against AUTH_SECRET.
 *
 * Fails closed: if auth is not fully configured the whole app is locked, rather
 * than left open.
 */
function readiness() {
  return authReadiness({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    secret: process.env.AUTH_SECRET,
    allowlist: process.env.AUTH_ALLOWED_EMAILS,
  });
}

function toSignin(request: NextRequest, params: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.search = "";
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

const guarded = auth((request) => {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const state = readiness();
  if (!state.ready) {
    return toSignin(request as unknown as NextRequest, { setup: state.missing.join(",") });
  }

  // req.auth is populated only when the JWT verifies. A forged or expired
  // cookie leaves it null.
  if (!request.auth?.user?.email) {
    return toSignin(request as unknown as NextRequest, { from: pathname });
  }

  return NextResponse.next();
});

export default function middleware(request: NextRequest, event: never) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  // Auth.js cannot initialise without AUTH_SECRET, so handle that case before
  // handing the request to it.
  const state = readiness();
  if (!state.ready) return toSignin(request, { setup: state.missing.join(",") });

  return (guarded as unknown as (r: NextRequest, e: never) => Response)(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
