import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { env } from "./env";
import type { ColumnInfo } from "./duckdb";

const anthropic = createAnthropic({ apiKey: env.AI_GATEWAY_API_KEY });

// NOTE: this is a JS template literal, so every backtick must be escaped.
// To keep it readable we avoid backticks entirely inside the prompt body —
// quoted identifiers and code samples use ASCII quotes/indentation instead.
const SYSTEM = [
  "You are an expert Malloy data modeler. Given a Parquet file's schema and a few sample rows, write ONE Malloy source: declaration with thoughtful dimensions and measures.",
  "",
  "OUTPUT FORMAT:",
  "- ONLY Malloy code. No markdown fences, no commentary, no explanation.",
  '- Exactly one "source:" block. NO "run:" queries, NO "view:" blocks.',
  '- The source MUST be backed by duckdb.table(\'<database>.main.<table>\').',
  "",
  "MALLOY SYNTAX RULES — these are non-obvious; read carefully:",
  "",
  "1. Conditional expressions use Malloy's pick syntax — NOT SQL's CASE/WHEN/THEN:",
  "     dimension: bucket is",
  "       pick '0-1 mi' when trip_distance < 1",
  "       pick '1-3 mi' when trip_distance < 3",
  "       else '10+ mi'",
  "   Pattern: pick <VALUE> when <COND>. NEVER write the word 'then' anywhere in Malloy.",
  "",
  "2. Do NOT use SQL-style casts (x::number, CAST(x AS ...)). If you need a numeric expression, just use arithmetic on already-numeric columns.",
  "",
  "3. Do NOT use timestamp subtraction (t2 - t1). For durations use:",
  "     timestamp_diff(t1, t2, minute)",
  "   or skip the dimension entirely if unsure.",
  "",
  "4. Time-of-day / day-of-week from timestamps use named functions:",
  "     pickup_hour is hour(tpep_pickup_datetime)",
  "     pickup_dow  is day_of_week(tpep_pickup_datetime)",
  "   year, month, week, day, hour, minute, second are all functions on timestamps.",
  "",
  "5. Column names: reference them exactly as in the schema (lowercase if lowercase, etc). DuckDB is case-insensitive so 'Airport_fee' and 'airport_fee' both work.",
  "",
  "6. Division-by-zero safety: a / nullif(b, 0) is fine; nullif is supported.",
  "",
  "7. Boolean dimensions: 'is_x is x > 0' is fine. Don't use pick for booleans — just an expression.",
  "",
  "CONTENT GUIDELINES:",
  "- Include 3–8 measure declarations: counts, sums, averages, mins/maxes of numeric and timestamp columns.",
  "- Include 2–8 dimension declarations: derived fields ONLY. Don't redeclare plain columns.",
  "- Keep it conservative — only declare things that are obviously meaningful from the schema and samples.",
  "",
  "EXAMPLE SHAPE:",
  "",
  "source: yellow_taxi is duckdb.table('mayolo.main.yellow_taxi_abc12345') extend {",
  "  measure:",
  "    trip_count is count()",
  "    total_fare is fare_amount.sum()",
  "    avg_tip is tip_amount.avg()",
  "  dimension:",
  "    pickup_hour is hour(tpep_pickup_datetime)",
  "    is_airport_trip is pulocationid = 132 or pulocationid = 138",
  "    distance_bucket is",
  "      pick '0-1 mi' when trip_distance < 1",
  "      pick '1-3 mi' when trip_distance < 3",
  "      else '10+ mi'",
  "}",
].join("\n");

const MODEL = "claude-opus-4-7";

type Sample = Record<string, unknown>;

export async function authorMalloyModel(args: {
  sourceName: string;
  mdTableRef: string;
  schema: ColumnInfo[];
  samples: Sample[];
  previousAttempt?: { source: string; compileError: string };
}): Promise<{ source: string; model: string; usage: unknown }> {
  const { sourceName, mdTableRef, schema, samples, previousAttempt } = args;

  const schemaDump = schema
    .map((c) => `  ${c.name}: ${c.type}${c.nullable ? " (nullable)" : ""}`)
    .join("\n");

  const sampleDump = JSON.stringify(samples.slice(0, 5), null, 2);

  const baseFacts = `Source name: ${sourceName}
MotherDuck table: ${mdTableRef}

Schema:
${schemaDump}

Sample rows (first 5):
${sampleDump}`;

  const prompt = previousAttempt
    ? `${baseFacts}

Your previous attempt failed to compile. The compiler reported:

${previousAttempt.compileError}

Previous attempt:

${previousAttempt.source}

Rewrite the source so it compiles. Drop or rewrite the offending construct — do not invent syntax. Use duckdb.table('${mdTableRef}') as the table reference. Output only Malloy code.`
    : `${baseFacts}

Write the Malloy source. Use duckdb.table('${mdTableRef}') as the table reference.`;

  const res = await generateText({
    model: anthropic(MODEL),
    system: SYSTEM,
    prompt,
    maxOutputTokens: 4000,
  });

  return {
    source: stripFences(res.text.trim()),
    model: MODEL,
    usage: res.usage,
  };
}

function stripFences(s: string): string {
  // Defensive: strip ```malloy / ``` blocks if Claude adds them anyway.
  const m = s.match(/^```(?:malloy)?\n?([\s\S]*?)\n?```$/);
  return m ? m[1].trim() : s;
}
