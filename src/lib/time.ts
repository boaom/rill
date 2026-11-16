/** 相对时间：以 mock 的 BASE 为“现在”（不使用 Date.now，保证两次刷新一致）。 */
export const NOW = 1794801600000;

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function formatRelative(createdAt: number, now: number = NOW): string {
  const diff = now - createdAt;
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return formatDate(createdAt);
}

/** YYYY-MM-DD（按 UTC+8 取日期，避免本机时区影响）。 */
export function formatDate(createdAt: number): string {
  return new Date(createdAt + 8 * HOUR).toISOString().slice(0, 10);
}

export function isoTime(createdAt: number): string {
  return new Date(createdAt).toISOString();
}

export function remainingCount(length: number, max: number): string {
  return `${length}/${max}`;
}