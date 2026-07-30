import React from 'react';

/**
 * Shared screen header. Title left, one sentence of context under it, and a
 * single action slot on the right - which is where the one lime action per view
 * belongs, when a view has one.
 */
export function InvestorScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {/* TOKENS.md page title: 30px / 800 / -0.03em / line-height 1.1. */}
        <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
