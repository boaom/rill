import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 纯静态站：hash 路由（不依赖服务端 rewrite），构建产物相对路径，离线可用。
export default defineConfig({
  base: './',
  plugins: [react()],
  // host '::' = 双栈监听：127.0.0.1（无头脚本按这个地址验收）与 localhost 都能直连。
  server: { host: '::', port: 5179, strictPort: true },
  preview: { host: '::', port: 4179, strictPort: true },
  build: {
    target: 'es2022',
    assetsDir: 'assets',
    sourcemap: false,
    // 没有动态 import，关掉 modulepreload polyfill：产物里不应出现任何 fetch(（AC-G09）。
    modulePreload: false,
  },
});