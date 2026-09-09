import { registerPlugin } from '@capacitor/core';
export const nativeMcpOAuth = registerPlugin<{
  authorize(options: { url: string }): Promise<{ url: string }>;
}>('VesperOAuth');
