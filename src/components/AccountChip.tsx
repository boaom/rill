import type { SessionInfo } from '../data/api';

/** 顶栏账号入口：离线显示登录，在线显示 screenName + 退出。 */
export function AccountChip({
  online,
  session,
  onLogin,
  onLogout,
}: {
  online: boolean;
  session: SessionInfo | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const name = session?.user?.screenName || (session?.authenticated ? '已登录' : '未登录');
  return (
    <div className="account-chip" data-testid="account-entry">
      <span className="account-chip__dot" aria-hidden="true" data-online={online ? 'true' : 'false'} />
      <span className="account-chip__name" data-testid="account-name" title={name}>
        {online ? name : '登录'}
      </span>
      {online ? (
        <button type="button" className="btn btn--text account-chip__action" data-testid="account-logout" onClick={onLogout}>
          退出
        </button>
      ) : (
        <button type="button" className="btn btn--text account-chip__action" data-testid="account-login" onClick={onLogin}>
          登录
        </button>
      )}
    </div>
  );
}
