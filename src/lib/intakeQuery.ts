/**
 * Centralized active-intake (season) scoping for Supabase reads.
 *
 * Every intake-specific table carries an `intake_id` column (see the
 * `add_intakes_and_intake_scope` migration). `applyIntake` is the single
 * choke point that appends `.eq('intake_id', …)` so no screen can forget it,
 * and `intakeKey` gives a stable fragment for react-query keys / effect deps.
 */

// A UUID that matches no real row. Used while the active intake is still
// resolving, so a query never leaks another season's data in the meantime.
export const NO_INTAKE_SENTINEL = '00000000-0000-0000-0000-000000000000';

type EqBuilder<T> = { eq(column: string, value: string): T };

/**
 * Scope a Supabase query builder to the active intake.
 *
 *   applyIntake(supabase.from('applications').select('*'), activeIntakeId)
 *
 * Returns the same builder type so the rest of the chain keeps working.
 */
export function applyIntake<T>(query: T, intakeId: string | null | undefined): T {
  return (query as unknown as EqBuilder<T>).eq('intake_id', intakeId ?? NO_INTAKE_SENTINEL);
}

/** Stable key fragment for react-query keys and useEffect dependency arrays. */
export const intakeKey = (intakeId: string | null | undefined): string => intakeId ?? 'no-intake';

/** `spring-2026` style slug used for URL + localStorage persistence. */
export const intakeSlug = (i: { season: string; year: number }): string => `${i.season}-${i.year}`;

export type Season = 'spring' | 'fall';

/** Parse a `spring-2026` slug; returns null if malformed. */
export function parseIntakeSlug(value: string | null | undefined): { season: Season; year: number } | null {
  if (!value) return null;
  const m = /^(spring|fall)-(\d{4})$/.exec(value.trim().toLowerCase());
  return m ? { season: m[1] as Season, year: Number(m[2]) } : null;
}
