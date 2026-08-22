import { env } from 'cloudflare:workers';
import { corsHeaders, optionsResponse } from '@/lib/cors';

export const OPTIONS = optionsResponse;

function mediaBucket(): R2Bucket {
  return (env as unknown as { MEDIA: R2Bucket }).MEDIA;
}

export async function POST(request: Request) {
  const data = await request.formData();
  const file = data.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return Response.json({ error: 'Image required' }, { status: 400, headers: corsHeaders(request) });
  }
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: 'Image is too large' }, { status: 413, headers: corsHeaders(request) });
  }
  const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'image';
  const key = `${crypto.randomUUID()}.${extension}`;
  await mediaBucket().put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return Response.json({ key, url: `${new URL(request.url).origin}/api/media/${key}` }, { headers: corsHeaders(request) });
}
