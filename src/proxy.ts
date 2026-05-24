import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "malloyyo_auth";

// Paths that bypass auth entirely.
const PUBLIC = [
  "/login",
  "/api/auth",        // next-auth (sign-in, callback, etc.)
  "/api/oauth",       // OAuth server endpoints
  "/.well-known",     // OAuth discovery
  "/_next",
  "/favicon.ico",
  "/oauth/consent",   // consent page (auth checked inside)
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // MCP endpoints are authenticated by the unguessable user slug.
  if (pathname.startsWith("/mcp/")) return NextResponse.next();

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const secret = process.env.APP_SECRET;
  const cookie = req.cookies.get(COOKIE)?.value;

  if (secret && cookie === secret) return NextResponse.next();

  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
