import { authorizeApp } from "@/lib/bridge-auth";
import { memoryScopeFromRequest, scheduleDistillation } from "@/lib/memory";
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
    const body = await request.json() as { conversationId?: string };
    if (!body.conversationId?.trim()) return json(request, { error: "缺少对话标识" }, 400);
    return json(request, await scheduleDistillation(await memoryScopeFromRequest(request), body.conversationId.trim()), 202);
  } catch (reason) {
    return json(request, { error: reason instanceof Error ? reason.message : "记忆蒸馏任务暂时不可用" }, 500);
  }
}
