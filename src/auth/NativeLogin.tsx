import { useState } from 'react';

export interface NativeCookie {
  name: string;
  value: string;
}

/** App 内登录按钮；只在设备模式按需加载，失败时留在页面并提示手动粘贴。 */
export function NativeLogin({ onLogin }: { onLogin: (cookies: NativeCookie[]) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { nativeLoginCookies } = await import('../device/login-native');
      const cookies = await nativeLoginCookies();
      await onLogin(cookies);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : 'App 内登录不可用，已保留手动粘贴。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth__native">
      <button
        type="button"
        className="btn btn--primary auth__submit"
        data-testid="login-native"
        disabled={busy}
        onClick={() => void start()}
      >
        {busy ? '正在打开微博登录…' : 'App 内登录微博'}
      </button>
      {error ? <p className="auth__error" data-testid="login-native-error" role="alert">{error}</p> : null}
      <p className="auth__native-hint">登录完成后回到这里；失败或取消可直接用手动粘贴。</p>
    </div>
  );
}
