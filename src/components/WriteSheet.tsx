import { useEffect, useRef } from 'react';
import { IconPlus } from './icons';

/** 转发/评论共用的小弹层：复用发博的输入语义，失败保留草稿。 */
export function WriteSheet({
  open,
  title,
  placeholder,
  value,
  onChange,
  busy,
  error,
  max = 140,
  submitLabel = '发送',
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  error: string;
  max?: number;
  submitLabel?: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  return (
    <>
      {open ? (
        <button type="button" className="sheet__scrim" aria-label="关闭写操作" data-testid="write-scrim" onClick={() => { if (!busy) onClose(); }} />
      ) : null}
      <dialog className="sheet write-sheet" open={open || undefined} data-testid="write-sheet" aria-label={title} aria-modal="true" aria-hidden={open ? undefined : true}>
        <div className="sheet__handle" aria-hidden="true" />
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="btn--icon is-close" data-testid="write-close" aria-label="关闭" onClick={onClose} disabled={busy}>
            <IconPlus />
          </button>
        </div>
        <div className="write-sheet__body">
          <textarea
            ref={inputRef}
            className="write-sheet__input"
            data-testid="write-input"
            value={value}
            maxLength={max}
            rows={4}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value.slice(0, max))}
          />
          <div className="write-sheet__meta">
            <span>{value.length}/{max}</span>
            {busy ? <span className="write-sheet__busy">正在提交…</span> : null}
          </div>
          {error ? <p className="write-sheet__error" data-testid="write-error" role="alert">{error}</p> : null}
          <div className="write-sheet__actions">
            <button type="button" className="btn btn--ghost" data-testid="write-cancel" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button type="button" className="btn btn--primary" data-testid="write-submit" disabled={!value.trim() || busy} onClick={onSubmit}>
              {busy ? '提交中…' : submitLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
