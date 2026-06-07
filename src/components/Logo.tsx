import { cn } from '@/lib/utils';

/**
 * Hanguk brand mark — the single source of truth for the logo across the web app.
 *
 * Per the Hanguk Design System: one treatment everywhere — white 한 + "Hanguk"
 * wordmark on dark surfaces, navy on light. Lime is reserved for actions, never
 * the mark. Use this component instead of hand-rolling <img src="/logo.jpg">.
 *
 *  - variant="badge"    → crisp opaque rounded icon (white 한 + wordmark on Royal Blue).
 *                         Drop-in for avatars, headers, loading screens.
 *  - variant="wordmark" → transparent mark + wordmark. tone="dark" renders it white
 *                         (for navy/gradient surfaces); tone="light" renders it navy.
 *  - variant="glyph"    → just the white 한 glyph (transparent), for compact dark spots.
 */
export type LogoVariant = 'badge' | 'wordmark' | 'glyph';
export type LogoTone = 'light' | 'dark';

interface LogoProps {
  variant?: LogoVariant;
  tone?: LogoTone;
  className?: string;
  /** Accessible label; defaults to "Hanguk". Pass "" to mark decorative. */
  alt?: string;
}

export function Logo({
  variant = 'badge',
  tone = 'dark',
  className,
  alt = 'Hanguk',
}: LogoProps) {
  if (variant === 'glyph') {
    // White 한 glyph on transparent — already white, no recolor needed.
    return (
      <img
        src="/brand-glyph-white.png"
        alt={alt}
        className={cn('object-contain', className)}
        loading="eager"
        decoding="async"
      />
    );
  }

  if (variant === 'wordmark') {
    // Single transparent navy asset; invert to white on dark surfaces.
    return (
      <img
        src="/brand-mark.png"
        alt={alt}
        className={cn(
          'object-contain',
          tone === 'dark' && '[filter:brightness(0)_invert(1)]',
          className,
        )}
        loading="eager"
        decoding="async"
      />
    );
  }

  // badge — opaque rounded icon
  return (
    <img
      src="/icon-1024.png"
      alt={alt}
      className={cn('rounded-xl object-cover', className)}
      loading="eager"
      decoding="async"
    />
  );
}

export default Logo;
