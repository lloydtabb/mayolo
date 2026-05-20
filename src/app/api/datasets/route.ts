import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, datasets } from "@/db";
import { getDefaultUser } from "@/lib/user";
import { nameToSlug } from "@/lib/slug";
import { start } from "workflow/api";
import { ingestDataset } from "@/workflows/ingest";

export const runtime = "nodejs";

const Body = z.object({
  sourceUrl: z.url(),
  name: z.string().min(1).max(64).optional(),
});

function deriveNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "dataset";
    return last.replace(/\.[^.]+$/, "");
  } catch {
    return "dataset";
  }
}

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const user = await getDefaultUser();
  const name = nameToSlug(body.name ?? deriveNameFromUrl(body.sourceUrl));
  const id = crypto.randomUUID();
  const mdTable = `${name}_${id.slice(0, 8)}`;

  const [row] = await db
    .insert(datasets)
    .values({
      id,
      userId: user.id,
      name,
      sourceUrl: body.sourceUrl,
      mdTable,
      status: "pending",
    })
    .returning();

  const run = await start(ingestDataset, [id]);
  await db
    .update(datasets)
    .set({ workflowRunId: run.runId })
    .where(eq(datasets.id, id));

  return NextResponse.json({
    id: row.id,
    name: row.name,
    sourceUrl: row.sourceUrl,
    status: row.status,
    runId: run.runId,
    userSlug: user.slug,
    mcpUrl: `/mcp/${user.slug}`,
  });
}

export async function GET() {
  const rows = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      sourceUrl: datasets.sourceUrl,
      status: datasets.status,
      statusError: datasets.statusError,
      rowCount: datasets.rowCount,
      createdAt: datasets.createdAt,
      readyAt: datasets.readyAt,
    })
    .from(datasets)
    .orderBy(desc(datasets.createdAt))
    .limit(50);
  return NextResponse.json(rows);
}
