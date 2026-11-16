import type { Author, Post } from '../types';
import { ActionBar } from './ActionBar';
import { Avatar } from './Avatar';
import { MediaBlock } from './MediaGrid';
import { TopicText } from './TopicText';
import { formatRelative, isoTime } from '../lib/time';

/** 时间线卡片（spec §6 / design.md §4.3）。 */
export function PostCard({
  post,
  author,
  liked,
  replyCount,
  likeCount,
  repostCount,
  repostTarget,
  compact = false,
  fresh = false,
  onOpen,
  onLike,
  onRepost,
  onReply,
}: {
  post: Post;
  author: Author;
  liked: boolean;
  replyCount: number;
  likeCount: number;
  repostCount: number;
  repostTarget?: { post: Post; author: Author };
  compact?: boolean;
  fresh?: boolean;
  onOpen: () => void;
  onLike: () => void;
  onRepost: () => void;
  onReply: () => void;
}) {
  const clamp = compact ? 4 : 6;
  return (
    <article
      className={`card${fresh ? ' is-fresh' : ''}`}
      data-testid="post-card"
      data-post-id={post.id}
      data-author-id={post.authorId}
      data-repost-of={post.repostOfId ?? ''}
      onClick={onOpen}
    >
      <div className="card__head">
        <Avatar author={author} testid="post-avatar" />
        <div className="card__meta">
          <h2 className="card__name" data-testid="post-author">
            {author.nickname}
          </h2>
          <span className="card__handle">@{author.handle}</span>
        </div>
        <time className="card__time" data-testid="post-time" dateTime={isoTime(post.createdAt)}>
          {formatRelative(post.createdAt)}
        </time>
      </div>

      <p
        className="card__text"
        data-testid="post-text"
        data-clamped={clamp}
        style={{ ['--rill-clamp' as string]: String(clamp) }}
      >
        <TopicText text={post.text} />
      </p>

      {post.media.length > 0 ? <MediaBlock media={post.media} testid="media-grid" /> : null}

      {repostTarget ? (
        <div className="card__quote" data-testid="quote-block">
          <p className="card__quote__name">{repostTarget.author.nickname}</p>
          <p className="card__quote__text">{repostTarget.post.text}</p>
        </div>
      ) : null}

      <ActionBar
        repostCount={repostCount}
        replyCount={replyCount}
        likeCount={likeCount}
        liked={liked}
        onRepost={onRepost}
        onReply={onReply}
        onLike={onLike}
      />
    </article>
  );
}