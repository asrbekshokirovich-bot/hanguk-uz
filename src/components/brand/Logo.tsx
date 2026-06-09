import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

/**
 * Hanguk brand mark — the single, theme-aware source of truth for the logo
 * across the web app (Hanguk Design System · logo-guide).
 *
 * One mark, used correctly on every surface:
 *   • light surfaces  → navy 한 glyph  (brand-glyph-navy.png)
 *   • dark / navy / gradient surfaces → white 한 glyph (brand-glyph-white.png)
 *
 * The wordmark is rendered as live text ("Hanguk", font-bold tracking-tight)
 * so it recolours with the theme, stays crisp at any size, and never shows a
 * doubled "Hanguk Hanguk". The raster (logo.jpg / icon-1024.png) is reserved
 * for favicon / OG only — never inside the UI.
 *
 *   - variant="lockup" (default) → glyph + "Hanguk" CSS wordmark.
 *   - variant="glyph"            → just the 한 glyph (square), for compact spots,
 *                                  splash screens and empty-state heroes.
 *
 * Theme is read from next-themes. On fixed-navy surfaces (sidebar, auth panel,
 * gradients) pass `onDark` to force the white treatment regardless of theme.
 */
export type LogoVariant = 'lockup' | 'glyph';

interface LogoProps {
  variant?: LogoVariant;
  /** Force the white-on-dark treatment for fixed navy/gradient surfaces. */
  onDark?: boolean;
  /** Sizes the glyph height (e.g. "h-9 w-9" for glyph, "h-9" for lockup). */
  className?: string;
  /** Accessible label; defaults to "Hanguk Consulting". Pass "" if decorative. */
  alt?: string;
}

export function Logo({
  variant = 'lockup',
  onDark = false,
  className,
  alt = 'Hanguk Consulting',
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const isDark = onDark || resolvedTheme === 'dark';
  const glyphSrc = isDark ? '/brand-glyph-white.png' : '/brand-glyph-navy.png';

  if (variant === 'glyph') {
    return (
      <img
        src={glyphSrc}
        alt={alt}
        className={cn('object-contain', className)}
        loading="eager"
        decoding="async"
      />
    );
  }

  // lockup — transparent glyph + live CSS wordmark (themeable, single word).
  // The glyph is decorative here; the visible "Hanguk" text is the accessible name.
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label={alt || undefined}>
      <img
        src={glyphSrc}
        alt=""
        aria-hidden="true"
        className="h-full w-auto object-contain"
        loading="eager"
        decoding="async"
      />
      <span
        className={cn(
          'text-lg font-bold leading-none tracking-tight',
          isDark ? 'text-white' : 'text-foreground',
        )}
      >
        Hanguk
      </span>
    </span>
  );
}

export default Logo;
