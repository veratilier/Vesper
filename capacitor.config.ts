import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rvera.vesper',
  appName: 'Vesper',
  webDir: 'native-shell',
  server: {
    url: 'https://vesper.r-vera.com',
    cleartext: false,
    allowNavigation: ['vesper.r-vera.com'],
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#eaf0f5',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
  },
};

export default config;
