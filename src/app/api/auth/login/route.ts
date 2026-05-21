import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { secret } = await req.json();
  if (!secret || secret !== env.APP_SECRET) {
    return NextResponse.json({ error: "wrong secret" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("malloyyo_auth", env.APP_SECRET, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
