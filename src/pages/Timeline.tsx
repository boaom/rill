import type { ReactNode } from 'react';
import { useStore } from '../store';
import { displayLikes, displayReposts, findPost, likedByMe, repliesOf, timelineFor } from '../store';
import { getAuthor } from '../data/mock';
import { PostCard } from '../components/PostCard';
import { EmptyState } from '../components/EmptyState';
import type { FeedTab } from '../types';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function dateParts(timestamp: number) {
  const date = new Date(timestamp);
  return {
    date: `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`,
    weekday: WEEKDAYS[date.getDay()] ?? '',
  };
}

/** 屏 1 · 时间线（A「日报」/ spec §6）。 */
export function TimelinePage({
  feedTab,
  onFeedTab,
  visibleCount,
  onLoadMore,
  refreshCount,
  refreshing,
  onRefresh,
  error,
  onRetry,
  onOpen,
  onLike,
  onRepost,
  onReply,
  onCompose,
  freshPostId,
  account,
}: {
  feedTab: FeedTab;
  onFeedTab: (tab: FeedTab) => void;
  visibleCount: number;
  onLoadMore: () => void;
  refreshCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  error: boolean;
  onRetry: () => void;
  onOpen: (postId: string) => void;
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
  onReply: (postId: string) => void;
  onCompose: () => void;
  freshPostId: string | null;
  account?: ReactNode;
}) {
  const { state } = useStore();
  const all = timelineFor(state, feedTab);
  const posts = all.slice(0, visibleCount);
  const hasMore = posts.length < all.length;
  const when = latestTimestamp(all, state.posts[0]?.createdAt ?? Date.now());
  const date = dateParts(when);
  const imageCount = all.reduce((total, post) => total + post.media.length, 0);
  const followingCount = new Set(timelineFor(state, 'following').map((post) => post.authorId)).size;
  const feedLabel = feedTab === 'following' ? '关注' : '推荐';
  const topics = Array.from(new Set(all.flatMap((post) => post.topics))).slice(0, 5);

  const tab = (key: FeedTab, label: string, count: number) => (
    <button
      key={key}
      type="button"
      role="tab"
      className="mast__tab"
      data-testid="feed-tab"
      data-selected={feedTab === key}
      aria-selected={feedTab === key}
      data-count={count}
      onClick={() => onFeedTab(key)}
    >
      {label}
    </button>
  );

  return (
    <section className="timeline-page" data-testid="timeline-root" data-post-count={posts.length} data-refresh-count={refreshCount}>
      <header className="rill-header mast">
        <div className="mast__inner">
          <h1 className="mast__name">溪流</h1>
          <span className="mast__en">RILL</span>
          <nav className="mast__tabs" role="tablist" aria-label="信息流切换">
            {tab('following', '关注', followingCount)}
            {tab('recommend', '推荐', all.length)}
          </nav>
          <div className="mast__spacer" />
          {account}
          <button
            type="button"
            className="btn btn--text mast__refresh"
            data-testid="refresh-btn"
            aria-label="刷新"
            disabled={refreshing}
            onClick={onRefresh}
          >
            刷新
          </button>
        </div>
      </header>

      <div className="timeline-grid">
        <aside className="side side--date" aria-label="日期栏">
          <div className="side__date">
            <b>{date.date}</b>
            <span>{date.weekday}</span>
          </div>
          <p className="side__edition">第 01 版 · {feedLabel}</p>
          <p className="side__note">一份只属于今天的时间线。慢慢读，别急。</p>
          {topics.length > 0 ? (
            <div className="side__topics">
              <span>今日话题</span>
              {topics.map((topic) => <em key={topic}>#{topic}#</em>)}
            </div>
          ) : null}
        </aside>

        <div className="timeline-feed">
          <div className="dateline">
            <b>{date.date}</b>
            <em>{date.weekday} · {feedLabel}</em>
          </div>

          {error ? (
            <div className="feed">
              <EmptyState kind="error" title="内容没有加载出来" text="检查一下再试" actionLabel="重试" onAction={onRetry} testid="error-state" />
            </div>
          ) : posts.length === 0 ? (
            <div className="feed">
              <EmptyState title="这里还没有内容" text="发一条，溪流就有水了" actionLabel="去发一条" onAction={onCompose} testid="empty-state" />
            </div>
          ) : (
            <div className="feed">
              <div className="timeline__list">
                {posts.map((post) => {
                  const author = getAuthor(post.authorId);
                  const target = post.repostOfId ? findPost(state, post.repostOfId) : undefined;
                  return (
                    <PostCard
                      key={post.id}
                      post={post}
                      author={author}
                      liked={likedByMe(state, post.id)}
                      replyCount={repliesOf(state, post.id).length}
                      likeCount={displayLikes(state, post)}
                      repostCount={displayReposts(state, post)}
                      repostTarget={target ? { post: target, author: getAuthor(target.authorId) } : undefined}
                      fresh={post.id === freshPostId}
                      onOpen={() => onOpen(post.id)}
                      onLike={() => onLike(post.id)}
                      onRepost={() => onRepost(post.id)}
                      onReply={() => onReply(post.id)}
                    />
                  );
                })}
              </div>
              <div className="timeline__more">
                <button
                  type="button"
                  className="btn btn--ghost"
                  data-testid="load-more"
                  disabled={!hasMore}
                  onClick={onLoadMore}
                >
                  {hasMore ? '加载更早' : '没有更早的了'}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="side side--stats" aria-label="今日读数">
          <p className="side__kicker">TODAY</p>
          <h2 className="side__title">今日读数</h2>
          <div className="side__num"><b>{all.length}</b><span>条</span></div>
          <div className="side__num"><b>{imageCount}</b><span>图</span></div>
          <div className="side__rule" />
          <p className="side__small">关注流里有 {followingCount} 位作者。</p>
          <p className="side__small">本机离线数据 · 第 {refreshCount + 1} 版</p>
          <div className="side__topics">
            <span>正在发生</span>
            {topics.map((topic) => <em key={topic}>#{topic}#</em>)}
          </div>
        </aside>
      </div>

      <div className="statbar" aria-label="今日读数">
        <div><b>{all.length}</b><i>条</i></div>
        <div><b>{imageCount}</b><i>图</i></div>
      </div>
    </section>
  );
}

function latestTimestamp(posts: { createdAt: number }[], fallback: number) {
  if (posts.length === 0) return fallback;
  return posts.reduce((max, post) => Math.max(max, post.createdAt), posts[0].createdAt);
}