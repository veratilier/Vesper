import { env } from 'cloudflare:workers';
import { authorizeApp } from '@/lib/bridge-auth';
import { executeDesire, DesireUnavailable, type NativeDesireEnv } from '@/lib/desire/native';
import { corsHeaders, optionsResponse } from '@/lib/cors';
export const OPTIONS = optionsResponse;
export async function GET(request: Request) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...Object.fromEntries(corsHeaders(request)), 'cache-control': 'no-store' } });
  if (!(await authorizeApp(request))) return respond({ error: 'Device not paired' }, 401);
  const query = new URL(request.url).searchParams;
  const view = query.get('view') || 'status';
  if (!['status', 'history'].includes(view)) return respond({ error: 'Unsupported view' }, 400);
  try {
    const input = view === 'history' ? { ...(query.has('limit') ? { limit: Number(query.get('limit')) } : {}), ...(query.has('cursor') ? { cursor: query.get('cursor') } : {}) } : {};
    return respond({ data: await executeDesire(env as NativeDesireEnv, `desire_${view}`, input), source: 'Vesper' });
  } catch (reason) {
    if (reason instanceof DesireUnavailable) return respond({ error: reason.message }, 503);
    if (reason instanceof Error && reason.name === 'ZodError') return respond({ error: 'Invalid history parameters' }, 400);
    console.error('Native Desire read failed', reason);
    return respond({ error: '暂时无法读取 Desire，请稍后刷新。' }, 502);
  }
}
