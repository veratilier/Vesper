export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const destination = new URL("/", incoming.origin);
  destination.searchParams.set("mcp-oauth", "1");

  for (const key of ["code", "state", "error", "error_description", "error_uri"]) {
    const value = incoming.searchParams.get(key);
    if (value) destination.searchParams.set(key, value);
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: destination.toString(),
      "cache-control": "no-store",
    },
  });
}
