import { env } from "cloudflare:workers";
import { corsHeaders, optionsResponse } from "@/lib/cors";
import { authorizeApp } from "@/lib/bridge-auth";

export const OPTIONS = optionsResponse;

function mediaBucket(): R2Bucket {
  return (env as unknown as { MEDIA: R2Bucket }).MEDIA;
}

export async function POST(request: Request) {
  if (!(await authorizeApp(request)))
    return Response.json(
      { error: "Device not paired" },
      { status: 401, headers: corsHeaders(request) },
    );
  const data = await request.formData();
  const file = data.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "File required" },
      { status: 400, headers: corsHeaders(request) },
    );
  }
  if (file.size > 32 * 1024 * 1024) {
    return Response.json(
      { error: "Image is too large" },
      { status: 413, headers: corsHeaders(request) },
    );
  }
  const extension =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "")
      .toLowerCase() || "image";
  const key = `${crypto.randomUUID()}.${extension}`;
  await mediaBucket().put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  return Response.json(
    {
      key,
      url: `${new URL(request.url).origin}/api/media/${key}`,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    },
    { headers: corsHeaders(request) },
  );
}
