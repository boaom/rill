import { useState } from 'react';
import { AccountChip } from '../components/AccountChip';
import { EmptyState } from '../components/EmptyState';
import { PostCard } from '../components/PostCard';
import { getAuthor } from '../data/mock';
import { ApiError, RISK_CONTROL_COPY, searchPosts, setLike, writeErrorMessage, type ApiMode, type SessionInfo } from '../data/api';
import type { Author, Post } from '../types';

function errorState(error: ApiError): { title: string; text: string; action?: string } {
  if (error.code === 'AUTH_EXPIRED' || error.code === 'AUTH_REQUIRED') {
    return { title: '需要重新登录', text: 'Cookie 可能已过期；重新粘贴后即可继续搜索。', action: '去登录' };
  }
  if (error.code === 'RATE_LIMITED') return { title: '操作太快了', text: '微博限流了，等一会儿再试。', action: '重试' };
  if (error.code === 'RISK_CONTROL') return { ...RISK_CONTROL_COPY };
  return { title: '搜索没有加载出来', text: '检查网络后再试。', action: '重试' };
}

export function SearchPage({
  online,
  mode = 'backend',
  session,
  onLogin,
  onLogout,
  onOpen,
  onToast,
}: {
  online: boolean;
  mode?: ApiMode;
  session: SessionInfo | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpen: (id: string) => void;
  onToast: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  const [items, setItems] = useState<Post[]>([]);
  const [users, setUsers] = useState<Author[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [searched, setSearched] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likeBusy, setLikeBusy] = useState<Set<string>>(() => new Set());

  const runSearch = async () => {
    const query = input.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await searchPosts(query, 'statuses', null, mode);
      setItems(page.items.filter((item): item is Post => Boolean(item && typeof (item as Post).text === 'string')));
      setUsers(page.users);
      setSearched(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason : new ApiError('UPSTREAM', '搜索失败', 0));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const lookup = (id: string): Author => users.find((user) => user.id === id) || getAuthor(id);
  const state = error ? errorState(error) : null;

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
      await setLike(post.id, nextOn, mode);
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

  return (
    <section data-testid="search-root" data-online={online ? 'true' : 'false'}>
      <header className="rill-header">
        <div className="rill-header__inner">
          <a className="btn btn--text" href="#/timeline" data-testid="search-back">
            返回
          </a>
          <h1 className="rill-header__title">搜索</h1>
          <span className="rill-header__spacer" />
          <AccountChip online={online} session={session} onLogin={onLogin} onLogout={onLogout} />
        </div>
      </header>

      {!online ? (
        <EmptyState
          title="搜索只在线可用"
          text="离线模式继续用随包 mock 时间线；登录微博后这里会读真实搜索。"
          actionLabel="去登录"
          onAction={onLogin}
          testid="search-offline"
        />
      ) : (
        <div className="search">
          <form
            className="search__form"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <label className="sr-only" htmlFor="search-input">
              搜索微博
            </label>
            <input
              id="search-input"
              className="search__input"
              data-testid="search-input"
              type="search"
              placeholder="搜微博、话题或作者"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              enterKeyHint="search"
            />
            <button type="submit" className="btn btn--primary" data-testid="search-submit" disabled={!input.trim() || loading}>
              {loading ? '搜索中' : '搜索'}
            </button>
          </form>
          <p className="search__hint">只读搜索；内容来自微博（m.weibo.cn），低频请求已做 30–60 秒缓存。</p>

          {state ? (
            <EmptyState
              kind="error"
              title={state.title}
              text={state.text}
              actionLabel={state.action}
              onAction={() => {
                if (error && (error.code === 'AUTH_EXPIRED' || error.code === 'AUTH_REQUIRED')) onLogin();
                else void runSearch();
              }}
              testid="search-error"
            />
          ) : loading ? (
            <div className="state" data-testid="search-loading">
              <p className="state__title">正在搜索…</p>
            </div>
          ) : !searched ? (
            <EmptyState title="搜点什么" text="输入关键词，回车或点搜索。" testid="search-empty" />
          ) : items.length === 0 ? (
            <EmptyState title="没有找到结果" text="换个词试试，或确认账号有搜索权限。" testid="search-empty" />
          ) : (
            <div className="timeline__list" data-testid="search-results" data-post-count={items.length}>
              {items.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  author={lookup(post.authorId)}
                  liked={liked.has(post.id)}
                  replyCount={post.counts.replies}
                  likeCount={post.counts.likes + (liked.has(post.id) ? 1 : 0)}
                  repostCount={post.counts.reposts}
                  onOpen={() => onOpen(post.id)}
                  onLike={() => void toggleLike(post)}
                  onRepost={() => onOpen(post.id)}
                  onReply={() => onOpen(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
