import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../lib/env";

// Single shared client for the process. postgres-js handles pooling internally.
declare global {
  // eslint-disable-next-line no-var
  var __pg__: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__pg__ ??
  postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    prepare: false, // Neon pooler doesn't support prepared statements
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pg__ = client;
}

export const db = drizzle(client, { schema });
export * from "./schema";
