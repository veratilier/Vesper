import { authorizeApp } from "@/lib/bridge-auth";
import { memoryScopeFromRequest, recallMemory } from "@/lib/memory";
import { corsHeaders, optionsResponse } from "@/lib/cors";

function json(request: Request, value: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("cache-control", "no-store");
  return Response.json(value, { status, headers });
}

export const OPTIONS = optionsResponse;

export async function POST(request: Request) {
  if (!(await authorizeApp(request))) return json(request, { error: "Device not paired" }, 401);
  try {
    const body = await request.json() as { query?: string };
    const result = await recallMemory(await memoryScopeFromRequest(request), String(body.query || ""));
    return json(request, result);
  } catch (reason) {
    return json(request, { error: reason instanceof Error ? reason.message : "记忆召回暂时不可用" }, 500);
  }
}
