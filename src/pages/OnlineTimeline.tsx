import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountChip } from '../components/AccountChip';
import { EmptyState } from '../components/EmptyState';
import { PostCard } from '../components/PostCard';
import { Segment } from '../components/Segment';
import { WriteSheet } from '../components/WriteSheet';
import { getAuthor } from '../data/mock';
import { ApiError, commentStatus, getTimeline, repostStatus, setLike, writeErrorMessage, type Page, type SessionInfo } from '../data/api';
import type { Author, FeedTab, Post } from '../types';

function readableError(error: ApiError): { title: string; text: string; action: string; auth: boolean } {
  if (error.code === 'AUTH_EXPIRED' || error.code === 'AUTH_REQUIRED') {
    return { title: '需要重新登录', text: 'Cookie 可能已过期或被吊销；重新粘贴后继续。', action: '去登录', auth: true };
  }
  if (error.code === 'RATE_LIMITED') return { title: '操作太快了', text: '微博限流了，等一分钟再试。', action: '重试', auth: false };
  if (error.code === 'RISK_CONTROL') return { title: '触发了风控', text: '微博要求人工验证；稍后再试，或换网络。', action: '重试', auth: false };
  return { title: '内容没有加载出来', text: '检查本机 server、网络与 Cookie 后再试。', action: '重试', auth: false };
}

