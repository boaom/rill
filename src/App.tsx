// src/App.tsx —— 全局外壳：hash 路由 + boot 探针 + 自观测属性 + tabbar + 设置 sheet + toast。
// 四页实现在 src/pages/*，数据全部来自 store（useReducer 单一真源）。

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Toast } from './components/Toast';
import { AccountChip } from './components/AccountChip';
import { SettingsSheet } from './components/SettingsSheet';
import { Tabbar } from './components/Tabbar';
import {
  applyProbe,
  parseProbe,
  PROBE_DRAFT_TEXT,
  PROBE_ERROR_TEXT,
  type ProbePlan,
} from './probe';
import {
  activeTabOf,
  feedTabFromQuery,
  navigate,
  parseLocation,
  profileTabFromQuery,
  replaceRoute,
  routeTitle,
  scrollKeyFor,
  type RouteLocation,
} from './router';
import { getRuntimeErrorCount, installRuntimeErrorTracking, subscribeRuntimeErrors } from './runtime';
import { TimelinePage } from './pages/Timeline';
import { DetailPage } from './pages/Detail';
import { ComposePage } from './pages/Compose';
import { ProfilePage } from './pages/Profile';
import { OnlineTimelinePage } from './pages/OnlineTimeline';
import { OnlineDetailPage } from './pages/OnlineDetail';
import { OnlineProfilePage } from './pages/OnlineProfile';
import { SearchPage } from './pages/Search';
import { LoginPage } from './auth/LoginPage';
import {
  canPublish,
  countTopicsInText,
  createInitialState,
  findPost,
  nextPostId,
  persistState,
  profilePostsFor,
  reducer,
  replyCountOf,
  StoreProvider,
  timelineFor,
  topicsFromText,
} from './store';
import { clearAll, KEYS, readNumber, readString, writeNumber, writeString } from './storage';
import type { AppState, Author, FeedTab, MediaRef, Post, ProfileTab } from './types';
import { getBootstrap, logout as logoutApi, newIdempotencyKey, publishStatus, writeErrorMessage, type ApiMode, type ConfigInfo, type SessionInfo } from './data/api';

const PAGE_SIZE = 20;
const PAGE_STEP = 10;
const MEDIA_HUES = [202, 168, 24, 268, 96, 330, 48, 196, 312];

function authorFromSession(session: SessionInfo | null): Author {
  const uid = session?.user?.uid ?? '';
  const name = session?.user?.screenName || '我';
  return {
    id: uid ? `u${String(uid).replace(/^u/, '')}` : 'u_me',
    nickname: name,
    handle: uid ? `u${String(uid).replace(/^u/, '')}` : 'me',
    avatarText: Array.from(name).slice(0, 2).join('') || '我',
    avatarHue: 168,
    bio: '',
    followingCount: 0,
    followerCount: 0,
    postCount: 0,
    isCurrentUser: true,
  };
}

function initState(plan: ProbePlan): AppState {
  return applyProbe(createInitialState({ empty: plan.empty }), plan);
}

interface NetworkState {
  mode: ApiMode;
  session: SessionInfo | null;
  config: ConfigInfo | null;
  loaded: boolean;
}

