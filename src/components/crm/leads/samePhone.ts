import type { CreateLeadData, Lead } from '@/contexts/LeadsContext';

/**
 * A new lead whose number is already in the list.
 *
 * Instagram and Telegram make a lead by themselves the moment someone writes
 * their number. An operator who then fills the form from scratch ("Yangi
 * lid") made a second record of the same person: in the week of 9 November
 * 2026, 8 of the 15 leads added by hand had a number that was already there.
 * The two halves then drift apart — the chat on one, the answers on the
 * other — and the person is counted twice.
 */

/** What two spellings of a number share: its last nine digits. */
export const phoneMatchKey = (phone: string | null | undefined): string | null => {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
};

/** The leads already in the list with this number, newest first. */
export function leadsWithSamePhone(leads: Lead[], phone: string | null | undefined, max = 3): Lead[] {
  const key = phoneMatchKey(phone);
  if (!key) return [];
  return leads
    .filter((lead) => phoneMatchKey(lead.phone) === key)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, max);
}

const isEmpty = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * What the operator typed, as an update of the record that is already there:
 * only what was actually filled in (an empty field must not wipe what the
 * record holds), and a note added under the existing one rather than over it.
 */
export function typedIntoExisting(existing: Lead, typed: CreateLeadData): Partial<CreateLeadData> {
  const update: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(typed)) {
    if (isEmpty(value)) continue;
    update[field] = value;
  }
  const note = typeof typed.notes === 'string' ? typed.notes.trim() : '';
  const had = (existing.notes ?? '').trim();
  if (note && had && !had.includes(note)) update.notes = `${had}\n${note}`;
  else if (note && had) delete update.notes;
  return update as Partial<CreateLeadData>;
}
