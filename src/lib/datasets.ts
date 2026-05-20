import { db, datasets, type DatasetStatus } from "@/db";
import { eq } from "drizzle-orm";

export async function setDatasetStatus(
  id: string,
  status: DatasetStatus,
  patch: Partial<{
    statusError: string | null;
    schemaJson: unknown;
    sampleRowsJson: unknown;
    rowCount: number;
    workflowRunId: string;
    readyAt: Date;
  }> = {},
): Promise<void> {
  await db
    .update(datasets)
    .set({
      status,
      ...patch,
    })
    .where(eq(datasets.id, id));
}

export async function getDataset(id: string) {
  const [row] = await db.select().from(datasets).where(eq(datasets.id, id));
  return row;
}
