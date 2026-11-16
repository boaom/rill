import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Author, Post } from '../types';
import { ActionBar } from './ActionBar';
import { Avatar } from './Avatar';
import { MediaBlock } from './MediaGrid';
import { TopicText } from './TopicText';
import { VerifiedMark } from './VerifiedMark';
import { displaySource } from '../lib/source';
import { formatRelative, isoTime } from '../lib/time';

/** 时间线卡片（A「日报」语法 / spec §6）。折叠判据看 scrollHeight，不看字数。 */
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
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);

  useLayoutEffect(() => {
    // 展开后 clientHeight 会等于 scrollHeight，不能再据此判断；只在折叠态测量。
    if (expanded) return;
    const el = bodyRef.current;
    if (!el) return;
    setNeedsExpand(el.scrollHeight > el.clientHeight + 1);
  }, [post.text, expanded, clamp]);

  useEffect(() => {
    if (expanded) return;
    let timer = 0;
    const measure = () => {
      timer = 0;
      const el = bodyRef.current;
      if (!el) return;
      setNeedsExpand(el.scrollHeight > el.clientHeight + 1);
    };
    const onResize = () => {
      if (timer) return;
      timer = window.setTimeout(measure, 80);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [expanded]);

  // 折叠态最多一行 3 张；短帖不砍图；展开后全量 3×3。
  const foldLimit = !expanded && needsExpand ? Math.min(3, post.media.length) : undefined;
  const source = displaySource(post.source);

  return (
    <article
      className={`card${fresh ? ' is-fresh' : ''}`}
      data-testid="post-card"
      data-post-id={post.id}
      data-author-id={post.authorId}
      data-repost-of={post.repostOfId ?? ''}
      data-longtext={needsExpand ? 'true' : undefined}
      data-expanded={expanded ? 'true' : undefined}
      onClick={onOpen}
    >
      <div className="card__head" data-testid="post-author">
        <Avatar author={author} testid="post-avatar" />
        <h2 className="card__name">{author.nickname}</h2>
        <VerifiedMark verified={author.verified} />
        <span className="card__handle">@{author.handle}</span>
        <time className="card__time" data-testid="post-time" dateTime={isoTime(post.createdAt)}>
          {formatRelative(post.createdAt)}
        </time>
        {source ? (
          <span className="card__src" data-source={source}>
            {source}
          </span>
        ) : null}
      </div>

      <p
        ref={bodyRef}
        className="card__text body"
        data-testid="post-text"
        data-clamped={clamp}
        style={{ ['--rill-clamp' as string]: String(clamp) }}
      >
        <TopicText text={post.text} />
      </p>

      {needsExpand ? (
        <button
          type="button"
          className="more"
          data-testid="expand-text"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          {expanded ? '收起' : '展开全文'}
        </button>
      ) : null}

      {post.media.length > 0 ? (
        <MediaBlock media={post.media} testid="media-grid" limit={foldLimit} />
      ) : null}

      {repostTarget ? (
        <div className="card__quote quote" data-testid="quote-block">
          <div className="quote__rail" aria-hidden="true" />
          <div className="quote__inner">
            <p className="quote__meta">
              <span className="quote__name">{repostTarget.author.nickname}</span>
              <span className="quote__handle">@{repostTarget.author.handle}</span>
            </p>
            <p className="quote__text">
              <TopicText text={repostTarget.post.text} />
            </p>
            {repostTarget.post.media.length > 0 ? (
              <div className="quote__last" aria-hidden="true">
                <MediaBlock
                  media={[repostTarget.post.media[repostTarget.post.media.length - 1]]}
                  className="quote__img"
                />
              </div>
            ) : null}
          </div>
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