import { useEffect, useRef } from 'react';
import type { MediaRef } from '../types';
import { canPublish, countTopicsInText } from '../store';
import { IconPlus } from '../components/icons';
import { Ph } from '../components/MediaGrid';

const MAX_TEXT = 500;
const MAX_TOPICS = 3;

/** 屏 3 · 发博（spec §8）。 */
export function ComposePage({
  text,
  media,
  onText,
  onAddMedia,
  onRemoveMedia,
  onNotice,
  onPublish,
  onCancel,
  error,
  draftSaved,
}: {
  text: string;
  media: MediaRef[];
  onText: (text: string) => void;
  onAddMedia: () => void;
  onRemoveMedia: (mediaId: string) => void;
  onNotice: (kind: 'media' | 'topic') => void;
  onPublish: () => void;
  onCancel: () => void;
  error: boolean;
  draftSaved: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const insertTopic = () => {
    if (countTopicsInText(text) >= MAX_TOPICS) {
      onNotice('topic');
      return;
    }
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const token = '#新话题#';
    const next = `${text.slice(0, start)}${token}${text.slice(end)}`.slice(0, MAX_TEXT);
    onText(next);
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      input.setSelectionRange(start + 1, start + 4);
    });
  };

  const addMedia = () => {
    if (media.length >= 9) {
      onNotice('media');
      return;
    }
    onAddMedia();
  };

  const warn = text.length >= 450;
  const enabled = canPublish(text, media);

  return (
    <section data-testid="compose-root" className="compose">
      <header className="rill-header">
        <div className="rill-header__inner">
          <button type="button" className="btn btn--text" data-testid="compose-cancel" aria-label="取消" onClick={onCancel}>
            取消
          </button>
          <h1 className="rill-header__title">发博</h1>
          <span className="rill-header__spacer" />
        </div>
      </header>

      <div className="compose__body">
        {error ? (
          <div className="alert" data-testid="publish-error" role="alert">
            发布失败，内容已存为草稿
          </div>
        ) : null}

        <textarea
          ref={inputRef}
          className="compose__input"
          data-testid="compose-input"
          placeholder="此刻想说什么…"
          maxLength={MAX_TEXT}
          value={text}
          onChange={(event) => onText(event.target.value.slice(0, MAX_TEXT))}
        />

        <div className="compose__meta">
          {draftSaved && text.trim().length > 0 ? (
            <span className="draft-hint" data-testid="draft-hint">
              已保存草稿
            </span>
          ) : (
            <span />
          )}
          <span className={`compose__count${warn ? ' is-warn' : ''}`} data-testid="compose-count">
            {text.length}/{MAX_TEXT}
          </span>
        </div>

        {media.length > 0 ? (
          <div className="compose__media" data-testid="media-grid" data-media-count={media.length}>
            {media.map((item) => (
              <div className="media-item" key={item.id}>
                <Ph media={item} />
                <button
                  type="button"
                  className="media-item__remove"
                  data-testid="remove-media"
                  data-media-id={item.id}
                  aria-label="删除这张图"
                  onClick={() => onRemoveMedia(item.id)}
                >
                  <IconPlus />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="compose__bar">
        <button type="button" className="compose__tool" data-testid="add-media" aria-label="添加图片" onClick={addMedia}>
          <IconPlus />
        </button>
        <button type="button" className="compose__tool compose__tool--topic" data-testid="add-topic" aria-label="添加话题" onClick={insertTopic}>
          #
        </button>
        <button type="button" className="btn btn--primary" data-testid="publish-btn" disabled={!enabled} onClick={onPublish}>
          发布
        </button>
      </div>
    </section>
  );
}