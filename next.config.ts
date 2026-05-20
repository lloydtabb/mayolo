import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Only the native-binding packages need to stay external. Everything else
  // (Malloy, AI SDK, AWS SDK) can be bundled and tree-shaken — including
  // them as `serverExternalPackages` was forcing the entire node_modules
  // tree into every Vercel function and blowing past the 250 MB limit.
  serverExternalPackages: [
    "@duckdb/node-api",
    "@duckdb/node-bindings",
  ],
  // The platform-specific DuckDB binding ships as an optional dependency
  // of @duckdb/node-bindings; pnpm installs the matching one for the build
  // environment (linux-x64 on Vercel, darwin-arm64 locally). Tell file
  // tracing to copy whichever one exists into the function bundle.
  outputFileTracingIncludes: {
    "/mcp/[slug]/route": [
      "./node_modules/@duckdb/node-bindings*/**/*",
    ],
    "/.well-known/workflow/v1/step/route": [
      "./node_modules/@duckdb/node-bindings*/**/*",
    ],
  },
};

export default withWorkflow(nextConfig);
