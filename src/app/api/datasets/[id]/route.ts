import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, datasets, malloyModels, users } from "@/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/datasets/[id]">,
) {
  const { id } = await ctx.params;
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!ds) return NextResponse.json({ error: "not found" }, { status: 404 });

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
