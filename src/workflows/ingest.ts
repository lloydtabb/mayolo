import { db, datasets, malloyModels } from "@/db";
import { eq } from "drizzle-orm";
import { FatalError } from "workflow";
import { setDatasetStatus, getDataset } from "@/lib/datasets";
import { createTableFromUrl, describeTable, sampleTable, mdMalloyRef, type ColumnInfo } from "@/lib/duckdb";
import { authorMalloyModel } from "@/lib/claude";
import { compileMalloy, introspectInlineModel } from "@/lib/malloy";

export async function modelExistingTable(datasetId: string) {
  "use workflow";
  try {
    await introspectStep(datasetId);
    await modelStep(datasetId);
    await finishStep(datasetId);
    return { ok: true as const, datasetId };
  } catch (err) {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    await markFailed(datasetId, msg);
    throw err;
  }
}

export async function ingestDataset(datasetId: string) {
  "use workflow";
  try {
    await loadStep(datasetId);
    await introspectStep(datasetId);
    await modelStep(datasetId);
    await finishStep(datasetId);
    return { ok: true as const, datasetId };
  } catch (err) {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    await markFailed(datasetId, msg);
    throw err;
  }
}

async function loadStep(datasetId: string) {
  "use step";
  const ds = await getDataset(datasetId);
  if (!ds) throw new Error(`dataset ${datasetId} not found`);
  await setDatasetStatus(datasetId, "ingesting");
  const { rowCount } = await createTableFromUrl(ds.mdTable, ds.sourceUrl);
  await db
    .update(datasets)
    .set({ rowCount })
    .where(eq(datasets.id, datasetId));
}

async function introspectStep(datasetId: string) {
  "use step";
  const ds = await getDataset(datasetId);
  if (!ds) throw new Error(`dataset ${datasetId} not found`);
  await setDatasetStatus(datasetId, "introspecting");
  const [schema, samples] = await Promise.all([
    describeTable(ds.mdTable),
    sampleTable(ds.mdTable, 50),
  ]);
  await setDatasetStatus(datasetId, "introspecting", {
    schemaJson: schema,
    sampleRowsJson: samples,
  });
}

async function modelStep(datasetId: string) {
  "use step";
  const ds = await getDataset(datasetId);
  if (!ds) throw new Error(`dataset ${datasetId} not found`);
  if (!ds.schemaJson || !ds.sampleRowsJson) {
    throw new Error(`dataset ${datasetId} missing schema/samples`);
  }
  await setDatasetStatus(datasetId, "modeling");

  const tableRef = mdMalloyRef(ds.mdTable);
  const probe = `run: ${ds.name} -> { aggregate: __probe is count() }`;
  const MAX_ATTEMPTS = 3;
  let previous: { source: string; compileError: string } | undefined;
  let lastError = "";
  let lastSource = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { source, model: generatedBy } = await authorMalloyModel({
      sourceName: ds.name,
      mdTableRef: tableRef,
      schema: ds.schemaJson as ColumnInfo[],
      samples: ds.sampleRowsJson as Record<string, unknown>[],
      previousAttempt: previous,
    });
    lastSource = source;

    const validate = await compileMalloy(source, probe);
    if (validate.ok) {
      const sources = await introspectInlineModel(source);
      await db.insert(malloyModels).values({
        datasetId,
        source,
        generatedBy,
        compiledAt: new Date(),
        sources: sources.length > 0 ? sources : undefined,
      });
      return;
    }
    lastError = validate.error;
    previous = { source, compileError: validate.error };
    console.warn(
      `[ingest:model] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${validate.error.slice(0, 200)}`,
    );
  }

  // Save the last attempt with the error as a comment so the user can
  // fix it in the editor rather than losing all of Claude's work.
  const errorComment = lastError
    .split("\n")
    .map((l) => `-- ${l}`)
    .join("\n");
  await db.insert(malloyModels).values({
    datasetId,
    source: `-- ⚠ Auto-generated model failed to compile — edit and save to fix.\n${errorComment}\n\n${lastSource}`,
    generatedBy: `claude (compile failed after ${MAX_ATTEMPTS} attempts)`,
    compiledAt: null,
    compileError: lastError,
  });
}

async function finishStep(datasetId: string) {
  "use step";
  await setDatasetStatus(datasetId, "ready", { readyAt: new Date() });
}

async function markFailed(datasetId: string, msg: string) {
  "use step";
  await setDatasetStatus(datasetId, "failed", { statusError: msg.slice(0, 8000) });
}
