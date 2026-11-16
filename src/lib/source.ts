/**
 * 呈现层统一补「来自 」前缀：mock 已自带，在线 cleanText 结果通常不带。
 * 缺失/空值返回 null，由渲染点条件渲染为「节点不存在」；不要在这里编造来源。
 */
export function displaySource(source: string | null | undefined): string | null {
  const value = source?.trim();
  if (!value) return null;
  return value.startsWith('来自 ') ? value : `来自 ${value}`;
}
