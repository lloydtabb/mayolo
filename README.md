# mayolo

Point at a Parquet file. Get a Malloy MCP endpoint.

This tag (`minimal-core`) is the elegant vertical slice before any auth,
multi-table, or hill-climb code landed. It's what mayolo does in its smallest
runnable form, and the easiest version to read.

## How it works

```
                          ┌──────────────────────────────┐
                          │   Vercel Workflow DevKit     │
                          │   durable · retryable · resumable
                          └──────────────────────────────┘
                                       │
              ┌──────────┬─────────────┼─────────────┬──────────────┐
              ▼          ▼             ▼             ▼              ▼
        ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   URL  │ download│  │introspect│  │  model   │  │  finish  │  │  serve   │
   ───▶ │  → R2   │─▶│  DuckDB  │─▶│  Claude  │─▶│  insert  │─▶│   MCP    │
        │ stream  │  │ describe │  │  writes  │  │  malloy  │  │  /mcp/   │
        │         │  │ + sample │  │  Malloy  │  │  model   │  │  <slug>  │
        └─────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
             │            │             │             │              │
       Cloudflare R2  DuckDB reads   Anthropic    Postgres        JSON-RPC
       (S3-compat)    parquet over   Claude       (datasets,      MCP server
                      HTTPS, no      Opus 4.7     malloy_models)  with 5 tools
                      full scan
```

Each stage is its own `"use step"` function in `src/workflows/ingest.ts`. If
any step fails, the workflow retries it. If the process dies, the workflow
resumes where it left off on the next deploy.

## The MCP tools served at `/mcp/<user-slug>`

| Tool                       | What it does                                          |
| -------------------------- | ----------------------------------------------------- |
| `list_datasets`            | Names + schema summaries for every dataset on this endpoint. |
| `describe_semantic_model`  | The Malloy `source:` declaration for a dataset.       |
| `sample_rows`              | Up to 200 raw rows straight from R2/Parquet.          |
| `compile_analytical_query` | Compile a Malloy snippet → SQL (no execution).        |
| `run_analytical_query`     | Compile + run; return rows.                           |

Point Claude Desktop at the URL and it'll see all five.

## Suggested reading order

1. **`src/workflows/ingest.ts`** — the four-step durable workflow.
2. **`src/lib/claude.ts`** — the Malloy-authoring prompt. The system prompt
   teaches Claude the non-obvious Malloy syntax (pick/when, no SQL casts,
   time functions) so models compile on the first try more often than not.
3. **`src/lib/duckdb.ts`** — schema + samples without a full scan; how
   DuckDB is wired up to read R2 over HTTPS (and why `SET s3_*` instead of
   `CREATE SECRET`).
4. **`src/lib/mcp-tools.ts`** + **`src/app/mcp/[slug]/route.ts`** — the MCP
   server. Tools are pure functions; the route is a thin JSON-RPC dispatcher.

## Running it

You'll need:

- **Postgres** (Neon works; any postgres does) for state.
- **Cloudflare R2** (or any S3-compatible store) for parquet bytes.
- **An Anthropic API key** for Claude.

Then:

```bash
pnpm install
cp .env.example .env.local   # fill in the blanks
pnpm dev                     # starts Next + Workflow DevKit in dev mode
```

Open <http://localhost:3000>, paste a Parquet URL, watch the workflow run.

If you don't want to click around, `scripts/e2e.ts` ingests a NYC taxi
parquet end-to-end and prints what the MCP endpoint would serve — no UI or
auth setup required.

## What's intentionally absent at this tag

- **One Parquet URL per dataset.** Multi-table support came after.
- **No user accounts.** Slugs are namespaces; anyone with the MCP URL can
  query it.
- **No OAuth.** mayolo doesn't act as an OAuth provider yet. That scaffold
  is what makes `main` substantially more code than this tag.
- **No retries beyond the workflow's.** If Claude's first Malloy doesn't
  compile, the workflow retries the model step up to 3 times.

See `main` for the full version: multi-table datasets, CSV ingest, an
inline Malloy editor (CodeMirror), Google sign-in, MCP-as-OAuth-provider
for claude.ai integration, SSRF protection, and a hill-climb "model
laboratory" that hill-climbs the Malloy model against a probe bank.
