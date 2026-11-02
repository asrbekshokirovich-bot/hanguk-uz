import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ArrowRight, BookOpen, Check, ChevronDown, ContactRound, FileText, Globe, Loader2, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AIMessageContent } from '@/components/ai/AIMessageContent';
import {
  dmy, hostOf, leadSource, parseSeason, stepKeys,
  type AnswerMeta, type AnswerSource, type SourceKind, type StudentEntity,
} from '@/lib/hangukAiAnswer';

// One Hanguk AI answer in the CRM, as in Asrbek's design (2026-10-29):
//  - with a student card: one white card — the steps the agent took (lime
//    chips), the text, the student card, then sources and 👍/👎 in a footer;
//  - otherwise: a plain bubble with the source chip and 👍/👎 under it.

const db = supabase as unknown as SupabaseClient;

const KIND_ICON: Record<SourceKind, { Icon: typeof BookOpen; className: string }> = {
  guideline: { Icon: BookOpen, className: 'text-[#2447D6]' },
  pdf: { Icon: FileText, className: 'text-[#DC2626]' },
  crm: { Icon: ContactRound, className: 'text-[#7FA11A]' },
  web: { Icon: Globe, className: 'text-muted-foreground' },
};

const KIND_ORDER: SourceKind[] = ['guideline', 'pdf', 'crm', 'web'];

function SourceIcon({ kind, className }: { kind: SourceKind; className?: string }) {
  const { Icon, className: tone } = KIND_ICON[kind] ?? KIND_ICON.web;
  return <Icon className={cn('h-3.5 w-3.5', tone, className)} aria-hidden />;
}

