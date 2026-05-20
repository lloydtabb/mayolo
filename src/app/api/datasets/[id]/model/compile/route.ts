import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, datasets } from "@/db";
import { getDefaultUser } from "@/lib/user";
import { compileMalloy } from "@/lib/malloy";

export const runtime = "nodejs";

const Body = z.object({ source: z.string().min(1).max(50_000) });

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/datasets/[id]/model/compile">,
) {
  const me = await getDefaultUser();
  const { id } = await ctx.params;
  const { source } = Body.parse(await req.json());
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!ds || ds.userId !== me.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const probe = `run: ${ds.name} -> { aggregate: __probe is count() }`;
  const result = await compileMalloy(source, probe);
  return NextResponse.json(result);
}
