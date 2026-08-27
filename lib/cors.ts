const allowedOrigins = new Set([
  'https://vesper.r-vera.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

export function corsHeaders(request: Request, extra?: Record<string, string>): Headers {
  const headers = new Headers({
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-vesper-device-token',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  });
  // Spreading a Headers instance yields {}, so extra headers must be set here
  // rather than merged into a plain object by the caller.
  for (const [name, value] of Object.entries(extra || {})) headers.set(name, value);
  const origin = request.headers.get('origin');
  if (
    origin &&
    (allowedOrigins.has(origin) || /^https:\/\/[a-z0-9-]+\.chatgpt\.site$/.test(origin))
  ) headers.set('access-control-allow-origin', origin);
  return headers;
}

export function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
