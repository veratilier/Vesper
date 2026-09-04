import { corsHeaders, optionsResponse } from "@/lib/cors";
import { assetObject } from "@/lib/stickers";
export const OPTIONS = optionsResponse;
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-z0-9-]{16,64}$/i.test(id)) return new Response("Not found", { status: 404 });
  const result = await assetObject(id); if (!result) return new Response("Not found", { status: 404 });
  const headers = corsHeaders(request); result.object.writeHttpMetadata(headers); headers.set("content-type", result.mimeType); headers.set("etag", result.object.httpEtag); headers.set("cache-control", "private, max-age=86400");
  return new Response(result.object.body, { headers });
}
