/** 认证标记：昵称右侧 3px、13×13，颜色跟随昵称（A 定稿：不得用黄色/品牌色）。 */
export function VerifiedMark({ verified }: { verified?: boolean }) {
  if (verified !== true) return null;
  return (
    <span className="vm" data-verified="true" aria-label="已认证" title="已认证">
      ✓
    </span>
  );
}