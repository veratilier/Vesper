import { authorizeApp } from "@/lib/bridge-auth";
import { codexToolDefinitions, executeCodexTool } from "@/lib/codex-tools";
import { corsHeaders, optionsResponse } from "@/lib/cors";

function json(request: Request, value: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("cache-control", "no-store");
  return Response.json(value, { status, headers });
}

export const OPTIONS = optionsResponse;

export async function GET(request: Request) {
  if (!(await authorizeApp(request))) return json(request, { error: "Device not paired" }, 401);
  return json(request, { tools: codexToolDefinitions });
}

export async function POST(request: Request) {
  if (!(await authorizeApp(request))) return json(request, { error: "Device not paired" }, 401);
  try {
    const body = await request.json() as { name?: string; arguments?: Record<string, unknown>; threadId?: string; itemId?: string };
    const name = String(body.name || "");
    const definition = codexToolDefinitions.find((tool) => tool.name === name);
    if (!definition) return json(request, { error: "Unknown Codex tool" }, 404);
    const result = await executeCodexTool(name, body.arguments || {});
    return json(request, { ok: true, name, threadId: body.threadId || null, itemId: body.itemId || null, result });
  } catch (reason) {
    return json(request, { error: reason instanceof Error ? reason.message : "Codex tool failed" }, 400);
  }
}
