import type { ReactNode } from 'react';
import type { ProfileTab } from '../types';
import { useStore, displayLikes, displayReposts, findPost, likedByMe, profilePostsFor, repliesOf, statPostCount } from '../store';
import { getAuthor } from '../data/mock';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { EmptyState } from '../components/EmptyState';
import { Segment } from '../components/Segment';
import { VerifiedMark } from '../components/VerifiedMark';

/** 屏 4 · 我的（spec §9）：信息头 + 统计 + 段控件 + 列表（与统计同源）。 */
export function ProfilePage({
  tab,
  onTab,
  error,
  onRetry,
  onOpen,
  onLike,
  onRepost,
  onReply,
  onCompose,
  account,
}: {
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
  error: boolean;
  onRetry: () => void;
  onOpen: (postId: string) => void;
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
  onReply: (postId: string) => void;
  onCompose: () => void;
  account?: ReactNode;
}) {
  const { state } = useStore();
  const me = getAuthor('u_01');
  const list = profilePostsFor(state, tab);
  const postTotal = statPostCount(state);

  return (
    <section className="profile" data-testid="profile-root" data-post-count={list.length}>
      <header className="rill-header">
        <div className="rill-header__inner">
          <h1 className="rill-header__title">我的</h1>
          <span className="rill-header__spacer" />
          {account}
        </div>
      </header>

      <div className="profile__head" data-testid="profile-header">
        <div className="profile__id">
          <Avatar author={me} size="lg" />
          <div>
            <h2 className="profile__name" data-testid="profile-nickname">
              {me.nickname}
              <VerifiedMark verified={me.verified} />
            </h2>
            <p className="profile__handle">@{me.handle}</p>
          </div>
        </div>
        <p className="profile__bio" data-testid="profile-bio">
          {me.bio}
        </p>
        <ul className="profile__stats">
          <li className="profile__stat">
            <b data-testid="stat-posts" className="tnum">
              {postTotal}
            </b>
            <span>博文</span>
          </li>
          <li className="profile__stat">
            <b data-testid="stat-following" className="tnum">
              {me.followingCount}
            </b>
            <span>关注</span>
          </li>
          <li className="profile__stat">
            <b data-testid="stat-followers" className="tnum">
              {me.followerCount}
            </b>
            <span>粉丝</span>
          </li>
        </ul>
      </div>

      <Segment
        items={[
          { key: 'posts', label: '我的博文' },
          { key: 'liked', label: '赞过的' },
        ]}
        value={tab}
        onChange={onTab}
        testid="profile-tab"
        label="我的内容切换"
      />

      <div className="profile__count" data-testid="profile-post-count">
        共 {list.length} 条
      </div>

      {error ? (
        <EmptyState kind="error" title="内容没有加载出来" text="检查一下再试" actionLabel="重试" onAction={onRetry} testid="error-state" />
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === 'posts' ? '还没有发过内容' : '还没有赞过的内容'}
          text={tab === 'posts' ? '发一条，这里就有了' : '在时间线里点个赞试试'}
          actionLabel={tab === 'posts' ? '去发一条' : undefined}
          onAction={tab === 'posts' ? onCompose : undefined}
          testid="profile-empty"
        />
      ) : (
        <div className="profile__list" data-testid="profile-list" data-post-count={list.length}>
          {list.map((post) => {
            const author = getAuthor(post.authorId);
            const target = post.repostOfId ? findPost(state, post.repostOfId) : undefined;
            return (
              <PostCard
                key={post.id}
                post={post}
                author={author}
                compact
                liked={likedByMe(state, post.id)}
                replyCount={repliesOf(state, post.id).length}
                likeCount={displayLikes(state, post)}
                repostCount={displayReposts(state, post)}
                repostTarget={target ? { post: target, author: getAuthor(target.authorId) } : undefined}
                onOpen={() => onOpen(post.id)}
                onLike={() => onLike(post.id)}
                onRepost={() => onRepost(post.id)}
                onReply={() => onReply(post.id)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}