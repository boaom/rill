import type { CSSProperties } from 'react';
import type { Author } from '../types';

/** 头像占位：无位图，hue + 1–2 字（design.md §5.5）。 */
export function Avatar({
  author,
  size = 'md',
  testid,
}: {
  author: Author;
  size?: 'sm' | 'md' | 'lg';
  testid?: string;
}) {
  const cls = size === 'sm' ? 'av av--sm' : size === 'lg' ? 'av av--lg' : 'av';
  return (
    <span
      className={cls}
      style={{ '--hue': String(author.avatarHue) } as CSSProperties}
      aria-hidden="true"
      data-testid={testid}
    >
      {author.avatarText}
    </span>
  );
}