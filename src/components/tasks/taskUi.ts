import { differenceInCalendarDays, format } from 'date-fns';
import type { Task } from '@/hooks/useTasks';

/**
 * Shared presentation metadata for the Tasks workspace redesign.
 * Semantic Tailwind tokens only — no hardcoded colours. Labels are i18n keys;
 * call `t(meta.labelKey)` at the use site.
 */

type Translate = (key: string, opts?: Record<string, unknown>) => string;

export const PRIORITY_META: Record<
  Task['priority'],
  { bar: string; dot: string; badge: string; labelKey: string }
> = {
  urgent: { bar: 'bg-destructive', dot: 'bg-destructive', badge: 'bg-destructive/10 text-destructive', labelKey: 'tasks.urgent' },
  high: { bar: 'bg-warning', dot: 'bg-warning', badge: 'bg-warning/10 text-warning', labelKey: 'tasks.high' },
  normal: { bar: 'bg-info', dot: 'bg-info', badge: 'bg-info/10 text-info', labelKey: 'tasks.normal' },
  low: { bar: 'bg-muted-foreground', dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground', labelKey: 'tasks.low' },
};

export const STATUS_META: Record<
  Task['status'],
  { dot: string; badge: string; labelKey: string }
> = {
  todo: { dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground', labelKey: 'tasks.todo' },
  in_progress: { dot: 'bg-warning', badge: 'bg-warning/10 text-warning', labelKey: 'tasks.inProgress' },
  completed: { dot: 'bg-success', badge: 'bg-success/10 text-success', labelKey: 'tasks.completed' },
  cancelled: { dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground', labelKey: 'tasks.cancelled' },
};

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export type DueTone = 'overdue' | 'today' | 'upcoming';

export interface DueMeta {
  label: string;
  tone: DueTone;
}

export const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: 'bg-destructive/10 text-destructive',
  today: 'bg-warning/10 text-warning',
  upcoming: 'bg-muted text-muted-foreground',
};

/** Returns a localized due-date chip, or null when there is no due date. */
export function getDueMeta(dueDate: string | null, t: Translate): DueMeta | null {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;

  const diff = differenceInCalendarDays(date, new Date());
  if (diff < 0) return { label: t('tasks.due.overdue', { n: Math.abs(diff) }), tone: 'overdue' };
  if (diff === 0) return { label: t('tasks.due.today'), tone: 'today' };
  if (diff === 1) return { label: t('tasks.due.tomorrow'), tone: 'upcoming' };
  if (diff <= 7) return { label: t('tasks.due.inDays', { n: diff }), tone: 'upcoming' };
  return { label: format(date, 'd MMM'), tone: 'upcoming' };
}

export type FocusBucket = 'overdue' | 'today' | 'upcoming' | 'completed';

/** Maps a task to its Focus-view time bucket (cancelled tasks return null). */
export function getFocusBucket(task: Task): FocusBucket | null {
  if (task.status === 'completed') return 'completed';
  if (task.status === 'cancelled') return null;
  if (!task.due_date) return 'upcoming';
  const diff = differenceInCalendarDays(new Date(task.due_date), new Date());
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}
