import { IconLike, IconReply, IconRepost } from './icons';

/** 计数行：转发 / 回复 / 赞 三按钮，列表与详情共享同一状态（INV-1/2）。 */
export function ActionBar({
  repostCount,
  replyCount,
  likeCount,
  liked,
  detail = false,
  onRepost,
  onReply,
  onLike,
  replyLabel = '回复',
}: {
  repostCount: number;
  replyCount: number;
  likeCount: number;
  liked: boolean;
  detail?: boolean;
  onRepost: () => void;
  onReply: () => void;
  onLike: () => void;
  replyLabel?: string;
}) {
  return (
    <div className={detail ? 'card__actions detail__actions' : 'card__actions'}>
      <button
        type="button"
        className="act"
        data-testid="repost-btn"
        aria-label="转发"
        onClick={(event) => {
          event.stopPropagation();
          onRepost();
        }}
      >
        <IconRepost />
        <span className="act__count" data-testid="repost-count">
          {repostCount}
        </span>
      </button>
      <button
        type="button"
        className="act"
        data-testid="reply-btn"
        aria-label={replyLabel}
        onClick={(event) => {
          event.stopPropagation();
          onReply();
        }}
      >
        <IconReply />
        <span className="act__count" data-testid="reply-count">
          {replyCount}
        </span>
      </button>
      <button
        type="button"
        className="act"
        data-testid="like-btn"
        aria-label={liked ? '取消赞' : '赞'}
        aria-pressed={liked}
        onClick={(event) => {
          event.stopPropagation();
          onLike();
        }}
      >
        <IconLike filled={liked} className={liked ? 'act__icon act__icon--like is-active' : 'act__icon act__icon--like'} />
        <span className={`act__count${liked ? '' : ''}`} data-testid="like-count">
          {likeCount}
        </span>
      </button>
    </div>
  );
}