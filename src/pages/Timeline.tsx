import { useStore } from '../store';
import { displayLikes, displayReposts, findPost, likedByMe, repliesOf, timelineFor } from '../store';
import { getAuthor } from '../data/mock';
import { PostCard } from '../components/PostCard';
import { EmptyState } from '../components/EmptyState';
import { Segment } from '../components/Segment';
import type { FeedTab } from '../types';

/** 屏 1 · 时间线（spec §6）。 */
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
}) {
  const { state } = useStore();
  const all = timelineFor(state, feedTab);
  const posts = all.slice(0, visibleCount);
  const hasMore = posts.length < all.length;

  return (
    <section data-testid="timeline-root" data-post-count={posts.length} data-refresh-count={refreshCount}>
      <header className="rill-header">
        <div className="rill-header__inner">
          <h1 className="rill-header__title">时间线</h1>
          <button
            type="button"
            className="btn btn--text"
            data-testid="refresh-btn"
            aria-label="刷新"
            disabled={refreshing}
            onClick={onRefresh}
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

      {error ? (
        <EmptyState kind="error" title="内容没有加载出来" text="检查一下再试" actionLabel="重试" onAction={onRetry} testid="error-state" />
      ) : posts.length === 0 ? (
        <EmptyState title="这里还没有内容" text="发一条，溪流就有水了" actionLabel="去发一条" onAction={onCompose} testid="empty-state" />
      ) : (
        <>
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
        </>
      )}
    </section>
  );
}