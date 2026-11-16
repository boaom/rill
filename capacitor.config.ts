import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 壳配置：Web 仍然是构建产物 dist，Android 只负责承载 WebView。
 * CapacitorHttp 预留给 t34 起的设备直连；web 离线不依赖它。
 */
const config: CapacitorConfig = {
  appId: 'one.rill.app',
  appName: '溪流',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
