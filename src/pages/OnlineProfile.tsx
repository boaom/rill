import { useEffect, useState } from 'react';
import { AccountChip } from '../components/AccountChip';
import { EmptyState } from '../components/EmptyState';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { Segment } from '../components/Segment';
import { getAuthor } from '../data/mock';
import { ApiError, getUser, getUserPosts, setLike, writeErrorMessage, type Page, type SessionInfo } from '../data/api';
import type { Author, Post, ProfileTab } from '../types';

function accountAuthor(session: SessionInfo | null): Author {
  const user = session?.user;
  const name = user?.screenName || '已登录';
  return {
    id: user?.uid || 'me',
    nickname: name,
    handle: user?.uid ? `u${String(user.uid).replace(/^u/, '')}` : 'me',
    avatarText: Array.from(name).slice(0, 2).join(''),
    avatarHue: 168,
    bio: '来自微博的账号',
    followingCount: 0,
    followerCount: 0,
    postCount: 0,
    isCurrentUser: true,
  };
}

export function OnlineProfilePage({
  tab,
  onTab,
  session,
  onLogin,
  onLogout,
  onOpen,
  onToast,
}: {
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
  session: SessionInfo | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpen: (id: string) => void;
  onToast: (text: string) => void;
}) {
  const [user, setUser] = useState<Author | null>(() => accountAuthor(session));
  const [page, setPage] = useState<Page<Post> | null>(null);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likeBusy, setLikeBusy] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const uid = session?.user?.uid ?? null;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      if (!uid) {
        setUser(accountAuthor(session));
        setPage(null);
        setLoading(false);
        return;
      }
      try {
        const [nextUser, nextPage] = await Promise.all([getUser(uid, 'online'), getUserPosts(uid, null, 'online')]);
        if (!alive) return;
        setUser(nextUser);
        setPage(nextPage);
      } catch (reason) {
        if (alive) setError(reason instanceof ApiError ? reason : new ApiError('UPSTREAM', '用户页加载失败', 0));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, session]);

  const me = user || accountAuthor(session);
  const posts = page?.items ?? [];
  const authError = error && (error.code === 'AUTH_EXPIRED' || error.code === 'AUTH_REQUIRED');
  const list = tab === 'liked' ? [] : posts;

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
      await setLike(post.id, nextOn);
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
    <section data-testid="profile-root" data-post-count={list.length} data-online="true">
      <header className="rill-header">
        <div className="rill-header__inner">
          <h1 className="rill-header__title">我的</h1>
          <span className="rill-header__spacer" />
          <AccountChip online session={session} onLogin={onLogin} onLogout={onLogout} />
        </div>
      </header>

      <div className="profile__head" data-testid="profile-header">
        <div className="profile__id">
          <Avatar author={me} size="lg" />
          <div>
            <h2 className="profile__name" data-testid="profile-nickname">
              {me.nickname}
            </h2>
            <p className="profile__handle">@{me.handle}</p>
          </div>
        </div>
        <p className="profile__bio" data-testid="profile-bio">
          {me.bio}
        </p>
        {!uid ? (
          <p className="profile__note">已登录，但微博没有返回 uid；先按联调清单确认身份字段。</p>
        ) : null}
        <ul className="profile__stats">
          <li className="profile__stat">
            <b data-testid="stat-following" className="tnum">{me.followingCount}</b>
            <span>关注</span>
          </li>
          <li className="profile__stat">
            <b data-testid="stat-followers" className="tnum">{me.followerCount}</b>
            <span>粉丝</span>
          </li>
          <li className="profile__stat">
            <b data-testid="stat-posts" className="tnum">{me.postCount || posts.length}</b>
            <span>动态</span>
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

      {loading ? (
        <div className="state" data-testid="profile-loading">
          <p className="state__title">正在加载账号…</p>
        </div>
      ) : authError ? (
        <EmptyState
          kind="error"
          title="需要重新登录"
          text="Cookie 可能已过期；重新粘贴后继续。"
          actionLabel="去登录"
          onAction={onLogin}
          testid="auth-error"
        />
      ) : error ? (
        <EmptyState
          kind="error"
          title="用户页没有加载出来"
          text="检查 server 与网络后再试。"
          actionLabel="重试"
          onAction={() => window.location.reload()}
          testid="error-state"
        />
      ) : tab === 'liked' ? (
        <EmptyState title="赞过的暂不展示" text="当前版本先展示这条账号的主页时间线。" testid="profile-empty" />
      ) : list.length === 0 ? (
        <EmptyState title="还没有发过内容" text="这个账号的博文为空，或暂不可见。" testid="profile-empty" />
      ) : (
        <div className="profile__list" data-testid="profile-list" data-post-count={list.length}>
          {list.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={page?.users.find((entry) => entry.id === post.authorId) || getAuthor(post.authorId)}
              compact
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
    </section>
  );
}