export default function App() {
  // ---- boot：先解析路由，再解析探针（probe=error 的语义依赖路由） ----
  const boot = useMemo(() => parseLocation(window.location.hash), []);
  const plan = useMemo(() => parseProbe(boot.location.query, boot.location.name), [boot]);

  const [state, dispatch] = useReducer(reducer, plan, initState);
  const [location, setLocation] = useState<RouteLocation>(boot.location);
  const [feedTab, setFeedTab] = useState<FeedTab>(
    () => plan.feed ?? feedTabFromQuery(boot.location.query) ?? 'recommend',
  );
  const [profileTab, setProfileTab] = useState<ProfileTab>(
    () => profileTabFromQuery(boot.location.query) ?? 'posts',
  );
  const [visibleLimit, setVisibleLimit] = useState(() => {
    const bootInserts = plan.actions.filter((action) => action.type === 'publish' || action.type === 'repost').length;
    return PAGE_SIZE + bootInserts;
  });
  const [refreshCount, setRefreshCount] = useState(plan.refresh ? 1 : 0);
  const [refreshing, setRefreshing] = useState(false);
  const [composeText, setComposeText] = useState(() => plan.composeText ?? readString(KEYS.draft, ''));
  const [composeMedia, setComposeMedia] = useState<MediaRef[]>([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [freshPostId, setFreshPostId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const publishKeyRef = useRef<string | null>(null);
  const [publishError, setPublishError] = useState('');
  const [freshOnlinePost, setFreshOnlinePost] = useState<Post | null>(null);
  const [freshOnlineAuthor, setFreshOnlineAuthor] = useState<Author | null>(null);
  const [scrollRestored, setScrollRestored] = useState(0);
  const [net, setNet] = useState<NetworkState>({ mode: 'offline', session: null, config: null, loaded: false });

  const toastSeq = useRef(0);
  const toastTimer = useRef(0);
  const mediaSeq = useRef(0);
  const refreshTimer = useRef(0);

  const runtimeErrors = useSyncExternalStore(
    subscribeRuntimeErrors,
    getRuntimeErrorCount,
    () => 0,
  );

  const showToast = useCallback((text: string, duration = 2000) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
    window.clearTimeout(refreshTimer.current);
  }, []);

  useEffect(() => {
    installRuntimeErrorTracking();
  }, []);

  useEffect(() => {
    let alive = true;
    getBootstrap()
      .then((info) => {
        if (!alive) return;
        setNet({ mode: info.mode, session: info.session, config: info.config, loaded: true });
      })
      .catch(() => {
        if (alive) setNet((prev) => ({ ...prev, loaded: true }));
      });
    return () => {
      alive = false;
    };
  }, []);

  // ---- hash 路由 ----
  useEffect(() => {
    const sync = () => setLocation(parseLocation(window.location.hash).location);
    window.addEventListener('hashchange', sync);
    sync();
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    const parsed = parseLocation(window.location.hash);
    if (parsed.canonicalHash !== window.location.hash) {
      window.history.replaceState(null, '', parsed.canonicalHash);
      setLocation(parsed.location);
    }
  }, [location.hash]);

  // ---- 发布成功（含 probe=publish）→ replaceState 回时间线 ----
  useEffect(() => {
    if (!plan.publishes) return;
    replaceRoute('#/timeline');
    setLocation(parseLocation('#/timeline').location);
  }, [plan]);

  // ---- 段选随 query 同步 ----
  useEffect(() => {
    const fromQuery = feedTabFromQuery(location.query);
    if (fromQuery) setFeedTab(fromQuery);
    const tab = profileTabFromQuery(location.query);
    if (tab) setProfileTab(tab);
  }, [location.hash, location.query]);

  // ---- 主题：html[data-theme] + html.theme-dark 同一套变量 ----
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    document.documentElement.classList.toggle('theme-dark', state.theme === 'dark');
    document.documentElement.style.colorScheme = state.theme;
  }, [state.theme]);

  useEffect(() => {
    document.title = `${routeTitle(location.name)} · 溪流`;
  }, [location.name]);

  // ---- 滚动位：进入页面恢复，离开时节流写回 ----
  useEffect(() => {
    try {
      window.history.scrollRestoration = 'manual';
    } catch {
      /* 忽略 */
    }
  }, []);

  const scrollKey = scrollKeyFor(location, feedTab, profileTab);

  useLayoutEffect(() => {
    let value = 0;
    if (plan.scrollTo !== null) {
      value = plan.scrollTo;
      if (plan.persist) writeNumber(KEYS.scroll(scrollKey), value);
    } else {
      value = readNumber(KEYS.scroll(scrollKey), 0);
    }
    setScrollRestored(value);
    if (value > 0) {
      try {
        window.scrollTo(0, value);
      } catch {
        /* 不影响渲染 */
      }
    }
  }, [scrollKey, plan]);

  useEffect(() => {
    let timer = 0;
    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 300);
    const onScroll = () => {
      if (!armed || timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        const y = window.scrollY;
        if (y > 0) writeNumber(KEYS.scroll(scrollKey), y);
      }, 200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(arm);
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [scrollKey]);

  // ---- 持久化：探针默认只改内存；&persist=1 或没有探针时才落盘 ----
  useEffect(() => {
    if (plan.persist || plan.raw === '') persistState(state);
    if (plan.draftProbe) writeString(KEYS.draft, PROBE_DRAFT_TEXT);
    if (plan.error && location.name === 'compose') writeString(KEYS.draft, PROBE_ERROR_TEXT);
  }, [state, plan, location.name]);

  // 主题是用户偏好：只要变了就落盘（探针/交互都算）。
  useEffect(() => {
    writeString(KEYS.theme, state.theme);
  }, [state.theme]);

  // 草稿：输入节流 250ms；清空则删除。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (composeText.trim()) {
        writeString(KEYS.draft, composeText);
        setDraftSaved(true);
      } else {
        writeString(KEYS.draft, '');
        setDraftSaved(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [composeText]);

  // ---- 导航 ----
  const go = useCallback((hash: string) => {
    navigate(hash);
    setLocation(parseLocation(`#${hash.replace(/^#/, '')}`).location);
  }, []);

  const goReplace = useCallback((hash: string) => {
    replaceRoute(hash);
    setLocation(parseLocation(`#${hash.replace(/^#/, '')}`).location);
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else goReplace('#/timeline');
  }, [goReplace]);

  const online = net.mode === 'online';
  const openLogin = useCallback(() => go('#/login'), [go]);
  const handleLogin = useCallback((session: SessionInfo) => {
    setNet((prev) => ({
      ...prev,
      session,
      mode: prev.config?.provider === 'weibo' && (session.authenticated || session.hasSession)
        ? 'online'
        : 'offline',
    }));
  }, []);
  const handleLogout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      /* 本地会话已清不掉时也继续刷新 UI；服务端下次启动会清理过期行。 */
    }
    try {
      const info = await getBootstrap();
      setNet({ mode: info.mode, session: info.session, config: info.config, loaded: true });
    } catch {
      setNet((prev) => ({ ...prev, session: null, mode: 'offline' }));
    }
    showToast('已退出登录');
    goReplace('#/timeline');
  }, [goReplace, showToast]);
  const accountChip = (
    <AccountChip online={online} session={net.session} onLogin={openLogin} onLogout={() => void handleLogout()} />
  );

  // ---- 交互 ----
  const openPost = useCallback((postId: string) => {
    if (location.name === 'status') goReplace(`#/status/${postId}`);
    else go(`#/status/${postId}`);
  }, [go, goReplace, location.name]);

  const likePost = useCallback((postId: string) => {
    if (state.likedIds.includes(postId)) {
      dispatch({ type: 'unlike', postId });
      return;
    }
    dispatch({ type: 'like', postId });
    showToast('已赞');
  }, [state.likedIds, showToast]);

  const repostPost = useCallback((postId: string) => {
    if (state.repostedIds.includes(postId)) {
      showToast('已转发过');
      return;
    }
    if (!findPost(state, postId)) return;
    dispatch({ type: 'repost', postId });
    setVisibleLimit((limit) => limit + 1);
    showToast('已转发');
  }, [state, showToast]);

  const openReply = useCallback((postId: string) => {
    go(`#/status/${postId}?reply=1`);
  }, [go]);

  const sendReply = useCallback((postId: string, text: string, replyToReplyId: string | null) => {
    dispatch({ type: 'reply', postId, text, replyToReplyId });
    showToast('已回复');
  }, [showToast]);

  const refresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    setVisibleLimit(PAGE_SIZE);
    setRefreshCount((count) => count + 1);
    showToast('已刷新');
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 240);
  }, [refreshing, showToast]);

  const loadMore = useCallback(() => {
    setVisibleLimit((limit) => limit + PAGE_STEP);
  }, []);

  const changeFeed = useCallback((tab: FeedTab) => {
    setFeedTab(tab);
    setVisibleLimit(PAGE_SIZE);
  }, []);

  const addMedia = useCallback(() => {
    publishKeyRef.current = null;
    setPublishError('');
    mediaSeq.current += 1;
    const index = (mediaSeq.current - 1) % MEDIA_HUES.length;
    const media: MediaRef = {
      id: `m_new_${mediaSeq.current}`,
      hue: MEDIA_HUES[index],
      ratio: 'square',
      alt: '配图',
    };
    setComposeMedia((list) => [...list, media].slice(0, 9));
  }, []);

  const removeMedia = useCallback((mediaId: string) => {
    publishKeyRef.current = null;
    setPublishError('');
    setComposeMedia((list) => list.filter((item) => item.id !== mediaId));
  }, []);

  const notice = useCallback((kind: 'media' | 'topic') => {
    showToast(kind === 'media' ? '最多 9 张' : '最多 3 个话题');
  }, [showToast]);

  const publish = useCallback(async () => {
    const text = composeText.trim();
    if (!canPublish(text, composeMedia) || publishingRef.current) return;
    if (online) {
      publishingRef.current = true;
      setPublishing(true);
      setPublishError('');
      const key = publishKeyRef.current || newIdempotencyKey();
      publishKeyRef.current = key;
      try {
        const result = await publishStatus(text, composeMedia, key);
        setComposeText('');
        setComposeMedia([]);
        setDraftSaved(false);
        writeString(KEYS.draft, '');
        setFreshOnlinePost(result.post);
        setFreshOnlineAuthor(authorFromSession(net.session));
        publishKeyRef.current = null;
        goReplace('#/timeline');
        showToast(result.notice || (result.pending ? '已发布（待同步）' : '已发布'), 2600);
      } catch (reason) {
        setPublishError(writeErrorMessage(reason));
      } finally {
        publishingRef.current = false;
        setPublishing(false);
      }
      return;
    }
    const postId = nextPostId(state);
    dispatch({ type: 'publish', text, media: composeMedia, topics: topicsFromText(text) });
    setComposeText('');
    setComposeMedia([]);
    setDraftSaved(false);
    writeString(KEYS.draft, '');
    goReplace('#/timeline');
    setVisibleLimit((limit) => limit + 1);
    setFreshPostId(postId);
    showToast('已发布', 2200);
  }, [composeMedia, composeText, goReplace, net.session, online, showToast, state]);

  const toggleTheme = useCallback(() => {
    dispatch({ type: 'setTheme', theme: state.theme === 'dark' ? 'light' : 'dark' });
  }, [state.theme]);

  const reset = useCallback(() => {
    clearAll();
    dispatch({ type: 'reset' });
    setComposeText('');
    setComposeMedia([]);
    setDraftSaved(false);
    setVisibleLimit(PAGE_SIZE);
    setRefreshCount(0);
    setFeedTab('recommend');
    setProfileTab('posts');
    setErrorDismissed(true);
    setFreshPostId(null);
    setSettingsOpen(false);
    showToast('已恢复初始数据');
  }, [showToast]);

  useEffect(() => {
    if (!freshPostId) return;
    const timer = window.setTimeout(() => setFreshPostId(null), 1000);
    return () => window.clearTimeout(timer);
  }, [freshPostId]);

  // ---- 派生值（data-* 自观测属性） ----
  const timelineAll = timelineFor(state, feedTab);
  const visiblePosts = timelineAll.slice(0, visibleLimit);
  const profileList = profilePostsFor(state, profileTab);
  const detailPost = location.name === 'status' && location.id ? findPost(state, location.id) : undefined;
  const errorActive = plan.error && !errorDismissed;
  const statusId = location.name === 'status' ? (location.id ?? '') : '';
  const activeTab = settingsOpen ? 'settings' : activeTabOf(location.name);

  const postCount = errorActive
    ? 0
    : location.name === 'timeline'
      ? visiblePosts.length
      : location.name === 'me'
        ? profileList.length
        : 0;
  const replyCount = detailPost ? replyCountOf(state, detailPost.id) : 0;
  const topicCount = countTopicsInText(composeText);

  const page = (() => {
    switch (location.name) {
      case 'timeline':
        return online ? (
          <OnlineTimelinePage
            feedTab={feedTab}
            onFeedTab={changeFeed}
            session={net.session}
            onLogin={openLogin}
            onLogout={() => void handleLogout()}
            onOpen={openPost}
            onToast={showToast}
            freshPost={freshOnlinePost}
            freshAuthor={freshOnlineAuthor}
          />
        ) : (
          <TimelinePage
            feedTab={feedTab}
            onFeedTab={changeFeed}
            visibleCount={visibleLimit}
            onLoadMore={loadMore}
            refreshCount={refreshCount}
            refreshing={refreshing}
            onRefresh={refresh}
            error={errorActive}
            onRetry={() => setErrorDismissed(true)}
            onOpen={openPost}
            onLike={likePost}
            onRepost={repostPost}
            onReply={openReply}
            onCompose={() => go('#/compose')}
            freshPostId={freshPostId}
            account={accountChip}
          />
        );
      case 'status':
        return online ? (
          <OnlineDetailPage
            postId={location.id ?? ''}
            onLogin={openLogin}
            onBack={goBack}
            onTimeline={() => go('#/timeline')}
            onToast={showToast}
          />
        ) : (
          <DetailPage
            postId={location.id ?? ''}
            error={errorActive}
            onRetry={() => setErrorDismissed(true)}
            onLike={likePost}
            onRepost={repostPost}
            onSendReply={sendReply}
            onOpen={openPost}
            onBack={goBack}
            onTimeline={() => go('#/timeline')}
            focusReply={location.query.reply === '1'}
          />
        );
      case 'compose':
        return (
          <ComposePage
            text={composeText}
            media={composeMedia}
            onText={(value) => { setComposeText(value); setPublishError(''); publishKeyRef.current = null; }}
            onAddMedia={addMedia}
            onRemoveMedia={removeMedia}
            onNotice={notice}
            onPublish={() => void publish()}
            onCancel={goBack}
            error={plan.error}
            draftSaved={draftSaved}
            online={online}
            publishing={publishing}
            publishError={publishError}
            onlineNote={online ? '在线发博：当前版本没有真实图片文件输入；图片占位会降级为纯文本，并会在结果里说明。' : ''}
          />
        );
      case 'me':
        return online ? (
          <OnlineProfilePage
            tab={profileTab}
            onTab={setProfileTab}
            session={net.session}
            onLogin={openLogin}
            onLogout={() => void handleLogout()}
            onOpen={openPost}
            onToast={showToast}
          />
        ) : (
          <ProfilePage
            tab={profileTab}
            onTab={setProfileTab}
            error={errorActive}
            onRetry={() => setErrorDismissed(true)}
            onOpen={openPost}
            onLike={likePost}
            onRepost={repostPost}
            onReply={openReply}
            onCompose={() => go('#/compose')}
            account={accountChip}
          />
        );
      case 'login':
        return (
          <LoginPage
            online={online}
            onDone={handleLogin}
            onBack={() => goReplace('#/timeline')}
          />
        );
      case 'search':
        return (
          <SearchPage
            online={online}
            session={net.session}
            onLogin={openLogin}
            onLogout={() => void handleLogout()}
            onOpen={openPost}
            onToast={showToast}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div
      id="app"
      className="rill-app"
      data-route={location.name}
      data-active-tab={activeTab}
      data-theme={state.theme}
      data-post-count={postCount}
      data-reply-count={replyCount}
      data-scroll-restored={scrollRestored}
      data-runtime-errors={runtimeErrors}
      data-probe-applied={plan.raw}
      data-refresh-count={refreshCount}
      data-compose-text={composeText}
      data-topics={topicCount}
      data-status-id={statusId}
    >
      <StoreProvider value={{ state, dispatch }}>
        <main className={`rill-main${location.name === 'compose' ? ' rill-main--compose' : ''}`}>{page}</main>
        <Tabbar active={activeTab} onOpenSettings={() => setSettingsOpen(true)} />
        <SettingsSheet
          open={settingsOpen}
          theme={state.theme}
          onToggleTheme={toggleTheme}
          onReset={reset}
          onClose={() => setSettingsOpen(false)}
          online={online}
          accountName={net.session?.user?.screenName ?? ''}
          onLogin={openLogin}
          onLogout={() => void handleLogout()}
        />
        <Toast toast={toast} />
      </StoreProvider>
    </div>
  );
}