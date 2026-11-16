import type { SVGProps } from 'react';

/** design.md §6.3 的 7 个自制图标：home / plus / user / settings / like / reply / repost。
 *  explore 与 bell 只在规范里留档，不进产物。全部 inline SVG，无图标库、无外部资源。 */
type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Frame({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...STROKE} {...rest}>
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.2v-5.1H9.2V20H5a1 1 0 0 1-1-1z" />
    </Frame>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M12 5v14M5 12h14" />
    </Frame>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M5 19.6c0-3.3 3.1-5.4 7-5.4s7 2.1 7 5.4" />
    </Frame>
  );
}

export function IconSettings({ size = 24, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...STROKE} {...rest}>
      <path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15" />
      <circle cx="9.5" cy="7.5" r="1.9" fill="var(--rill-surface)" />
      <circle cx="15" cy="12" r="1.9" fill="var(--rill-surface)" />
      <circle cx="10.5" cy="16.5" r="1.9" fill="var(--rill-surface)" />
    </svg>
  );
}

/** 心形：未赞描边，已赞实心（同一 path，只换 fill/stroke）。 */
export function IconLike({ filled = false, size = 18, className, ...rest }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M12 19.4S4.6 14.9 4.6 9.9A4 4 0 0 1 12 7.5a4 4 0 0 1 7.4 2.4c0 5-7.4 9.5-7.4 9.5z" />
    </svg>
  );
}

export function IconReply({ size = 18, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...STROKE} {...rest}>
      <path d="M20 12.3c0 3.6-3.6 6.4-8 6.4-1 0-2-.2-2.9-.5L5 20l1.1-3.4A6.3 6.3 0 0 1 4 12.3C4 8.7 7.6 6 12 6s8 2.7 8 6.3z" />
    </svg>
  );
}

export function IconRepost({ size = 18, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...STROKE} {...rest}>
      <path d="M6.5 8.5h10.6" />
      <path d="M14.2 5.4l3.2 3.1-3.2 3.1" />
      <path d="M17.5 15.5H6.9" />
      <path d="M9.8 12.4 6.6 15.5l3.2 3.1" />
    </svg>
  );
}