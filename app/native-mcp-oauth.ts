import { Capacitor } from '@capacitor/core';

type NativeBridge = {
  nativePromise?: (plugin: string, method: string, options: { url: string }) => Promise<{ url: string }>;
};

// Resolve the live bridge on each click. registerPlugin captures plugin headers
// at module evaluation, which need not reflect the currently injected bridge.
export async function authorizeWithBridge(bridge: NativeBridge, options: { url: string }): Promise<{ url: string }> {
  if (typeof bridge.nativePromise !== 'function') {
    throw new Error('The iOS bridge is unavailable. Reopen Vesper and try again.');
  }
  try {
    return await bridge.nativePromise('VesperOAuth', 'authorize', options);
  } catch (error) {
    const reason = error as { code?: string; message?: string };
    if (reason?.code === 'UNIMPLEMENTED' || /not implemented|not found/i.test(reason?.message || '')) {
      throw new Error('The iOS bridge responded, but VesperOAuth is not registered in this App build. Check the Xcode target and native plugin registration.');
    }
    throw error;
  }
}

export const nativeMcpOAuth = {
  authorize: (options: { url: string }) => authorizeWithBridge(
    (typeof window !== 'undefined' ? (window as Window & { Capacitor?: NativeBridge }).Capacitor : undefined)
      || Capacitor as unknown as NativeBridge,
    options,
  ),
};
