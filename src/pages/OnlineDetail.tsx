import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { TopicText } from '../components/TopicText';
import { WriteSheet } from '../components/WriteSheet';
import { getAuthor } from '../data/mock';
import { ApiError, RISK_CONTROL_COPY, commentStatus, getComments, getStatus, repostStatus, setLike, writeErrorMessage, type Page, type StatusPayload } from '../data/api';
import type { Author, Reply } from '../types';
import { formatRelative, isoTime } from '../lib/time';

function authLike(error: ApiError): boolean {
  return error.code === 'AUTH_EXPIRED' || error.code === 'AUTH_REQUIRED';
}

export function OnlineDetailPage({
  postId,
  onLogin,
  onBack,
  onTimeline,
  onToast,
}: {
  postId: string;
  onLogin: () => void;
  onBack: () => void;
  onTimeline: () => void;
  onToast: (text: string) => void;
}) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [comments, setComments] = useState<Page<Reply> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [commentError, setCommentError] = useState<ApiError | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyWriteError, setReplyWriteError] = useState('');
  const [repostOpen, setRepostOpen] = useState(false);
  const [repostText, setRepostText] = useState('');
  const [repostBusy, setRepostBusy] = useState(false);
  const [repostError, setRepostError] = useState('');
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setCommentError(null);
    setStatus(null);
    setLikeCount(null);
    setReplyText('');
    setComments(null);
    (async () => {
      try {
        const next = await getStatus(postId, 'online');
        if (!alive) return;
        setStatus(next);
        try {
          const page = await getComments(postId, null, 'online');
          if (alive) setComments(page);
        } catch (reason) {
          if (alive) setCommentError(reason instanceof ApiError ? reason : new ApiError('UPSTREAM', '评论加载失败', 0));
        }
      } catch (reason) {
        if (alive) setError(reason instanceof ApiError ? reason : new ApiError('UPSTREAM', '详情加载失败', 0));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [postId]);

  const users = useMemo(() => {
    const map = new Map<string, Author>();
    for (const user of status?.users ?? []) map.set(user.id, user);
    for (const user of comments?.users ?? []) {
      if (!map.has(user.id)) map.set(user.id, user);
    }
    return map;
  }, [status, comments]);

  const lookup = (id: string) => users.get(id) || getAuthor(id);
  const roots = (comments?.items ?? []).filter((reply) => !reply.replyToReplyId);
  const childrenOf = (parentId: string) => (comments?.items ?? []).filter((reply) => reply.replyToReplyId === parentId);
  const commentPage = comments;

  const renderReply = (reply: Reply, parentId: string | null) => {
    const author = lookup(reply.authorId);
    return (
      <div
        className={parentId ? 'reply-row reply-row--child' : 'reply-row'}
        data-testid="reply-item"
        data-reply-id={reply.id}
        data-parent-id={parentId ?? undefined}
        key={reply.id}
      >
        <div className="reply-row__head">
          <Avatar author={author} size="sm" />
          <div className="reply-row__meta">
            <span className="reply-row__name">{author.nickname}</span>
            <time className="reply-row__time" dateTime={isoTime(reply.createdAt)}>
              {formatRelative(reply.createdAt)}
            </time>
          </div>
        </div>
        <p className="reply-row__text">
          <TopicText text={reply.text} />
        </p>
        {childrenOf(reply.id).map((child) => renderReply(child, reply.id))}
      </div>
    );
  };

  const toggleLike = async () => {
    if (likeBusy) return;
    const nextOn = !liked;
    setLiked(nextOn);
    setLikeBusy(true);
    try {
      const result = await setLike(postId, nextOn);
      if (Number.isFinite(result.count) && result.count > 0) setLikeCount(result.count);
      onToast(nextOn ? '已赞' : '已取消赞');
    } catch (reason) {
      setLiked(!nextOn);
      onToast(writeErrorMessage(reason));
    } finally {
      setLikeBusy(false);
    }
  };

  const submitReply = async () => {
    const text = replyText.trim();
    if (!text || replyBusy) return;
    setReplyBusy(true);
    setReplyWriteError('');
    try {
      const result = await commentStatus(postId, text);
      setComments((prev) => prev
        ? { ...prev, items: [...prev.items, result.reply], hasMore: prev.hasMore }
        : { items: [result.reply], next: null, hasMore: false, users: [] });
      setReplyText('');
      onToast('已回复');
    } catch (reason) {
      setReplyWriteError(writeErrorMessage(reason));
    } finally {
      setReplyBusy(false);
    }
  };

  const submitRepost = async () => {
    if (!repostText.trim() || repostBusy) return;
    setRepostBusy(true);
    setRepostError('');
    try {
      const result = await repostStatus(postId, repostText.trim());
      setRepostOpen(false);
      setRepostText('');
      onToast(result.notice || (result.pending ? '已转发（待同步）' : '已转发'));
    } catch (reason) {
      setRepostError(writeErrorMessage(reason));
    } finally {
      setRepostBusy(false);
    }
  };

  return (
    <section data-testid="detail-root" data-status-id={postId} data-reply-count={commentPage?.items.length ?? 0} data-online="true">
      <header className="rill-header">
        <div className="rill-header__inner">
          <button type="button" className="btn btn--text" data-testid="detail-back" onClick={onBack}>
            返回
          </button>
          <h1 className="rill-header__title">详情</h1>
          <span className="rill-header__spacer" />
          <button type="button" className="btn btn--text" onClick={onTimeline} data-testid="detail-timeline">
            时间线
          </button>
        </div>
      </header>

      {loading ? (
        <div className="state" data-testid="detail-loading">
          <p className="state__title">正在加载详情…</p>
        </div>
      ) : error ? (
        <EmptyState
          kind="error"
          title={authLike(error) ? '需要重新登录' : error.code === 'RISK_CONTROL' ? RISK_CONTROL_COPY.title : '内容没有加载出来'}
          text={authLike(error) ? 'Cookie 可能已过期；重新登录后继续。' : error.code === 'RISK_CONTROL' ? RISK_CONTROL_COPY.text : '检查 server 与网络后再试。'}
          actionLabel={authLike(error) ? '去登录' : '重试'}
          onAction={() => {
            if (authLike(error)) onLogin();
            else window.location.reload();
          }}
          testid={authLike(error) ? 'auth-error' : error.code === 'RISK_CONTROL' ? 'risk-error' : 'error-state'}
        />
      ) : status ? (
        <>
          <div className="detail__post">
            <PostCard
              post={status.post}
              author={lookup(status.post.authorId)}
              liked={liked}
              replyCount={commentPage?.items.length ?? 0}
              likeCount={likeCount ?? (status.post.counts.likes + (liked ? 1 : 0))}
              repostCount={status.post.counts.reposts}
              onOpen={() => undefined}
              onLike={() => void toggleLike()}
              onRepost={() => { setRepostOpen(true); setRepostText(''); setRepostError(''); }}
              onReply={() => replyRef.current?.focus()}
            />
          </div>

          <div className="detail__comments" data-testid="reply-list">
            <h2 className="detail__section-title">回复 {commentPage?.items.length ?? 0}</h2>
            {commentError ? (
              <EmptyState
                kind="error"
                title="回复没有加载出来"
                text="这条微博本身已加载；回复可稍后重试。"
                actionLabel="去登录"
                onAction={onLogin}
                testid="comment-error"
              />
            ) : roots.length === 0 ? (
              <EmptyState title="还没有回复" text="写下第一条回复吧。" testid="comment-empty" />
            ) : (
              roots.map((reply) => renderReply(reply, null))
            )}
            {commentPage?.hasMore ? (
              <button
                type="button"
                className="btn btn--ghost"
                data-testid="comments-more"
                onClick={async () => {
                  try {
                    const next = await getComments(postId, commentPage.next, 'online');
                    setComments({ ...next, items: [...commentPage.items, ...next.items] });
                  } catch (reason) {
                    setCommentError(reason instanceof ApiError ? reason : new ApiError('UPSTREAM', '评论加载失败', 0));
                  }
                }}
              >
                加载更多回复
              </button>
            ) : null}
            <div className="detail__composer">
              <textarea
                ref={replyRef}
                className="write-sheet__input detail__reply-input"
                data-testid="reply-input"
                rows={3}
                maxLength={140}
                placeholder="写下你的回复…"
                value={replyText}
                onChange={(event) => { setReplyText(event.target.value.slice(0, 140)); setReplyWriteError(''); }}
              />
              {replyWriteError ? <p className="write-sheet__error" data-testid="reply-write-error" role="alert">{replyWriteError}</p> : null}
              <div className="write-sheet__actions">
                <button type="button" className="btn btn--primary" data-testid="reply-send" disabled={!replyText.trim() || replyBusy} onClick={() => void submitReply()}>
                  {replyBusy ? '发送中…' : '发送回复'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <WriteSheet
        open={repostOpen}
        title="转发"
        placeholder="说点什么，可不填…"
        value={repostText}
        onChange={(value) => { setRepostText(value); setRepostError(''); }}
        busy={repostBusy}
        error={repostError}
        submitLabel="转发"
        onSubmit={() => void submitRepost()}
        onClose={() => { if (!repostBusy) setRepostOpen(false); }}
      />
    </section>
  );
}
