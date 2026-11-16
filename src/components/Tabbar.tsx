import { IconHome, IconPlus, IconSettings, IconUser } from './icons';

export type ShellTab = 'timeline' | 'compose' | 'me' | 'settings';

/** 底部 4 项：时间线 / 发博 / 我的 / 设置。设置是 sheet，不产生路由。 */
export function Tabbar({
  active,
  onOpenSettings,
}: {
  active: ShellTab;
  onOpenSettings: () => void;
}) {
  return (
    <nav className="rill-tabbar" aria-label="主导航">
      <div className="rill-tabbar__inner">
        <a className="tab" href="#/timeline" aria-current={active === 'timeline' ? 'page' : undefined} data-testid="tab-timeline">
          <IconHome className="tab__icon" />
          <span className="tab__label">时间线</span>
        </a>
        <a className="tab" href="#/compose" aria-current={active === 'compose' ? 'page' : undefined} data-testid="tab-compose">
          <IconPlus className="tab__icon" />
          <span className="tab__label">发博</span>
        </a>
        <a className="tab" href="#/me" aria-current={active === 'me' ? 'page' : undefined} data-testid="tab-me">
          <IconUser className="tab__icon" />
          <span className="tab__label">我的</span>
        </a>
        <button
          type="button"
          className="tab"
          aria-current={active === 'settings' ? 'page' : undefined}
          data-testid="tab-settings"
          onClick={onOpenSettings}
        >
          <IconSettings className="tab__icon" />
          <span className="tab__label">设置</span>
        </button>
      </div>
    </nav>
  );
}