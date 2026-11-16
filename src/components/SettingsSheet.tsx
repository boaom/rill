import { useEffect, useRef, useState } from 'react';
import { IconPlus } from './icons';
import type { ThemeMode } from '../types';

/** 设置 sheet：原生 <dialog open>（不用 showModal，避免 UA 默认黑遮罩）+ 自绘 scrim。 */
export function SettingsSheet({
  open,
  theme,
  onToggleTheme,
  onReset,
  onClose,
}: {
  open: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      return;
    }
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open ? (
        <button type="button" className="sheet__scrim" aria-label="关闭设置" data-testid="settings-scrim" onClick={onClose} />
      ) : null}
      {/* 始终在 DOM 里：关闭时不带 open 属性；打开时 open（AC-PF05 断言 [open]） */}
      <dialog
        className="sheet"
        open={open || undefined}
        data-testid="dialog-settings"
        aria-label="设置"
        aria-modal="true"
        aria-hidden={open ? undefined : true}
      >
        <div className="sheet__handle" aria-hidden="true" />
        <div className="sheet__head">
          <h2 className="sheet__title">设置</h2>
          <button ref={closeRef} type="button" className="btn--icon is-close" data-testid="settings-close" aria-label="关闭" onClick={onClose}>
            <IconPlus />
          </button>
        </div>
        <div className="sheet__body">
          <div className="sheet__row">
            <span className="sheet__label">
              深色模式
              <span className="sheet__note">只改本机显示，不同步到任何地方</span>
            </span>
            <button
              type="button"
              role="switch"
              className="switch"
              data-testid="theme-toggle"
              aria-checked={theme === 'dark'}
              aria-label="深色模式"
              onClick={onToggleTheme}
            />
          </div>

          <div className="sheet__row">
            {confirming ? (
              <div data-testid="reset-confirm" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, width: '100%', paddingBlock: 8 }}>
                <span className="sheet__label">确认清空本机数据？</span>
                <div className="sheet__confirm" style={{ marginLeft: 'auto' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>
                    取消
                  </button>
                  <button type="button" className="btn btn--primary" data-testid="reset-confirm-btn" onClick={onReset}>
                    确认清空
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="sheet__label">
                  清空本地数据
                  <span className="sheet__note">点赞、转发、发布与草稿都恢复初始</span>
                </span>
                <button type="button" className="sheet__danger" data-testid="reset-btn" onClick={() => setConfirming(true)}>
                  清空
                </button>
              </>
            )}
          </div>

          <p className="about-block" data-testid="about-block">
            溪流 v0.1.0 · 全部内容是本机假数据，不联网、不登录、不上传。
          </p>
        </div>
      </dialog>
    </>
  );
}