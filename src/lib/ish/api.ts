import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IshAppBusiness,
  IshAppBusinessInput,
  IshApplication,
  IshBoardRow,
  IshBusiness,
  IshBusinessInput,
  IshCandidate,
  IshJobInput,
  IshJobPage,
  IshMessage,
  IshReport,
  ReportStatus,
} from './types';

/** A refusal of the Hanguk Ish database with its stable code ('SHIFT_CLOSED', …). */
export class IshError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'IshError';
  }
}

/** The code of a failed call: the one the function raised, else by kind. */
export function ishErrorCode(error: { message?: string; code?: string; status?: number }): string {
  const text = (error.message ?? '').trim();
  if (/^[A-Z][A-Z0-9_]+$/.test(text)) return text;
  switch (error.code) {
    case '42501':
      return 'FORBIDDEN';
    case '23514':
    case '22P02':
    case '22023':
    case '22001':
    case '23502':
      return 'INVALID';
    case '28000':
    case 'PGRST301':
    case 'PGRST302':
      return 'NOT_AUTHENTICATED';
    default:
      break;
  }
  if (/failed to fetch|network|load failed/i.test(text)) return 'OFFLINE';
  return 'UNKNOWN';
}

/** The minutes a job lasts. */
export function plannedMinutes(job: { starts_at: string; ends_at: string }): number {
  return Math.round((Date.parse(job.ends_at) - Date.parse(job.starts_at)) / 60000);
}

/** Hanguk Ish's schema in hanguk.uz's Supabase project (P48). */
export const ISH_SCHEMA = 'ish';

/**
 * What hanguk.uz asks of Hanguk Ish, on [client] — hanguk.uz's own, signed in
 * as a staff member. Every call goes to the schema `ish` and through the
 * database's own checks (staff only, the employers they keep); a refusal
 * comes back as an [IshError].
 */
