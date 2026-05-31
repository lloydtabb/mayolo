import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

// Routes that must never be blocked — OAuth discovery, MCP, and auth itself.
const ALWAYS_ALLOW = /^\/(api\/auth|api\/oauth|\.well-known|mcp|oauth\/consent)/;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (ALWAYS_ALLOW.test(pathname)) return NextResponse.next();

  const allowList = process.env.EMAIL_ALLOW_LIST;
  if (!allowList) return NextResponse.next();

  const session = await auth();
  if (!session?.user?.email) return NextResponse.next(); // not signed in — let route handle it

  const allowed = allowList.split(",").map((e) => e.trim().toLowerCase());
  if (!allowed.includes(session.user.email.toLowerCase())) {
    // Signed in but not allowed — sign them out and redirect to home.
    const signOutUrl = new URL("/api/auth/signout", req.url);
    signOutUrl.searchParams.set("callbackUrl", "/");
    return NextResponse.redirect(signOutUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
