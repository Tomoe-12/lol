import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/sign-in",
  "/sign-up",
  "/access-denied",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/manifest.json",
  "/favicon.ico",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and public paths
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check local session cookie
  const session = request.cookies.get("pos_session")?.value;

  if (!session) {
    // Redirect to sign-in if trying to access protected route
    const loginUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
