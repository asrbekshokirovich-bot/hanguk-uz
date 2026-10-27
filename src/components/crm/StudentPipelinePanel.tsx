import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  PIPELINE_LABELS,
  PIPELINE_STAGES,
  SUBMISSION_STEP_LABELS,
  submissionStep,
  type StudentPipeline,
} from '@/lib/studentPipeline';
import type { PipelineUniversity } from '@/hooks/useCRMData';

/**
 * Read-only view of where a student is (profile → "Ariza holati" and
 * "Arizalar"). Nothing is changed here: the data comes from Hujjatlar,
 * Universitet tanlash, Onlayn ariza and Oflayn ariza — the same as the
 * Arizalar board.
 */

const fmt = (iso: string | null | undefined, lang: string) =>
  iso ? new Date(iso).toLocaleDateString(lang.startsWith('uz') ? 'uz-UZ' : lang, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Tashkent' }) : null;

function useStageLabel() {
  const { t } = useTranslation();
  return (stage: keyof typeof PIPELINE_LABELS) => t(`pipeline.stage.${stage}`, { defaultValue: PIPELINE_LABELS[stage] });
}

export function StudentPipelineSummary({ pipeline }: { pipeline: StudentPipeline }) {
  const { t } = useTranslation();
  const stageLabel = useStageLabel();
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('pipeline.stageTitle', { defaultValue: 'Jarayon' })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="info">{stageLabel(pipeline.stage)}</Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {pipeline.step}/{pipeline.steps}
          </span>
        </div>
        <Progress value={(pipeline.step / pipeline.steps) * 100} className="h-2" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('pipeline.docsPack', { defaultValue: 'Hujjat paketi' })}</span>
          <span className="font-medium">
            {pipeline.docsVerified}/{pipeline.docsRequired}
          </span>
        </div>
        <ol className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-3">
          {PIPELINE_STAGES.map((s, i) => {
            const done = i < pipeline.step - 1;
            const current = i === pipeline.step - 1;
            return (
              <li key={s} className={cn('flex items-center gap-2 text-xs', done || current ? 'text-foreground' : 'text-muted-foreground')}>
                {done ? <CheckCircle className="h-3.5 w-3.5 text-primary" /> : <Circle className={cn('h-3.5 w-3.5', current && 'text-accent')} />}
                <span className={cn(current && 'font-semibold')}>{stageLabel(s)}</span>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-muted-foreground">{t('pipeline.whereToEdit')}</p>
      </CardContent>
    </Card>
  );
}

export function StudentPipelineUniversities({
  pipeline,
  universities,
}: {
  pipeline: StudentPipeline;
  universities: PipelineUniversity[];
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const nameOf = (id: string) => {
    const u = universities.find((x) => x.id === id);
    return u?.name_en || u?.name_ko || '—';
  };
  if (pipeline.universityIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('pipeline.noUniversities', { defaultValue: "Hali universitet tanlanmagan yoki topshirilmagan." })}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {pipeline.universityIds.map((id) => {
        const sub = pipeline.submissions.find((s) => s.institution_id === id);
        const step = submissionStep(sub);
        const facts: [string, string | null][] = [
          [t('pipeline.online', { defaultValue: 'Onlayn' }), fmt(sub?.online_submitted_at, lang)],
          [t('pipeline.offline', { defaultValue: 'Oflayn' }), fmt(sub?.offline_sent_at, lang)],
          [t('pipeline.interview', { defaultValue: 'Suhbat' }), fmt(sub?.interview_at, lang)],
          [
            t('pipeline.result', { defaultValue: 'Natija' }),
            sub?.result
              ? `${t(`pipeline.step.${sub.result}`, { defaultValue: SUBMISSION_STEP_LABELS[sub.result as 'accepted' | 'rejected'] })}${sub.result_at ? ` · ${fmt(sub.result_at, lang)}` : ''}`
              : null,
          ],
        ];
        return (
          <Card key={id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  {nameOf(id)}
                </CardTitle>
                <Badge variant={step === 'rejected' ? 'destructive' : step === 'chosen' ? 'neutral' : 'info'}>
                  {t(`pipeline.step.${step}`, { defaultValue: SUBMISSION_STEP_LABELS[step] })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className={cn(!v && 'text-muted-foreground')}>{v ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
