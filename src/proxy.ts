import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseSession } from "@/lib/auth/session";
import { isAdminCapableRole } from "@/lib/admin/rules";

// Optimistic auth checks — secure checks still run in the DAL on every
// account/admin page/action (proxy is only the first filter).

const PROTECTED_PREFIXES = ["/account", "/checkout"];
const ADMIN_PREFIX = "/admin";
const AUTH_PAGES = ["/login", "/register"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.some((p) => path === p);
  const isAdminRoute = path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`);

  if (!isProtected && !isAuthPage && !isAdminRoute) return NextResponse.next();

  const token = req.cookies.get("reyhan-session")?.value;
  const session = parseSession(token);

  // Admin: optimistic first filter only — role claims in the signed session
  // are never the authorization source of truth. The layout-level
  // requireAdmin() re-resolves the role from the database user row and is
  // deny-by-default; this hop just avoids rendering a redirect chain for
  // obvious anonymous/customer traffic.
  if (isAdminRoute) {
    if (!session) {
      const loginUrl = new URL("/login", req.nextUrl);
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdminCapableRole(session.role)) {
      return NextResponse.redirect(new URL("/account", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (isProtected && !session) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  // Logged-in users skip the login/register pages.
  if (isAuthPage && session && path === "/login") {
    return NextResponse.redirect(new URL("/account", req.nextUrl));
  }
  if (isAuthPage && session && path === "/register") {
    return NextResponse.redirect(new URL("/account", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/checkout", "/login", "/register", "/admin/:path*", "/admin"],
};