export function ishApi(client: SupabaseClient) {
  const db = client.schema(ISH_SCHEMA);

  async function rpc<T>(fn: string, params?: Record<string, unknown>): Promise<T> {
    const { data, error } = await db.rpc(fn, params);
    if (error) throw new IshError(ishErrorCode(error), error.message);
    return data as T;
  }

  return {
    isStaff: () => rpc<boolean>('is_staff'),

    businesses: async () => (await rpc<IshBusiness[] | null>('staff_businesses')) ?? [],

    saveBusiness: (b: IshBusinessInput) =>
      rpc<string>('staff_save_business', {
        p_business: b.id,
        p_name: b.name.trim(),
        p_category: b.category,
        p_area: b.area.trim(),
        p_address: b.address.trim(),
        p_address_detail: b.addressDetail.trim(),
        p_district: b.district,
        p_lat: b.lat,
        p_lng: b.lng,
        p_name_i18n: b.nameUz.trim() ? { uz: b.nameUz.trim() } : {},
        p_contact: {
          contact_name: b.contact.contact_name.trim(),
          phone: b.contact.phone.trim(),
          telegram: b.contact.telegram.trim(),
          source: b.contact.source.trim(),
          notes: b.contact.notes.trim(),
        },
      }),

    /** P52: the businesses the 사장님 app opened (no check, P50), newest first. */
    appBusinesses: async () => (await rpc<IshAppBusiness[] | null>('staff_app_businesses')) ?? [],

    /** The real name and place of an app business (it opens as «사업장 XXXX»). */
    updateAppBusiness: (b: IshAppBusinessInput) =>
      rpc<string>('staff_update_app_business', {
        p_business: b.id,
        p_name: b.name.trim(),
        p_category: b.category,
        p_area: b.area.trim(),
        p_address: b.address.trim(),
        p_address_detail: b.addressDetail.trim(),
        p_name_i18n: b.nameUz.trim() ? { uz: b.nameUz.trim() } : {},
      }),

    /** Suspend an app business (its shifts leave the feed, nobody applies) or let it back; the new status. */
    setAppBusinessBlocked: (id: string, blocked: boolean) =>
      rpc<string>('staff_set_app_business_blocked', { p_business: id, p_blocked: blocked }),

    /** P52: the workers' complaints from the app, open ones first. */
    reports: async () => (await rpc<IshReport[] | null>('staff_reports', { p_limit: 200 })) ?? [],

    /** Where a complaint stands: open, in_review, closed. */
    setReportStatus: (id: string, status: ReportStatus) =>
      rpc<string>('staff_set_report_status', { p_report: id, p_status: status }),

    /** Jobs starting in [from, to): the kept employers' and any with offers. */
    board: async (from: Date, to: Date) =>
      (await rpc<IshBoardRow[] | null>('staff_board', { p_from: from.toISOString(), p_to: to.toISOString() })) ?? [],

    job: (id: string) => rpc<IshJobPage>('staff_shift', { p_shift: id }),

    saveJob: (j: IshJobInput) =>
      rpc<string>('staff_save_shift', {
        p_shift: j.id,
        p_business: j.businessId,
        p_title: j.title.trim(),
        p_starts_at: j.startsAt,
        p_ends_at: j.endsAt,
        p_hourly_wage: j.hourlyWage,
        p_slots: j.slots,
        p_duties: j.duties.trim(),
        p_dress: j.dress.trim(),
        p_address: j.address.trim(),
        p_lat: null,
        p_lng: null,
        p_auto_confirm: j.autoConfirm,
        p_invite_only: j.inviteOnly,
        p_source: j.source.trim(),
        p_notes: j.notes.trim(),
      }),

    /** [maxKm] null: everyone, however far. */
    candidates: async (id: string, maxKm: number | null, limit = 100) =>
      (await rpc<IshCandidate[] | null>('staff_candidates', { p_shift: id, p_max_km: maxKm, p_limit: limit })) ?? [],

    /** How many offers went out (once per worker and job). */
    sendOffers: (id: string, workers: string[], note: string) =>
      rpc<number>('staff_send_offers', { p_shift: id, p_workers: workers, p_note: note.trim() }),

    /** 확정 or 거절 after the call with the employer (the 사장님 function). */
    decide: (applicationId: string, accept: boolean) =>
      rpc<IshApplication>('decide_application', { p_application: applicationId, p_accept: accept }),

    /** Came (worked [minutes]; the planned time when null) or did not come. */
    markAttendance: (applicationId: string, came: boolean, minutes: number | null = null) =>
      rpc<IshApplication>('staff_mark_attendance', {
        p_application: applicationId,
        p_came: came,
        p_worked_minutes: minutes,
      }),

    /** «To'landi»: every finished worker of the job paid (or not). */
    setPaid: (shiftId: string, paid: boolean) => rpc<number>('set_shift_paid', { p_shift: shiftId, p_paid: paid }),

    cancelJob: (shiftId: string) => rpc<unknown>('cancel_shift', { p_shift: shiftId }),

    /** The job's QR payload: the poster the employer puts up for check-in. */
    qr: (shiftId: string) => rpc<string>('shift_qr', { p_shift: shiftId }),

    messages: async (applicationId: string): Promise<IshMessage[]> => {
      const { data, error } = await db
        .from('messages')
        .select('id, application_id, sender_id, body, lang, translations, created_at')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw new IshError(ishErrorCode(error), error.message);
      return (data ?? []) as IshMessage[];
    },

    /**
     * Unread messages from the workers, by application: only what the worker
     * wrote and nobody has read yet (the staff's own messages wait for the
     * worker, A10).
     */
    unread: async (apps: { id: string; workerId: string }[]): Promise<Record<string, number>> => {
      if (apps.length === 0) return {};
      const { data, error } = await db
        .from('messages')
        .select('application_id, sender_id')
        .in('application_id', apps.map((a) => a.id))
        .is('read_at', null);
      if (error) throw new IshError(ishErrorCode(error), error.message);
      const workerOf = new Map(apps.map((a) => [a.id, a.workerId]));
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { application_id: string; sender_id: string }[]) {
        if (workerOf.get(row.application_id) === row.sender_id) {
          counts[row.application_id] = (counts[row.application_id] ?? 0) + 1;
        }
      }
      return counts;
    },

    /** The worker's messages in the chat are read now — only the worker's. */
    markRead: async (applicationId: string, workerId: string): Promise<void> => {
      const { error } = await db
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('application_id', applicationId)
        .eq('sender_id', workerId)
        .is('read_at', null);
      if (error) throw new IshError(ishErrorCode(error), error.message);
    },

    sendMessage: async (applicationId: string, body: string): Promise<IshMessage> => {
      const { data, error } = await db
        .from('messages')
        .insert({ application_id: applicationId, body: body.trim() })
        .select('id, application_id, sender_id, body, lang, translations, created_at')
        .single();
      if (error) throw new IshError(ishErrorCode(error), error.message);
      return data as IshMessage;
    },
  };
}

export type IshApi = ReturnType<typeof ishApi>;
