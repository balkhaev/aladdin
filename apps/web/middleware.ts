import { getSessionCookie /*, getCookieCache*/ } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = getSessionCookie(request);

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin routes require authentication - role check happens on the page level
  // /admin/* routes will verify admin role in their page components

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Все страницы, кроме статики
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
