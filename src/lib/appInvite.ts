import { supabase } from '@/integrations/supabase/client';

/**
 * Ushlab qolish rejasi P14: the CRM's «Ilovaga taklif». student-app-invite
 * (P13) sends the student a Telegram message with the login code and the app
 * link, or makes a task for the consultant when there is no Telegram. A
 * student already in the app, or invited this week, is skipped.
 */
export interface InviteResult {
  ok?: boolean;
  dry?: boolean;
  telegram: number;
  task: number;
  skipped: number;
  failed?: number;
  error?: string;
}

export type InviteTarget = { studentIds: string[] } | { all: true };

export function inviteBody(target: InviteTarget, dry = false): Record<string, unknown> {
  const body: Record<string, unknown> = 'all' in target ? { all: true } : { student_ids: target.studentIds };
  if (dry) body.dry = true;
  return body;
}

export async function inviteToApp(target: InviteTarget, dry = false): Promise<InviteResult> {
  const { data, error } = await supabase.functions.invoke('student-app-invite', { body: inviteBody(target, dry) });
  if (error) return { telegram: 0, task: 0, skipped: 0, error: error.message };
  const d = (data ?? {}) as Partial<InviteResult>;
  return { ...d, telegram: d.telegram ?? 0, task: d.task ?? 0, skipped: d.skipped ?? 0 } as InviteResult;
}

/** Nothing to do: the student is in the app or was invited this week. */
export function nothingSent(r: InviteResult): boolean {
  return !r.error && r.telegram + r.task === 0;
}
