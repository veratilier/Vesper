import { authorizeApp } from '@/lib/bridge-auth';
import { memoryScopeFromRequest } from '@/lib/memory';
import { configuredMcpTools, callConfiguredMcpTool } from '@/lib/mcp-connections';
import { corsHeaders, optionsResponse } from '@/lib/cors';
export const OPTIONS = optionsResponse;
export async function GET(request: Request) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...Object.fromEntries(corsHeaders(request)), 'cache-control': 'no-store' } });
  if (!(await authorizeApp(request))) return respond({ error: 'Device not paired' }, 401);
  try {
    const scope = await memoryScopeFromRequest(request);
    const connections = await configuredMcpTools(scope);
    const candidates = connections.flatMap(connection => connection.tools.filter(tool => /(?:^|_)desire_status$/.test(tool.name)).map(tool => ({ connection, tool })));
    if (candidates.length !== 1) return respond({ error: candidates.length ? '发现多个 Desire 服务，请在本页「连接 MCP」中只启用要使用的那个。' : '请点本页「连接 MCP」，接入 Desire 后刷新状态。' }, 409);
    const { connection, tool } = candidates[0];
    const action = new URL(request.url).searchParams.get('view') || 'status';
    if (!['status', 'history'].includes(action)) return respond({ error: 'Unsupported view' }, 400);
    const selected = action === 'status' ? tool : connection.tools.find(item => /(?:^|_)desire_history$/.test(item.name));
    if (!selected) return respond({ error: '此 Desire 服务没有提供历史记录工具。' }, 409);
    // Delegate to the original service: no local scoring, decay, or encounter writes.
    const result = await callConfiguredMcpTool(scope, { connectionId: connection.connectionId, toolName: selected.name, arguments: {} });
    return respond({ data: result.result, source: connection.connectionName });
  } catch (reason) { return respond({ error: reason instanceof Error ? reason.message : '读取 Desire 失败' }, 502); }
}
