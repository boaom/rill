import type { CSSProperties } from 'react';
import type { MediaRef } from '../types';

/** 单块配图：纯色块 + 自制几何小图标，**不渲染任何“占位”字样**。 */
export function Ph({ media, className = 'ph' }: { media: MediaRef; className?: string }) {
  return (
    <div
      className={className}
      style={{ '--hue': String(media.hue) } as CSSProperties}
      role="img"
      aria-label={media.alt}
      data-ratio={media.ratio}
      data-media-id={media.id}
    >
      <svg className="ph__glyph" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 17.5 9 10l4 5.5 2.5-3 5 5.5z" />
        <circle cx="16.5" cy="7" r="2" />
      </svg>
    </div>
  );
}

/** 图格：1/2/3/4/5–9 张的列数与比例由 CSS（.card__media[data-count]）决定。 */
export function MediaBlock({
  media,
  className,
  testid,
}: {
  media: MediaRef[];
  className?: string;
  testid?: string;
}) {
  if (media.length === 0) return null;
  return (
    <div className={className ?? 'card__media'} data-testid={testid} data-media-count={media.length} data-count={media.length}>
      {media.map((item) => (
        <Ph key={item.id} media={item} />
      ))}
    </div>
  );
}