import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf } from './queueLogic';
import { STAGE_KEYS, mostAdvancedStatus, stageIndexFor } from './stages';
import type { ActivityVM, DocumentVM, ProgressStepVM, StudentContextVM } from './types';

/**
 * Loads everything the context rail renders for one student.
 *
 * `message_threads.student_id` points at `profiles.user_id` (there is no
 * `students` table in this schema), so every query below keys on that column.
 * The five reads run concurrently and are merged client-side; the rail is
 * read-only, so nothing here writes back.
 *
 * Threads with no linked student resolve to `null` and the rail renders its
 * "not linked to a student yet" state.
 */
export function useStudentContext(studentId: string | null) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<StudentContextVM | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      const [profileRes, docsRes, appsRes, paymentsRes, callsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, phone, payment_plan, magic_code')
          .eq('user_id', id)
          .maybeSingle(),
        supabase
          .from('documents')
          .select('id, name, status, created_at, reviewed_at')
          .eq('student_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('applications')
          .select('id, status, submitted_at, decision, decision_at')
          .eq('student_id', id),
        supabase
          .from('payments')
          .select('id, amount, paid_amount, currency, status, due_date, paid_at')
          .eq('student_id', id),
        supabase
          .from('calls')
          .select('id, direction, duration, started_at')
          .eq('student_id', id)
          .order('started_at', { ascending: false })
          .limit(5),
      ]);

      const profile = profileRes.data;
      const docs = docsRes.data ?? [];
      const apps = appsRes.data ?? [];
      const payments = paymentsRes.data ?? [];
      const calls = callsRes.data ?? [];

      const name = profile?.full_name ?? '';
      const currentStage = stageIndexFor(mostAdvancedStatus(apps.map((a) => a.status)));

      const steps: ProgressStepVM[] = STAGE_KEYS.map((key, index) => ({
        label: t(key),
        note: stepNote(index, currentStage, apps, docs, i18n.language, t),
        state: index < currentStage ? 'done' : index === currentStage ? 'current' : 'todo',
      }));

      const documents: DocumentVM[] = docs.slice(0, 6).map((d) => ({
        label: d.name,
        state: documentState(d.status),
      }));

      const paid = payments.reduce((sum, p) => sum + Number(p.paid_amount ?? 0), 0);
      const total = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
      const nextDue =
        payments
          .filter((p) => p.status !== 'completed' && p.status !== 'refunded' && p.due_date)
          .map((p) => p.due_date as string)
          .sort()[0] ?? null;

      const activity: ActivityVM[] = buildActivity(calls, docs, payments, t).slice(0, 5);

      setData({
        name,
        initials: initialsOf(name),
        phone: profile?.phone ?? null,
        plan: profile?.payment_plan ?? null,
        magicCode: profile?.magic_code ?? null,
        steps,
        documents,
        payment: payments.length > 0 ? { paid, total, currency: payments[0].currency ?? 'UZS', nextDue } : null,
        activity,
      });
      setLoading(false);
    },
    [t, i18n.language],
  );

  useEffect(() => {
    if (!studentId) {
      setData(null);
      setLoading(false);
      return;
    }
    void load(studentId);
  }, [studentId, load]);

  return { student: data, loading };
}

/**
 * `documents.status` is a free-form string. The values the app actually writes
 * are `uploaded` (student upload), `approved` / `rejected` (staff review) and,
 * tolerated on read, `pending`.
 */
function documentState(status: string | null): DocumentVM['state'] {
  const s = (status ?? '').toLowerCase();
  if (s === 'approved') return 'received';
  if (s === 'uploaded' || s === 'pending' || s === 'in_review') return 'review';
  return 'missing';
}

type AppRow = { status: string; submitted_at: string | null; decision: string | null };
type DocRow = { status: string | null };
type PaymentRow = { amount: number | null; paid_amount: number | null; paid_at: string | null; currency: string | null };
type CallRow = { id: string; direction: string; duration: number | null; started_at: string | null };
type TFn = (key: string, options?: Record<string, unknown>) => string;

/** Short right-aligned note under each progress step. */
function stepNote(
  index: number,
  currentStage: number,
  apps: AppRow[],
  docs: DocRow[],
  locale: string,
  t: TFn,
): string {
  if (index === 1 && currentStage <= 1) {
    const missing = docs.filter((d) => documentState(d.status) === 'missing').length;
    if (missing > 0) return t('messages.rail.missingCount', { count: missing });
    return docs.length > 0 ? t('messages.rail.complete') : '—';
  }
  if (index === 2) {
    const submitted = apps.find((a) => a.submitted_at)?.submitted_at;
    if (submitted) return new Date(submitted).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }
  if (index < currentStage) return t('messages.rail.complete');
  return '—';
}

function buildActivity(calls: CallRow[], docs: (DocRow & { id: string; name: string; created_at: string })[], payments: (PaymentRow & { id: string })[], t: TFn): ActivityVM[] {
  const entries: ActivityVM[] = [];

  for (const c of calls) {
    if (!c.started_at) continue;
    const minutes = c.duration ? Math.round(c.duration / 60) : 0;
    entries.push({
      id: `call-${c.id}`,
      text: t('messages.rail.activityCall', { minutes }),
      at: c.started_at,
    });
  }
  for (const d of docs.slice(0, 5)) {
    entries.push({
      id: `doc-${d.id}`,
      text: t('messages.rail.activityDocument', { name: d.name }),
      at: d.created_at,
    });
  }
  for (const p of payments) {
    if (!p.paid_at) continue;
    entries.push({
      id: `pay-${p.id}`,
      text: t('messages.rail.activityPayment'),
      at: p.paid_at,
    });
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
