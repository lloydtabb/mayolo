import { getUserBySlug } from "@/lib/getUserBySlug";
import { TOOL_DESCRIPTORS, callTool } from "@/lib/mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcReq = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

function ok(id: string | number | null | undefined, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function err(id: string | number | null | undefined, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "malloyyo", version: "0.1.0" };

export async function POST(
  req: Request,
  ctx: RouteContext<"/mcp/[slug]">,
) {
  const { slug } = await ctx.params;
  const user = await getUserBySlug(slug);
  if (!user) return Response.json({ error: "invalid slug" }, { status: 404 });

  let body: JsonRpcReq;
  try {
    body = (await req.json()) as JsonRpcReq;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (body.jsonrpc !== "2.0" || !body.method) {
    return err(body.id, -32600, "invalid JSON-RPC envelope");
  }

  switch (body.method) {
    case "initialize":
      return ok(body.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
      // notification, no response body expected; return 202 No Content
      return new Response(null, { status: 202 });

    case "tools/list":
      return ok(body.id, { tools: TOOL_DESCRIPTORS });

    case "tools/call": {
      const params = body.params ?? {};
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callTool(user, name, args);
        return ok(body.id, result);
      } catch (e) {
        return err(body.id, -32000, e instanceof Error ? e.message : String(e));
      }
    }

    case "ping":
      return ok(body.id, {});

    default:
      return err(body.id, -32601, `method not found: ${body.method}`);
  }
}

export async function GET() {
  return new Response(
    "POST JSON-RPC requests to this URL. See https://modelcontextprotocol.io",
    { status: 200 },
  );
}
