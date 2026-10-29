import { useEffect, useState } from 'react';
import { describeEvent, screenLabel } from '@/components/crm/appActivity/describe';
import type { AppEvent } from '@/components/crm/appActivity/useAppActivity';
import elements from '@/components/crm/appActivity/appElements.json';
import { institutionNames, useEventNames, type JourneyStep } from './person';
import { ANSWER_QS, bandLabel } from './marketing';

/**
 * One step of a person's path in words — for «To'liq yo'l» and «Jonli»: the
 * CRM's own wording where it has one (appActivity.events), otherwise the
 * app's registry (app_event_types.description_uz), with the tap's name from
 * the app's dictionary (appElements.json) and universities by name.
 */
type T = (k: string, o?: Record<string, unknown>) => string;
type ElementInfo = { uz: string | null };
const ELEMENTS = elements as Record<string, ElementInfo>;

/** Events the CRM already words well (appActivity.events). */
const DESCRIBED = new Set([
  'screen_view', 'tab_open', 'university_open', 'university_save', 'university_unsave', 'university_skip',
  'slot_remove', 'slot_set', 'duel_pick', 'filter_apply', 'assessment_start', 'report_view', 'lead_submit',
  'sign_in', 'qr_scan', 'interview_start', 'interview_end', 'interview_leave', 'study_plan_feedback',
  'dictation_start', 'document_upload', 'contact_tap', 'language_set', 'search', 'app_open',
]);

/** The plan's marks: → opened, ▣ a screen and its time, ♥ a pick, ✎ a form, × left. */
export const STEP_ICON: Record<string, string> = {
  app_open: '→',
  app_resume: '→',
  screen_leave: '▣',
  slot_set: '♥',
  slot_remove: '♡',
  form_open: '✎',
  field_focus: '✎',
  field_error: '✎',
  form_submit: '✎',
  question_answer: '✎',
  lead_submit: '✎',
  app_background: '×',
};

/** "41 s", "1 daq 12 s". */
export function duration(seconds: number | null | undefined, t: T): string {
  if (seconds == null || seconds < 0) return '';
  const s = Math.round(seconds);
  if (s < 60) return t('appPerson.seconds', { s });
  return t('appPerson.minutes', { m: Math.floor(s / 60), s: s % 60 });
}

/**
 * The most pressed buttons that have no text of their own in the app's
 * dictionary (an answer pill, the bottom menu, the guided tour), named after
 * what the app's code does with them.
 */
const UNLABELED: Record<string, string> = {
  'assess.pill': 'javob varianti',
  'visa.assess_section_toggle': "bo'limni ochish/yopish",
  'fd_bottom_nav.select': 'pastki menyu',
  'page_tour.tour_layer': "yo'riqnoma (keyingi qadam)",
  'universities.card': 'universitet kartasi',
  'university.pick': "♥ Tanlovga qo'shish / ✓ Tanlovda",
  'university.faculty_card': 'fakultet kartasi',
  'language_cards.selected': 'til kartasi',
  'language.confirm': 'tilni tasdiqlash',
  'study_plan.update_session_step': 'Study Plan qadami',
  'study_plan_builder.leave': "Study Plan'dan chiqish",
  'university_choices_entry.to_university_choices': "universitet tanloviga o'tish",
  'survey_detail.to_surveys': "so'rovnomalarga qaytish",
  'surveys.open_survey': "so'rovnomani ochish",
};

export function elementLabel(name: string | null): string {
  if (!name) return '';
  return ELEMENTS[name]?.uz ?? UNLABELED[name] ?? name.replace(/[._]/g, ' ');
}

/** «Tavsiyanoma (o'qituvchidan)», «TOPIK — TOPIK 3»: an answered question and, where it reads as words, the answer. */
export function answerLabel(props: Record<string, unknown> | null | undefined, t: T): string {
  const q = typeof props?.q === 'string' ? props.q : null;
  if (!q) return '';
  const question = t(`marketing.questions.${q}`, { defaultValue: q.replace(/_/g, ' ') });
  const band = props?.band;
  const shown = (ANSWER_QS as readonly string[]).includes(q) && (typeof band === 'string' || typeof band === 'number' || typeof band === 'boolean');
  return shown ? `${question} — ${bandLabel(q, String(band), t)}` : question;
}

/** A describer for [steps]: loads the registry and the universities they name. */
export function useStepDescriber(steps: JourneyStep[] | null | undefined, t: T) {
  const registry = useEventNames();
  const [unis, setUnis] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!steps?.length) return;
    const ids = new Set<string>();
    for (const s of steps) {
      for (const k of ['institution_id', 'other_id']) {
        const v = s.props?.[k];
        if (typeof v === 'string' && v) ids.add(v);
      }
    }
    if (!ids.size) return;
    let alive = true;
    void institutionNames([...ids]).then((names) => {
      if (alive) setUnis((old) => ({ ...old, ...names }));
    });
    return () => {
      alive = false;
    };
  }, [steps]);

  return (s: JourneyStep): string => {
    const event: AppEvent = {
      id: 0,
      install_id: '',
      user_id: null,
      event: s.event,
      screen: s.screen,
      props: s.props ?? {},
      occurred_at: s.at,
    };
    if (DESCRIBED.has(s.event)) return describeEvent(event, t, unis);
    const base = registry[s.event] ?? s.event;
    if (s.event === 'tap' || s.event === 'long_press') return `${base}: ${elementLabel(s.element)}`;
    if (s.event === 'screen_leave') return screenLabel(s.screen, t) || base;
    if (s.event === 'question_answer') {
      const answer = answerLabel(s.props, t);
      return answer ? `${base}: ${answer}` : base;
    }
    const formKey = typeof s.props?.form === 'string' ? s.props.form : null;
    const form = formKey ? ` · ${t(`appActivity.forms.${formKey}`, { defaultValue: formKey })}` : '';
    const what =
      typeof s.props?.q === 'string' ? ` · ${s.props.q}` : typeof s.props?.field === 'string' ? ` · ${s.props.field}` : '';
    return `${base}${form}${what}`;
  };
}