function sourceHref(s: AnswerSource): { href: string; internal: boolean } | null {
  if (!s.url) return null;
  if (s.kind === 'crm' && s.url.startsWith('/')) return { href: s.url, internal: true };
  if (/^https?:\/\//.test(s.url)) return { href: s.url, internal: false };
  return null;
}

function Sources({ sources }: { sources: AnswerSource[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!sources.length) return null;

  const open = (s: AnswerSource) => {
    const link = sourceHref(s);
    if (!link) return;
    if (link.internal) navigate(link.href);
    else window.open(link.href, '_blank', 'noopener,noreferrer');
  };
  const label = (s: AnswerSource) => (s.kind === 'crm' ? t('ai.answer.crmPage', 'CRM sahifasi') : s.label);

  if (sources.length === 1) {
    const s = sources[0];
    return (
      <button
        type="button"
        onClick={() => open(s)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground/80 hover:bg-muted"
      >
        <SourceIcon kind={s.kind} />
        {label(s)}
      </button>
    );
  }

  const kinds = KIND_ORDER.filter((k) => sources.some((s) => s.kind === k));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground/80 hover:bg-muted"
        >
          <span className="flex items-center -space-x-0.5">
            {kinds.map((k) => (
              <span key={k} className="flex h-4 w-4 items-center justify-center rounded bg-background">
                <SourceIcon kind={k} />
              </span>
            ))}
          </span>
          {t('ai.answer.sources', { count: sources.length, defaultValue: '{{count}} manba' })}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="theme-light w-80 p-1">
        {sources.map((s, i) => {
          const link = sourceHref(s);
          const extra = [s.page, s.kind === 'web' ? hostOf(s.url) : null, s.date ? dmy(s.date) : null].filter(Boolean).join(' · ');
          return (
            <button
              key={i}
              type="button"
              disabled={!link}
              onClick={() => open(s)}
              className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
            >
              <SourceIcon kind={s.kind} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{label(s)}</span>
                {extra && <span className="block text-muted-foreground">{extra}</span>}
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/** "hanyang.ac.kr · 29.10.2026" next to the sources chip. */
function LeadSourceText({ sources }: { sources: AnswerSource[] }) {
  const s = leadSource(sources);
  if (!s || sources.length < 2) return null;
  const text = s.kind === 'web'
    ? [hostOf(s.url), dmy(s.date)].filter(Boolean).join(' · ')
    : s.kind === 'pdf' ? [s.label, s.page].filter(Boolean).join(' · ') : '';
  return text ? <span className="truncate text-xs text-muted-foreground">{text}</span> : null;
}

function Feedback({ runId }: { runId?: string }) {
  const { t } = useTranslation();
  const [value, setValue] = useState<1 | -1 | null>(null);
  if (!runId) return null;
  const send = async (v: 1 | -1) => {
    setValue(v);
    const { error } = await db.rpc('ai_run_feedback', { p_run: runId, p_value: v, p_note: null });
    if (error) setValue(null);
  };
  const btn = 'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground';
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={cn(btn, value === 1 && 'text-success')} aria-label={t('ai.answer.good', 'Yaxshi javob')} onClick={() => void send(1)}>
        <ThumbsUp className="h-4 w-4" fill={value === 1 ? 'currentColor' : 'none'} />
      </button>
      <button type="button" className={cn(btn, value === -1 && 'text-destructive')} aria-label={t('ai.answer.bad', 'Yomon javob')} onClick={() => void send(-1)}>
        <ThumbsDown className="h-4 w-4" fill={value === -1 ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

function Steps({ steps, running }: { steps: string[]; running: boolean }) {
  const { t } = useTranslation();
  const keys = stepKeys(steps);
  if (!keys.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {keys.map((k, i) => {
        const busy = running && i === keys.length - 1;
        return (
          <span key={k} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#EEF6C8] px-3 text-xs font-semibold text-[#7FA11A]">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {t(`ai.answer.step.${k}`)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function DocsRing({ entity }: { entity: StudentEntity }) {
  const done = entity.docsApproved ?? 0;
  const total = entity.docsRequired || 8;
  const pct = Math.max(0, Math.min(1, done / total));
  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#CCE33A ${pct * 360}deg, hsl(var(--border)) 0deg)` }}
      aria-hidden
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-sm font-bold text-card-foreground">
        {entity.initials}
      </div>
    </div>
  );
}

function StudentCard({ entity }: { entity: StudentEntity }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const season = parseSeason(entity.season);
  const tone = {
    good: 'bg-emerald-50 text-emerald-700',
    bad: 'bg-red-50 text-red-700',
    neutral: 'bg-muted text-muted-foreground',
  } as const;
  const dot = { good: 'bg-emerald-500', bad: 'bg-red-500', neutral: 'bg-muted-foreground' } as const;
  return (
    <div className="flex gap-4 rounded-xl border border-border bg-muted/40 p-4">
      <DocsRing entity={entity} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{entity.name}</p>
            <p className="text-xs text-muted-foreground">
              {t('ai.answer.student', 'Talaba')}
              {season && <> · {season.year} {t(`ai.answer.${season.term}`)}</>}
              {entity.docsApproved != null && (
                <> · {t('ai.answer.documents', 'Hujjatlar')}{' '}
                  <span className="font-semibold text-[#7FA11A]">{entity.docsApproved}/{entity.docsRequired ?? 8}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/crm/students?student=${encodeURIComponent(entity.id)}`)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted"
          >
            {t('ai.answer.openCard', 'Kartani ochish')}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {entity.universities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {entity.universities.map((u, i) => (
              <span key={i} className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold', tone[u.tone])}>
                <span className={cn('h-1.5 w-1.5 rounded-full', dot[u.tone])} />
                {u.name} · {t(`ai.answer.uni.${u.status}`)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  content: string;
  meta?: AnswerMeta;
  /** This answer is still streaming. */
  running?: boolean;
  onPick?: (value: string) => void;
  interactive?: boolean;
}

export function AIAnswer({ content, meta = {}, running = false, onPick, interactive }: Props) {
  const { t } = useTranslation();
  const sources = meta.sources ?? [];
  const steps = meta.steps ?? [];
  const text = content
    ? <AIMessageContent content={content} onPick={onPick} interactive={interactive} />
    : <p className="text-sm text-muted-foreground">{t('ai.thinking', 'Thinking...')}</p>;

  if (meta.entity || (running && steps.length)) {
    return (
      <div className="w-full max-w-[680px] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <Steps steps={steps} running={running} />
        <div className={cn('space-y-4 px-4 pb-4', steps.length ? 'border-t border-border pt-4' : 'pt-4')}>
          {text}
          {meta.entity && <StudentCard entity={meta.entity} />}
        </div>
        {!running && (sources.length > 0 || meta.runId) && (
          <div className="flex items-center gap-3 border-t border-border px-4 py-2.5">
            <Sources sources={sources} />
            <LeadSourceText sources={sources} />
            <div className="ml-auto">
              <Feedback runId={meta.runId} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[680px] space-y-1.5">
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-card-foreground shadow-sm">{text}</div>
      {!running && (sources.length > 0 || meta.runId) && (
        <div className="flex items-center gap-2">
          <Sources sources={sources} />
          <Feedback runId={meta.runId} />
        </div>
      )}
    </div>
  );
}
