import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 纯静态站：hash 路由（不依赖服务端 rewrite），构建产物相对路径，离线可用。
export default defineConfig({
  base: './',
  plugins: [react()],
  // host '::' = 双栈监听：127.0.0.1（无头脚本按这个地址验收）与 localhost 都能直连。
  server: {
    host: '::',
    port: 5179,
    strictPort: true,
    // 开发期同源：页面在 5179，API 在 8787；生产由 server 同时服务 dist（无 CORS）。
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
  },
  preview: {
    host: '::',
    port: 4179,
    strictPort: true,
    // preview 也代理 /api，便于 `pnpm preview` + server 的联调/截图。
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
  },
  build: {
    target: 'es2022',
    assetsDir: 'assets',
    sourcemap: false,
    // 没有动态 import，关掉 modulepreload polyfill：产物里不应出现任何 fetch(（AC-G09）。
    modulePreload: false,
  },
});