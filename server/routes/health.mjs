// server/routes/health.mjs —— /api/health、/api/config、/api/provider 的只读引导接口。
import { sendJson } from '../http.mjs';

export function handleHealth(ctx, res) {
  sendJson(res, 200, {
    ok: true,
    version: ctx.version,
    provider: ctx.providerName,
    mode: ctx.mode,
  });
}

export function handleConfig(ctx, res) {
  sendJson(res, 200, {
    auth: { cookieLogin: true, oauth: false },
    provider: ctx.providerName,
    offlineFallback: true,
  });
}

export function handleProvider(ctx, res) {
  const provider = ctx.provider;
  sendJson(res, 200, {
    name: provider.name,
    capabilities: provider.capabilities,
  });
}