export function OnlineTimelinePage({
  feedTab,
  onFeedTab,
  session,
  onLogin,
  onLogout,
  onOpen,
  onToast,
  freshPost,
  freshAuthor,
}: {
  feedTab: FeedTab;
  onFeedTab: (tab: FeedTab) => void;
  session: SessionInfo | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpen: (id: string) => void;
  onToast: (text: string) => void;
  freshPost?: Post | null;
  freshAuthor?: Author | null;
}) {
  const [page, setPage] = useState<Page<Post> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likeBusy, setLikeBusy] = useState<Set<string>>(() => new Set());
  const [overrides, setOverrides] = useState<Record<string, Partial<Post['counts']>>>({});
  const [writeKind, setWriteKind] = useState<'repost' | 'comment' | null>(null);
  const [writePost, setWritePost] = useState<Post | null>(null);
  const [writeText, setWriteText] = useState('');
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeError, setWriteError] = useState('');

  const load = useCallback(async (tab: FeedTab, reset: boolean, cursor: string | null = null) => {
    if (reset) setLoading(true);
    setError(null);
    try {
      const next = await getTimeline(tab, reset ? null : cursor, 'online');
      setPage((prev) => {
        if (reset || !prev) return next;
        const seen = new Set(prev.items.map((item) => item.id));
        return { ...next, items: [...prev.items, ...next.items.filter((item) => !seen.has(item.id))] };
      });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason : new ApiError('UPSTREAM', '加载失败', 0));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(feedTab, true);
  }, [feedTab, load]);

  const authors = useMemo(() => {
    const map = new Map<string, Author>();
    for (const user of page?.users ?? []) map.set(user.id, user);
    return map;
  }, [page]);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshCount((count) => count + 1);
    void load(feedTab, true);
    onToast('已刷新');
  };

  const toggleLike = async (post: Post) => {
    if (likeBusy.has(post.id)) return;
    const nextOn = !liked.has(post.id);
    setLiked((prev) => {
      const next = new Set(prev);
      if (nextOn) next.add(post.id);
      else next.delete(post.id);
      return next;
    });
    setLikeBusy((prev) => new Set(prev).add(post.id));
    try {
      const result = await setLike(post.id, nextOn);
      if (Number.isFinite(result.count) && result.count > 0) {
        setOverrides((prev) => ({ ...prev, [post.id]: { ...prev[post.id], likes: result.count } }));
      }
      onToast(nextOn ? '已赞' : '已取消赞');
    } catch (reason) {
      setLiked((prev) => {
        const next = new Set(prev);
        if (nextOn) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      onToast(writeErrorMessage(reason));
    } finally {
      setLikeBusy((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  const openWrite = (kind: 'repost' | 'comment', post: Post) => {
    setWriteKind(kind);
    setWritePost(post);
    setWriteText('');
    setWriteError('');
  };

  const closeWrite = () => {
    if (writeBusy) return;
    setWriteKind(null);
    setWritePost(null);
  };

  const submitWrite = async () => {
    if (!writePost || !writeKind || !writeText.trim() || writeBusy) return;
    setWriteBusy(true);
    setWriteError('');
    try {
      if (writeKind === 'repost') {
        const result = await repostStatus(writePost.id, writeText.trim());
        setOverrides((prev) => ({
          ...prev,
          [writePost.id]: { ...prev[writePost.id], reposts: (prev[writePost.id]?.reposts ?? writePost.counts.reposts) + 1 },
        }));
        onToast(result.notice || (result.pending ? '已转发（待同步）' : '已转发'));
      } else {
        const result = await commentStatus(writePost.id, writeText.trim());
        setOverrides((prev) => ({
          ...prev,
          [writePost.id]: { ...prev[writePost.id], replies: (prev[writePost.id]?.replies ?? writePost.counts.replies) + 1 },
        }));
        onToast(`已评论${result.reply.text ? '' : '（待同步）'}`);
      }
      setWriteText('');
      setWriteKind(null);
      setWritePost(null);
    } catch (reason) {
      setWriteError(writeErrorMessage(reason));
    } finally {
      setWriteBusy(false);
    }
  };

  const state = error ? readableError(error) : null;
  const loaded = page?.items ?? [];
  const items = freshPost && !loaded.some((item) => item.id === freshPost.id)
    ? [freshPost, ...loaded]
    : loaded;
  const shownLiked = (id: string) => liked.has(id);
  const shownLikeCount = (post: Post) => overrides[post.id]?.likes ?? (post.counts.likes + (shownLiked(post.id) ? 1 : 0));
  const shownRepostCount = (post: Post) => overrides[post.id]?.reposts ?? post.counts.reposts;

  return (
    <section data-testid="timeline-root" data-post-count={items.length} data-refresh-count={refreshCount} data-online="true">
      <header className="rill-header">
        <div className="rill-header__inner">
          <h1 className="rill-header__title">时间线</h1>
          <a className="btn btn--text header__link" href="#/search" data-testid="search-entry">
            搜索
          </a>
          <AccountChip online session={session} onLogin={onLogin} onLogout={onLogout} />
          <button
            type="button"
            className="btn btn--text"
            data-testid="refresh-btn"
            aria-label="刷新"
            disabled={refreshing}
            onClick={refresh}
          >
            刷新
          </button>
        </div>
      </header>

      <Segment
        items={[
          { key: 'following', label: '关注' },
          { key: 'recommend', label: '推荐' },
        ]}
        value={feedTab}
        onChange={onFeedTab}
        testid="feed-tab"
        label="信息流切换"
      />

      {loading && !page ? (
        <div className="state" data-testid="timeline-loading">
          <p className="state__title">正在加载时间线…</p>
        </div>
      ) : state ? (
        <EmptyState
          kind="error"
          title={state.title}
          text={state.text}
          actionLabel={state.action}
          onAction={() => {
            if (state.auth) onLogin();
            else void load(feedTab, true);
          }}
          testid={state.auth ? 'auth-error' : 'error-state'}
        />
      ) : items.length === 0 ? (
        <EmptyState title="这里还没有内容" text="在线流为空，或账号没有可见内容。" actionLabel="刷新" onAction={refresh} testid="empty-state" />
      ) : (
        <>
          <div className="timeline__list">
            {items.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                author={(post.id === freshPost?.id ? freshAuthor : null) || authors.get(post.authorId) || getAuthor(post.authorId)}
                liked={shownLiked(post.id)}
                replyCount={overrides[post.id]?.replies ?? post.counts.replies}
                likeCount={shownLikeCount(post)}
                repostCount={shownRepostCount(post)}
                onOpen={() => onOpen(post.id)}
                onLike={() => void toggleLike(post)}
                onRepost={() => openWrite('repost', post)}
                onReply={() => openWrite('comment', post)}
              />
            ))}
          </div>
          <div className="timeline__more">
            <button
              type="button"
              className="btn btn--ghost"
              data-testid="load-more"
              disabled={!page?.hasMore || loading}
              onClick={() => void load(feedTab, false, page?.next ?? null)}
            >
              {page?.hasMore ? (loading ? '加载中…' : '加载更早') : '没有更早的了'}
            </button>
          </div>
        </>
      )}

      {freshPost && freshPost.id.startsWith('pending_') ? (
        <p className="profile__note" data-testid="publish-pending">新内容已提交，微博暂未返回 id；标为待同步。</p>
      ) : null}

      <WriteSheet
        open={Boolean(writeKind && writePost)}
        title={writeKind === 'repost' ? '转发' : '评论'}
        placeholder={writeKind === 'repost' ? '说点什么，可不填…' : '写下你的评论…'}
        value={writeText}
        onChange={(value) => { setWriteText(value); setWriteError(''); }}
        busy={writeBusy}
        error={writeError}
        submitLabel={writeKind === 'repost' ? '转发' : '发送'}
        onSubmit={() => void submitWrite()}
        onClose={closeWrite}
      />
    </section>
  );
}
