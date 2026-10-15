/**
 * What the inline editors send for the three contact fields. Phone, @instagram
 * and @telegram go through `lead_save_fields` like every other card field: the
 * database whitelist (`fn_lead_apply_fields`) accepts them, refuses a phone
 * that is not a phone (`phone_invalid`), lower-cases a handle and strips its @.
 * The cleaning here only makes the optimistic value match what will be stored.
 */

/** "@Name " -> "name"; empty -> null. */
export function cleanHandle(value: string): string | null {
  const v = value.trim().replace(/^@+/, '').toLowerCase();
  return v === '' ? null : v;
}

/** Empty -> null; the database decides whether what is left is a phone number. */
export function cleanPhone(value: string): string | null {
  const v = value.trim();
  return v === '' ? null : v;
}
