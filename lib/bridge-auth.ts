import { env } from 'cloudflare:workers';

type SecretEnv = {
  VESPER_APP_TOKEN?: string;
  VESPER_BRIDGE_TOKEN?: string;
};

async function sameSecret(actual: string, expected: string): Promise<boolean> {
  if (!actual || !expected) return false;
  const encoder = new TextEncoder();
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(actualDigest);
  const right = new Uint8Array(expectedDigest);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

function secrets(): SecretEnv {
  return env as unknown as SecretEnv;
}

export async function authorizeApp(request: Request): Promise<boolean> {
  return sameSecret(request.headers.get('x-vesper-device-token') || '', secrets().VESPER_APP_TOKEN || '');
}

export async function authorizeBridge(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  return sameSecret(token, secrets().VESPER_BRIDGE_TOKEN || '');
}
