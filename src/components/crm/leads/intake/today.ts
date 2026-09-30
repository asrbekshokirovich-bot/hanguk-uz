import type { Lead } from '@/contexts/LeadsContext';
import { isNewLead } from './sla';

/**
 * "Bugungi lidlar": the leads that arrived today (Tashkent), between
 * "Yangi lid" and "Lidlar". A lead waits in "Yangi lid" until it is answered,
 * sits here for the rest of its day, and moves to "Lidlar" at 00:00.
 *
 * A lead arrives when it becomes a lead: for an Instagram/Telegram chat that is
 * the moment its phone number came (`new_lead_at`), for any other lead the
 * moment it was created.
 */
const TASHKENT_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "2026-09-30" — the calendar day in Tashkent. */
export const tashkentDay = (date: Date): string => TASHKENT_DAY.format(date);

/** True for a lead that arrived today, whether or not it is still in "Yangi lid". */
export const arrivedToday = (lead: Lead, now: Date): boolean =>
  tashkentDay(new Date(lead.new_lead_at ?? lead.created_at)) === tashkentDay(now);

/** A lead of "Bugungi lidlar": arrived today and no longer in "Yangi lid". */
export const isTodayLead = (lead: Lead, now: Date): boolean =>
  arrivedToday(lead, now) && !isNewLead(lead);
