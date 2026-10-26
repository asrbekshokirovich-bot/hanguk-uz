import type { TFunction } from 'i18next';
import { humanizeLineItem } from '@/lib/investorFormat';

/* ---------------------------------------------------------------------------
 * Labels for values that reach the portal from the database in English or as
 * slugs. The SQL is left alone; the UI turns each known value into an
 * investor.* i18n key, and anything unknown falls back to the old humanizer
 * (or the raw value), so a new slug never renders as a missing key.
 * ------------------------------------------------------------------------ */

/** "2027 bahor qabuli" from season + year. Falls back to the view's label. */
export function intakeLabel(
  t: TFunction,
  intake: { season?: string | null; year?: number | null; label?: string | null } | null | undefined,
): string {
  if (!intake) return '';
  if ((intake.season === 'spring' || intake.season === 'fall') && intake.year) {
    return t(`investor.season.${intake.season}`, { year: intake.year });
  }
  return intake.label ?? '';
}

/** Funnel stage by stage_order (0..6); the view's English name otherwise. */
export function stageLabel(t: TFunction, stageOrder: number, fallback: string): string {
  return t(`investor.stages.s${stageOrder}`, { defaultValue: fallback });
}

function slugKey(t: TFunction, group: string, slug: string | null | undefined, fallback: string) {
  if (!slug) return fallback;
  const key = slug.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return t(`investor.${group}.${key}`, { defaultValue: fallback });
}

/** P&L line items: plan slugs, discount_given, other. Unknown expense
 *  categories keep going through humanizeLineItem. */
export function lineItemLabel(t: TFunction, slug: string | null | undefined): string {
  if (!slug) return t('investor.lineItems.other');
  return slugKey(t, 'lineItems', slug, humanizeLineItem(slug));
}

/** Tariff on an application row (standart, premium, no_risk, free). */
export function planLabel(t: TFunction, plan: string | null | undefined): string | null {
  if (!plan) return null;
  return slugKey(t, 'lineItems', plan, humanizeLineItem(plan));
}

export function applicationStatusLabel(t: TFunction, status: string): string {
  return slugKey(t, 'applicationStatus', status, humanizeLineItem(status));
}

export function degreeLabel(t: TFunction, level: string): string {
  return slugKey(t, 'degree', level, humanizeLineItem(level));
}

export function payoutStatusLabel(t: TFunction, status: string): string {
  return slugKey(t, 'payoutStatus', status, humanizeLineItem(status));
}

export function staffRoleLabel(t: TFunction, role: string): string {
  return slugKey(t, 'roles', role, humanizeLineItem(role));
}

/** Lead source: a free-form CRM value. Known channels are translated, anything
 *  else is shown as written. */
export function leadSourceLabel(t: TFunction, source: string): string {
  return slugKey(t, 'sources', source, source);
}
