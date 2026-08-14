import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/sign-in", "/sign-up", "/api/webhooks"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // Allow public routes and static assets
  if (isPublic) {
    return NextResponse.next();
  }

  // Check for Clerk session token cookie
  // const sessionToken =
  //   request.cookies.get("__session")?.value ||
  //   request.cookies.get("__client_uat")?.value;

  // TODO: Re-enable auth redirect once Clerk keys are configured in .env
  // if (!sessionToken && !pathname.startsWith("/sign-in")) {
  //   const signInUrl = new URL("/sign-in", request.url);
  //   signInUrl.searchParams.set("redirect_url", pathname);
  //   return NextResponse.redirect(signInUrl);
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
