// src/runtime.ts —— 自观测：统计未捕获异常（#app[data-runtime-errors] 的数据源）。
// 验收用：任何路由/任何探针下都必须是 0。

let runtimeErrorCount = 0;
const listeners = new Set<() => void>();
let installed = false;

function bump(): void {
  runtimeErrorCount += 1;
  for (const listener of listeners) listener();
}

export function installRuntimeErrorTracking(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', bump);
  window.addEventListener('unhandledrejection', bump);
}

export function subscribeRuntimeErrors(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRuntimeErrorCount(): number {
  return runtimeErrorCount;
}