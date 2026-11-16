import { useEffect, useMemo, useRef, useState } from 'react';
import type { Reply } from '../types';
import { useStore, displayLikes, displayReposts, findPost, likedByMe, repliesOf, replyCountOf } from '../store';
import { getAuthor } from '../data/mock';
import { ActionBar } from '../components/ActionBar';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { MediaBlock } from '../components/MediaGrid';
import { TopicText } from '../components/TopicText';
import { VerifiedMark } from '../components/VerifiedMark';
import { displaySource } from '../lib/source';
import { formatRelative, isoTime } from '../lib/time';

const MAX_REPLY = 140;

/** 屏 2 · 详情（spec §7）：正文 + 图 + 回复列表 + 楼中楼。 */
export function DetailPage({
  postId,
  error,
  onRetry,
  onLike,
  onRepost,
  onSendReply,
  onOpen,
  onBack,
  onTimeline,
  focusReply,
}: {
  postId: string;
  error: boolean;
  onRetry: () => void;
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
  onSendReply: (postId: string, text: string, replyToReplyId: string | null) => void;
  onOpen: (postId: string) => void;
  onBack: () => void;
  onTimeline: () => void;
  focusReply: boolean;
}) {
  const { state } = useStore();
  const post = findPost(state, postId);
  const replies = useMemo(() => repliesOf(state, postId), [state, postId]);
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Reply | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusReply) inputRef.current?.focus();
  }, [focusReply]);

  const groups = useMemo(() => {
    const childrenOf = new Map<string, Reply[]>();
    const roots: Reply[] = [];
    for (const reply of replies) {
      if (reply.replyToReplyId) {
        const list = childrenOf.get(reply.replyToReplyId) ?? [];
        list.push(reply);
        childrenOf.set(reply.replyToReplyId, list);
      } else {
        roots.push(reply);
      }
    }
    return { roots, childrenOf };
  }, [replies]);

  const pickReplyTarget = (reply: Reply) => {
    setTarget(reply);
    inputRef.current?.focus();
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendReply(postId, trimmed.slice(0, MAX_REPLY), target ? target.id : null);
    setText('');
    setTarget(null);
  };

  const renderReply = (reply: Reply, parentId: string | null, index: number) => {
    const author = getAuthor(reply.authorId);
    const parent = parentId ? state.replies.find((item) => item.id === parentId) : undefined;
    const kids = groups.childrenOf.get(reply.id) ?? [];
    const open = Boolean(expanded[reply.id]);
    return (
      <div
        className={parentId ? 'reply-row reply-row--child' : 'reply-row'}
        data-testid="reply-item"
        data-reply-id={reply.id}
        data-parent-id={parentId ?? undefined}
        key={reply.id}
      >
        <div className="reply-row__head">
          <span className="reply__n" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <Avatar author={author} size="sm" />
          <div className="reply-row__meta">
            <span className="reply-row__name">{author.nickname}</span>
            {parent ? <span className="reply-row__at">回复 @{getAuthor(parent.authorId).handle}：</span> : null}
            <time className="reply-row__time" dateTime={isoTime(reply.createdAt)}>
              {formatRelative(reply.createdAt)}
            </time>
          </div>
          <button type="button" className="reply-row__to" data-testid="reply-to-btn" onClick={() => pickReplyTarget(reply)}>
            回复
          </button>
        </div>
        <p className="reply-row__text">
          <TopicText text={reply.text} />
        </p>
        {kids.length > 0 ? (
          <>
            <button
              type="button"
              className="btn btn--text reply-toggle"
              data-testid="reply-toggle"
              aria-expanded={open}
              onClick={() => setExpanded((prev) => ({ ...prev, [reply.id]: !prev[reply.id] }))}
            >
              {open ? '收起' : `展开 ${kids.length} 条回复`}
            </button>
            <div className="reply-row__children" data-testid="reply-children" data-count={kids.length} hidden={!open}>
              {kids.map((kid, kidIndex) => renderReply(kid, reply.id, kidIndex))}
            </div>
          </>
        ) : null}
      </div>
    );
  };

  if (error) {
    return (
      <section data-testid="detail-root">
        <header className="rill-header">
          <div className="rill-header__inner">
            <button type="button" className="btn btn--text" data-testid="back-btn" aria-label="返回" onClick={onBack}>
              返回
            </button>
            <h1 className="rill-header__title">详情</h1>
            <span className="rill-header__spacer" />
          </div>
        </header>
        <EmptyState kind="error" title="内容没有加载出来" text="检查一下再试" actionLabel="重试" onAction={onRetry} testid="error-state" />
      </section>
    );
  }

  if (!post) {
    return (
      <section data-testid="detail-root">
        <header className="rill-header">
          <div className="rill-header__inner">
            <button type="button" className="btn btn--text" data-testid="back-btn" aria-label="返回" onClick={onBack}>
              返回
            </button>
            <h1 className="rill-header__title">详情</h1>
            <span className="rill-header__spacer" />
          </div>
        </header>
        <EmptyState title="这条内容找不到了" text="它可能已经被删除" actionLabel="回时间线" onAction={onTimeline} testid="detail-not-found" />
      </section>
    );
  }

  const author = getAuthor(post.authorId);
  const source = displaySource(post.source);
  const quoted = post.repostOfId ? findPost(state, post.repostOfId) : undefined;
  const replyCount = replyCountOf(state, post.id);

  return (
    <section data-testid="detail-root" data-status-id={post.id}>
      <header className="rill-header">
        <div className="rill-header__inner">
          <button type="button" className="btn btn--text" data-testid="back-btn" aria-label="返回" onClick={onBack}>
            返回
          </button>
          <h1 className="rill-header__title">详情</h1>
          <span className="rill-header__spacer" />
        </div>
      </header>

      <article className="detail" data-testid="detail-author">
        <div className="rill-col">
          <div className="card__head detail__head">
            <Avatar author={author} testid="profile-avatar" size="lg" />
            <h2 className="card__name detail__name">{author.nickname}</h2>
            <VerifiedMark verified={author.verified} />
            <span className="card__handle">@{author.handle}</span>
            <time className="card__time" dateTime={isoTime(post.createdAt)}>{formatRelative(post.createdAt)}</time>
            {source ? (
              <span className="card__src" data-source={source}>{source}</span>
            ) : null}
          </div>

          <p className="body detail__text" data-testid="detail-text">
            <TopicText text={post.text} />
          </p>

          {post.media.length > 0 ? <MediaBlock media={post.media} className="detail__media" testid="detail-media" /> : null}

          {quoted ? (
            <button
              type="button"
              className="quote detail__quote"
              data-testid="repost-card"
              onClick={() => onOpen(quoted.id)}
            >
              <span className="quote__rail" aria-hidden="true" />
              <span className="quote__inner">
                <span className="quote__meta">
                  <span className="quote__name">{getAuthor(quoted.authorId).nickname}</span>
                  <span className="quote__handle">@{getAuthor(quoted.authorId).handle}</span>
                </span>
                <span className="quote__text"><TopicText text={quoted.text} /></span>
                {quoted.media.length > 0 ? <MediaBlock media={quoted.media.slice(-1)} className="quote__img detail__quote__img" /> : null}
              </span>
            </button>
          ) : null}

          <ActionBar
            detail
            repostCount={displayReposts(state, post)}
            replyCount={replyCount}
            likeCount={displayLikes(state, post)}
            liked={likedByMe(state, post.id)}
            onLike={() => onLike(post.id)}
            onRepost={() => onRepost(post.id)}
            onReply={() => inputRef.current?.focus()}
          />
        </div>
      </article>

      <div className="replying">
        <div className="rill-col">
          {target ? <div className="replying__prefix">回复 @{getAuthor(target.authorId).handle}：</div> : null}
          <div className="replying__box">
            <textarea
              ref={inputRef}
              className="replying__input"
              data-testid="reply-input"
              placeholder="说点什么…"
              maxLength={MAX_REPLY}
              rows={1}
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_REPLY))}
            />
            <button type="button" className="btn btn--primary" data-testid="reply-send" disabled={text.trim().length === 0} onClick={submit}>
              发送
            </button>
          </div>
          <div className="replying__foot">
            <span className="replying__count" data-testid="reply-input-count">
              {text.length}/{MAX_REPLY}
            </span>
            <span className="replying__count muted">内容只存在本机</span>
          </div>
        </div>
      </div>

      <div className="replies">
        {groups.roots.length === 0 ? (
          <EmptyState title="还没有回复，来说第一句" testid="reply-empty" />
        ) : (
          groups.roots.map((reply, index) => renderReply(reply, null, index))
        )}
      </div>
    </section>
  );
}