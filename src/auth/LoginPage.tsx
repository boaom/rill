import { useEffect, useMemo, useState } from 'react';
import { loginWithCookies, parseCookieInput, ApiError, type SessionInfo } from '../data/api';

/** #/login：只支持浏览器复制 cookie，不提供账密/短信登录（微博新设备会二次验证）。 */
export function LoginPage({
  online,
  device = false,
  deviceGuide,
  onDone,
  onBack,
}: {
  online: boolean;
  device?: boolean;
  deviceGuide?: string;
  onDone: (session: SessionInfo) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<SessionInfo | null>(null);
  const parsed = useMemo(() => parseCookieInput(text), [text]);

  // 只有真认证才自动回时间线；失败态必须留在本页让用户选择重试/离线。
  useEffect(() => {
    if (!done?.authenticated) return;
    const timer = window.setTimeout(onBack, 2200);
    return () => window.clearTimeout(timer);
  }, [done, onBack]);

  const submit = async () => {
    if (parsed.cookies.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await loginWithCookies(parsed.cookies);
      setDone(next);
      // 未通过微博校验时不把 hasSession 当成已认证写回 App；留在失败态，
      // 由用户选择重新粘贴或明确以离线模式继续。
      if (next.authenticated) onDone(next);
    } catch (reason) {
      if (reason instanceof ApiError) {
        if (reason.code === 'RATE_LIMITED') setError('尝试太频繁，请等一分钟再试。');
        else if (reason.code === 'BAD_INPUT') setError('Cookie 格式不被服务接受，请检查粘贴内容。');
        else if (reason.code === 'AUTH_EXPIRED' || reason.code === 'AUTH_REQUIRED') setError('会话未能建立，请重新粘贴完整 Cookie。');
        else setError(`连接失败：${reason.message}`);
      } else {
        setError('连接失败：请检查网络、Cookie 或本地 server。');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="login-root" data-online={online ? 'true' : 'false'}>
      <header className="rill-header">
        <div className="rill-header__inner">
          <button type="button" className="btn btn--text" data-testid="login-back" onClick={onBack}>
            返回
          </button>
          <h1 className="rill-header__title">登录</h1>
          <span className="rill-header__spacer" />
          <span className="header__hint">{online ? '在线' : '本机'}</span>
        </div>
      </header>

      <div className="auth">
        <p className="auth__eyebrow">COOKIE LOGIN</p>
        <h2 className="auth__title">连接你的微博</h2>
        <p className="auth__lead">
          {device
            ? deviceGuide
            : <>在浏览器打开 <b>m.weibo.cn</b> 并登录，复制请求头里的 Cookie，粘贴到下面。</>}
        </p>
        <div className="auth__note" data-testid="login-privacy-note">
          Cookie 只保存在这台设备，不写日志、不上报；等同账号凭证，别外传。
        </div>

        <label className="auth__label" htmlFor="cookie-input">
          Cookie
        </label>
        <textarea
          id="cookie-input"
          className="auth__input"
          data-testid="login-input"
          value={text}
          rows={6}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={'SUB=...; SUBP=...\n或每行一个 name=value'}
          onChange={(event) => {
            setText(event.target.value);
            setError('');
          }}
        />
        <div className="auth__meta">
          <span>
            识别到 {parsed.cookies.length} 条
            {parsed.skipped > 0 ? `，跳过 ${parsed.skipped} 条` : ''}
          </span>
          <span className="auth__meta-names">
            {parsed.cookies.map((cookie) => cookie.name).join(' · ') || '等待粘贴'}
          </span>
        </div>
        {error ? <p className="auth__error" data-testid="login-error" role="alert">{error}</p> : null}

        {done?.authenticated ? (
          <div className="auth__success" data-testid="login-success">
            <p className="auth__success-title">已保存在这台设备，已验证</p>
            <button type="button" className="btn btn--primary auth__submit" data-testid="login-enter" onClick={onBack}>
              进入时间线
            </button>
          </div>
        ) : done ? (
          <div className="auth__success" data-testid="login-failure" data-auth-failed="true">
            <p className="auth__success-title">Cookie 已保存，但微博校验未通过</p>
            <p className="auth__success-text">
              可能已过期或格式不全。重新粘贴完整 Cookie 后再试，或先以离线模式浏览本地数据。
            </p>
            <button
              type="button"
              className="btn btn--primary auth__submit"
              data-testid="login-retry"
              onClick={() => {
                setDone(null);
                setError('');
                window.setTimeout(() => document.getElementById('cookie-input')?.focus(), 0);
              }}
            >
              重新粘贴
            </button>
            <button
              type="button"
              className="btn btn--text auth__submit"
              data-testid="login-offline"
              onClick={() => {
                // 显式把 hasSession 归零，避免 App 仅凭服务端会话行继续停在在线态。
                onDone({ ...done, authenticated: false, hasSession: false, mode: 'offline' });
                onBack();
              }}
            >
              仍以离线模式继续
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--primary auth__submit"
            data-testid="login-submit"
            disabled={parsed.cookies.length === 0 || busy}
            onClick={submit}
          >
            {busy ? '正在连接…' : '保存 Cookie 并连接'}
          </button>
        )}
        <p className="auth__foot">
          不支持账密登录；写端点可能变化，失败不重试
        </p>
      </div>
    </section>
  );
}
