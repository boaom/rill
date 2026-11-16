// src/probe.ts —— boot 探针（?probe=…），**仅供无头验收，不是产品功能**。
// 原因：--dump-dom 是一次性快照，不能点击；探针在首帧渲染前施加一次动作，
// 让「点赞 +1 / 发布后置顶 / 返回保留滚动位」这类交互也能被 DOM 断言。
// 规则（docs/spec.md §4.6）：
//   - 默认只改内存，不写 localStorage；加 &persist=1 才落盘（保证同一 URL 反复跑结果一致）
//     · 例外：probe=draft 必须落盘（AC-CP05 要求「不带探针重开仍回填」）
//   - data-probe-applied 原样回显 probe 的值（未识别的探针也回显，方便发现拼写错误）
//   - 探针在 UI 中不可达，也不出现在任何用户可见文案里

import { reducer } from './store';
import type { Action, AppState, FeedTab, MediaRef, ThemeMode } from './types';
import type { RouteName } from './router';

export const PROBE_REPLY_TEXT = 'PROBE-REPLY';
export const PROBE_COMPOSE_TEXT = 'PROBE-COMPOSE';
export const PROBE_ERROR_TEXT = 'PROBE-ERROR';
export const PROBE_DRAFT_TEXT = 'PROBE-DRAFT';
export const PROBE_TOPIC_TEXT = '#新话题#PROBE-TOPIC';

const PROBE_MEDIA: MediaRef = {
  id: 'm_probe_1',
  hue: 202,
  ratio: 'wide',
  alt: '山与云',
};

export interface ProbePlan {
  /** 原样回显到 #app[data-probe-applied]；无探针时为空串 */
  raw: string;
  /** 首帧前要施加的 reducer 动作（顺序执行） */
  actions: Action[];
  /** &persist=1 */
  persist: boolean;
  /** probe=scroll:<px> */
  scrollTo: number | null;
  /** probe=empty */
  empty: boolean;
  /** probe=error */
  error: boolean;
  /** probe=refresh */
  refresh: boolean;
  /** probe=feed:following|recommend */
  feed: FeedTab | null;
  /** probe=topic / draft / error(compose) 时的编辑器文本 */
  composeText: string | null;
  /** probe=topic 时的话题数覆盖值 */
  topicCount: number | null;
  /** probe=draft：必须落盘（AC-CP05） */
  draftProbe: boolean;
  /** probe=publish：发布成功要 replace 回时间线（AC-CP01） */
  publishes: boolean;
  /** false = 未识别的探针（仍回显） */
  recognized: boolean;
}

function emptyPlan(): ProbePlan {
  return {
    raw: '',
    actions: [],
    persist: false,
    scrollTo: null,
    empty: false,
    error: false,
    refresh: false,
    feed: null,
    composeText: null,
    topicCount: null,
    draftProbe: false,
    publishes: false,
    recognized: true,
  };
}

/**
 * @param query 路由 query（来自 #/…?probe=…，**不是** location.search）
 * @param routeName 当前路由，用于 probe=error 的按路由分义
 */
export function parseProbe(query: Record<string, string>, routeName: RouteName): ProbePlan {
  const plan = emptyPlan();
  const raw = (query.probe ?? '').trim();
  plan.persist = query.persist === '1';
  if (!raw) return plan;

  plan.raw = raw;
  const colonAt = raw.indexOf(':');
  const kind = colonAt === -1 ? raw : raw.slice(0, colonAt);
  const arg = colonAt === -1 ? '' : raw.slice(colonAt + 1);

  switch (kind) {
    case 'like':
      if (arg) plan.actions.push({ type: 'like', postId: arg });
      break;
    case 'unlike':
      if (arg) plan.actions.push({ type: 'unlike', postId: arg });
      break;
    case 'repost':
      if (arg) plan.actions.push({ type: 'repost', postId: arg });
      break;
    case 'reply':
      if (arg) {
        plan.actions.push({
          type: 'reply',
          postId: arg,
          text: PROBE_REPLY_TEXT,
          replyToReplyId: null,
        });
      }
      break;
    case 'publish':
      plan.publishes = true;
      plan.actions.push({
        type: 'publish',
        text: PROBE_COMPOSE_TEXT,
        media: [PROBE_MEDIA],
        topics: [],
      });
      break;
    case 'scroll': {
      const px = Number.parseInt(arg, 10);
      if (Number.isFinite(px) && px >= 0) plan.scrollTo = px;
      break;
    }
    case 'empty':
      plan.empty = true;
      break;
    case 'error':
      plan.error = true;
      if (routeName === 'compose') {
        // 发博失败态：内容预填 PROBE-ERROR，且草稿不丢。
        plan.composeText = PROBE_ERROR_TEXT;
        plan.actions.push({ type: 'setDraft', text: PROBE_ERROR_TEXT });
      }
      break;
    case 'theme': {
      const theme: ThemeMode | null = arg === 'dark' ? 'dark' : arg === 'light' ? 'light' : null;
      if (theme) plan.actions.push({ type: 'setTheme', theme });
      break;
    }
    case 'feed':
      if (arg === 'following' || arg === 'recommend') plan.feed = arg;
      break;
    case 'refresh':
      plan.refresh = true;
      break;
    case 'topic':
      plan.composeText = PROBE_TOPIC_TEXT;
      plan.topicCount = 1;
      break;
    case 'draft':
      plan.composeText = PROBE_DRAFT_TEXT;
      plan.draftProbe = true;
      plan.actions.push({ type: 'setDraft', text: PROBE_DRAFT_TEXT });
      break;
    default:
      plan.recognized = false;
      break;
  }

  return plan;
}

/** 首帧前把探针动作一次性施加到初始状态（走同一个 reducer，保证与真实交互同源）。 */
export function applyProbe(state: AppState, plan: ProbePlan): AppState {
  return plan.actions.reduce((acc, action) => reducer(acc, action), state);
}