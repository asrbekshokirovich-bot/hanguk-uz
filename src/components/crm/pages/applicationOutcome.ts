// The single source of truth for an application's admission outcome, shared by
// the Applications board and its statistics panel so their numbers always agree.
//
// "Accepted" (the green "Qabul qilindi" card) = the decision field says accepted,
// OR the pipeline status has reached completed/accepted (a student only reaches
// that stage after admission). Waitlist / rejected are derived the same way.

export type Outcome = 'accepted' | 'waitlist' | 'rejected' | 'pending';

export function outcomeOf(app: { decision?: string | null; status?: string | null }): Outcome {
  const d = (app.decision || '').toLowerCase();
  if (d.includes('accept')) return 'accepted';
  if (d.includes('waitlist')) return 'waitlist';
  if (d.includes('reject')) return 'rejected';
  if (app.status === 'completed' || app.status === 'accepted') return 'accepted';
  if (app.status === 'rejected') return 'rejected';
  return 'pending';
}
