import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IshAppBusiness,
  IshAppBusinessInput,
  IshApplication,
  IshBoardRow,
  IshBusiness,
  IshBusinessInput,
  IshCandidate,
  IshCoinWorker,
  IshJobInput,
  IshJobPage,
  IshMessage,
  IshMonthlyInterest,
  IshMonthlyJob,
  IshMonthlyJobInput,
  IshCard,
  IshFreeDay,
  IshFreeWorker,
  IshMonthlyHire,
  IshPaymentDetails,
  IshPyolDay,
  IshTopup,
  IshReport,
  IshStaffPeople,
  IshStaffRole,
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

    /** Coins: workers by name or phone (all, newest first, when empty), with their balance. */
    coinWorkers: async (query: string) =>
      (await rpc<IshCoinWorker[] | null>('staff_coin_workers', { p_query: query.trim(), p_limit: 50 })) ?? [],

    /** Adds coins to a worker (negative: takes some back); the new balance. NO_COINS below zero. */
    addCoins: (workerId: string, delta: number, note: string) =>
      rpc<number>('staff_add_coins', { p_worker: workerId, p_delta: delta, p_note: note.trim() }),

    /** Top-up requests (pending by default; null: all). */
    topups: async (status: 'pending' | 'approved' | 'rejected' | null = 'pending') =>
      (await rpc<IshTopup[] | null>('staff_topups', { p_status: status })) ?? [],

    /** The money came: the puyl go to the worker. ALREADY_DECIDED twice. */
    approveTopup: (id: string) => rpc<number>('staff_approve_topup', { p_request: id }),

    rejectTopup: (id: string, note: string) =>
      rpc<void>('staff_reject_topup', { p_request: id, p_note: note.trim() }),

    paymentDetails: () => rpc<IshPaymentDetails>('payment_details'),

    /** Where workers send the money: 'bank' / 'kakaopay' / 'toss' / 'note'. */
    setPaymentSetting: (key: 'bank' | 'kakaopay' | 'toss' | 'note', value: string) =>
      rpc<void>('staff_set_payment_setting', { p_key: key, p_value: value.trim() }),

    /** «My free days» of the workers: how many, by day and place. */
    freeDays: async (days = 7) => (await rpc<IshFreeDay[] | null>('staff_free_dates_summary', { p_days: days })) ?? [],

    /** Who is free on [day] (yyyy-mm-dd), optionally in [district]. */
    freeWorkers: async (day: string, district: string | null) =>
      (await rpc<IshFreeWorker[] | null>('staff_free_workers', {
        p_day: day,
        p_district: district && district.trim() !== '' ? district.trim() : null,
      })) ?? [],

    /** Everyone with a yellow / red card now. */
    cards: async () => (await rpc<IshCard[] | null>('staff_cards')) ?? [],

    /** A card for a business («worse than promised», …); a reason is needed. */
    giveBusinessCard: (businessId: string, note: string) =>
      rpc<unknown>('staff_give_business_card', { p_business: businessId, p_note: note.trim() }),

    /** Take a card back (given by mistake, …); a reason is needed. */
    clearCard: (subjectId: string, note: string) =>
      rpc<unknown>('staff_clear_card', { p_subject: subjectId, p_note: note.trim() }),

    pyolReport: async (days = 30) => (await rpc<IshPyolDay[] | null>('staff_pyol_report', { p_days: days })) ?? [],

    monthlyHires: async () => (await rpc<IshMonthlyHire[] | null>('staff_monthly_hires')) ?? [],

    markHired: (jobId: string, workerId: string) =>
      rpc<string>('staff_mark_hired', { p_job: jobId, p_worker: workerId }),

    /** Two weeks after the start: still working (the fee is due) or not. NOT_DUE before. */
    confirmTwoWeeks: (hireId: string, stillWorking: boolean) =>
      rpc<void>('staff_confirm_two_weeks', { p_hire: hireId, p_still_working: stillWorking }),

    markFeePaid: (hireId: string) => rpc<void>('staff_mark_fee_paid', { p_hire: hireId }),

    /** P52: the workers' complaints from the app, open ones first. */
    reports: async () => (await rpc<IshReport[] | null>('staff_reports', { p_limit: 200 })) ?? [],

    /** Where a complaint stands: open, in_review, closed. */
    setReportStatus: (id: string, status: ReportStatus) =>
      rpc<string>('staff_set_report_status', { p_report: id, p_status: status }),

    /** P58: whether the signed-in staff member keeps the staff list (a Hanguk Ish admin). */
    isStaffAdmin: () => rpc<boolean>('is_staff_admin'),

    /** The staff (admins first) and the hanguk.uz CRM people who could be added. */
    staffPeople: async () => (await rpc<IshStaffPeople | null>('staff_people')) ?? { staff: [], candidates: [] },

    /** Puts a CRM account on the staff list (already on it: only its role changes). */
    addStaff: (userId: string, role: IshStaffRole) => rpc<string>('staff_add', { p_user: userId, p_role: role }),

    setStaffRole: (userId: string, role: IshStaffRole) =>
      rpc<string>('staff_set_role', { p_user: userId, p_role: role }),

    /** Off the staff list: the section closes for them; what they made stays. */
    removeStaff: async (userId: string) => {
      await rpc<null>('staff_remove', { p_user: userId });
    },

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

    /** The whole job's pay (null: hours × wage) and «talked to the employer now». */
    jobDetails: async (id: string, totalPay: number | null, checked: boolean) => {
      await rpc<null>('staff_job_details', { p_shift: id, p_total_pay: totalPay, p_checked: checked });
    },

    /** How many offers went out (once per worker and job; at most 4 waiting, else TOO_MANY). */
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

    /** Monthly jobs, newest first (the staff see closed ones too). */
    monthlyJobs: async (): Promise<IshMonthlyJob[]> => {
      // Direct reads are closed (the contact phone is paid for): staff_monthly_jobs.
      const { data, error } = await db.rpc('staff_monthly_jobs');
      if (error) throw new IshError(ishErrorCode(error), error.message);
      return (data ?? []) as IshMonthlyJob[];
    },

    /** A new monthly job, or [j.id] changed. */
    saveMonthlyJob: async (j: IshMonthlyJobInput): Promise<string> => {
      const row = {
        title: j.title.trim(),
        company: j.company.trim(),
        area: j.area.trim(),
        address: j.address.trim(),
        lat: j.lat,
        lng: j.lng,
        monthly_wage: j.monthlyWage,
        days_per_week: j.daysPerWeek,
        hours_per_day: j.hoursPerDay,
        description: j.description.trim(),
        category: j.category,
        work_time: j.workTime,
        contact_phone: j.contactPhone.trim(),
        translations: j.translations,
      };
      const query = j.id
        ? db.from('monthly_jobs').update(row).eq('id', j.id)
        : db.from('monthly_jobs').insert(row);
      const { data, error } = await query.select('id').single();
      if (error) throw new IshError(ishErrorCode(error), error.message);
      return (data as { id: string }).id;
    },

    /** Closes a monthly job (workers stop seeing it) or opens it again. */
    setMonthlyJobStatus: async (id: string, status: 'open' | 'closed'): Promise<void> => {
      const { error } = await db.from('monthly_jobs').update({ status }).eq('id', id);
      if (error) throw new IshError(ishErrorCode(error), error.message);
    },

    deleteMonthlyJob: async (id: string): Promise<void> => {
      const { error } = await db.from('monthly_jobs').delete().eq('id', id);
      if (error) throw new IshError(ishErrorCode(error), error.message);
    },

    /** Who said «Qiziqaman» (all jobs, or one), with their phones. */
    monthlyInterest: async (jobId?: string) =>
      (await rpc<IshMonthlyInterest[] | null>('staff_monthly_interest', { p_job: jobId ?? null })) ?? [],

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
