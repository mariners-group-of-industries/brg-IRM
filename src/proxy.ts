import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const STAFF_COOKIE = "irm_session";
const PORTAL_COOKIE = "irm_portal_session";
const secret = new TextEncoder().encode(
  process.env.IRM_SESSION_SECRET ?? "irm-dev-only-secret-change-me",
);

async function valid(token: string | undefined, audience: "irm-staff" | "irm-portal"): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret, { audience, issuer: "irm" });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes authorize themselves (JSON 401s, not redirects).
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Root route: default to Shareholder surface
  if (pathname === "/") {
    const portalSigned = await valid(request.cookies.get(PORTAL_COOKIE)?.value, "irm-portal");
    if (portalSigned) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    const staffSigned = await valid(request.cookies.get(STAFF_COOKIE)?.value, "irm-staff");
    if (staffSigned) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }

  // Admin access point: /admin or /admin/...
  if (pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/admin/")) {
    const staffSigned = await valid(request.cookies.get(STAFF_COOKIE)?.value, "irm-staff");
    return staffSigned
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.redirect(new URL("/login?next=/dashboard", request.url));
  }

  // Shareholder portal — separate surface, separate cookie.
  if (pathname === "/portal/login" || pathname.startsWith("/portal/login/")) {
    // The page also checks current register status; an otherwise valid cookie
    // for a suspended holder must be allowed to reach sign-in again.
    return NextResponse.next();
  }
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    const signed = await valid(request.cookies.get(PORTAL_COOKIE)?.value, "irm-portal");
    if (!signed) {
      const login = new URL("/portal/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  // Staff (admin) surface.
  if (pathname === "/login") {
    const signed = await valid(request.cookies.get(STAFF_COOKIE)?.value, "irm-staff");
    return signed
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }
  const signed = await valid(request.cookies.get(STAFF_COOKIE)?.value, "irm-staff");
  if (!signed) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, static assets and public files.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp|css|js|map)$).*)",
  ],
};
