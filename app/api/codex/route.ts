import { env } from 'cloudflare:workers';
import { authorizeApp } from '@/lib/bridge-auth';
import { corsHeaders, optionsResponse } from '@/lib/cors';

type CodexEnv = {
  CODEX_APP_SERVER_URL?: string;
  CODEX_APP_SERVER_TOKEN?: string;
};

const runtimeEnv = () => env as unknown as CodexEnv;

function authorisedWebSocket(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return authorizeApp(request);
  const headers = new Headers(request.headers);
  headers.set('x-vesper-device-token', token);
  return authorizeApp(new Request(request, { headers }));
}

function json(request: Request, value: unknown, status = 200) {
  return Response.json(value, { status, headers: corsHeaders(request) });
}

export const OPTIONS = optionsResponse;

/**
 * The browser speaks the official Codex app-server JSON-RPC protocol directly.
 * This endpoint is intentionally only a same-origin, authenticated WebSocket
 * proxy; it does not translate the protocol into an API-key or MCP connection.
 */
export async function GET(request: Request) {
  if (!(await authorisedWebSocket(request))) return json(request, { error: 'Device not paired' }, 401);
  const target = runtimeEnv().CODEX_APP_SERVER_URL?.trim();
  if (!target) return json(request, { error: 'Codex app-server is not configured' }, 503);
  const upgrade = request.headers.get('Upgrade')?.toLowerCase();
  if (upgrade !== 'websocket') return json(request, { ok: true, service: 'codex-app-server-proxy', configured: true });

  const upstream = new URL(target);
  if (upstream.protocol === 'http:') upstream.protocol = 'ws:';
  if (upstream.protocol === 'https:') upstream.protocol = 'wss:';
  const headers = new Headers(request.headers);
  headers.delete('origin');
  const upstreamToken = runtimeEnv().CODEX_APP_SERVER_TOKEN?.trim();
  if (upstreamToken) headers.set('authorization', `Bearer ${upstreamToken}`);
  return fetch(new Request(upstream, { method: 'GET', headers }));
}

