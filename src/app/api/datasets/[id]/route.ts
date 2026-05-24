import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, datasets, malloyModels, users } from "@/db";
import { getSessionUser, UnauthorizedError } from "@/lib/user";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/datasets/[id]">,
) {
  let me;
  try { me = await getSessionUser(); } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "sign in required" }, { status: 401 });
    throw err;
  }

  const { id } = await ctx.params;
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!ds || ds.userId !== me.id) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [user] = await db.select().from(users).where(eq(users.id, ds.userId));

  const [model] = await db
    .select()
    .from(malloyModels)
    .where(eq(malloyModels.datasetId, id))
    .limit(1);

  return NextResponse.json({
    id: ds.id,
    name: ds.name,
    sourceUrl: ds.sourceUrl,
    mdTable: ds.mdTable,
    rowCount: ds.rowCount,
    status: ds.status,
    statusError: ds.statusError,
    workflowRunId: ds.workflowRunId,
    createdAt: ds.createdAt,
    readyAt: ds.readyAt,
    schema: ds.schemaJson,
    sampleRows: ds.sampleRowsJson,
    userSlug: user?.slug ?? null,
    malloyModel: model
      ? {
          source: model.source,
          generatedBy: model.generatedBy,
          compiledAt: model.compiledAt,
        }
      : null,
  });
}
