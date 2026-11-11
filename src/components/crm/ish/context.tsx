import { createContext, useContext, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { IshError, type IshApi } from '@/lib/ish/api';

const IshApiContext = createContext<IshApi | null>(null);

/** The Hanguk Ish calls of the signed-in staff member, for the section's parts. */
export function IshApiProvider({ api, children }: { api: IshApi; children: ReactNode }) {
  return <IshApiContext.Provider value={api}>{children}</IshApiContext.Provider>;
}

export function useIshApi(): IshApi {
  const api = useContext(IshApiContext);
  if (!api) throw new Error('useIshApi outside IshApiProvider');
  return api;
}

const KNOWN = new Set([
  'FORBIDDEN', 'NOT_FOUND', 'INVALID', 'INVALID_TIME', 'TOO_LONG', 'IN_THE_PAST', 'WAGE_BELOW_MINIMUM',
  'HAS_CREW', 'SLOTS_BELOW_CREW', 'SHIFT_CLOSED', 'SHIFT_ENDED', 'SHIFT_FULL', 'NOT_PENDING', 'TOO_EARLY',
  'NOT_CONFIRMED', 'ALREADY_CHECKED_IN', 'BUSINESS_NOT_VERIFIED', 'NOT_AUTHENTICATED', 'OFFLINE',
]);

/** What to tell the staff member when a call is refused or fails. */
export function ishErrorText(t: TFunction, error: unknown): string {
  const code = error instanceof IshError ? error.code : 'UNKNOWN';
  return t(`ish.errors.${KNOWN.has(code) ? code : 'UNKNOWN'}`);
}

/** Query keys of the section (all under 'ish'). */
export const ishKeys = {
  all: ['ish'] as const,
  staff: ['ish', 'staff'] as const,
  board: (from: string) => ['ish', 'board', from] as const,
  businesses: ['ish', 'businesses'] as const,
  job: (id: string) => ['ish', 'job', id] as const,
  candidates: (id: string, km: number | null) => ['ish', 'candidates', id, km] as const,
  messages: (applicationId: string) => ['ish', 'messages', applicationId] as const,
};
