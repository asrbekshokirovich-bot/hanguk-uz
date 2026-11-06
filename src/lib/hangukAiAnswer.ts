// Pieces of a Hanguk AI answer the CRM draws around the text (Asrbek's design,
// 2026-10-29): the steps the agent took, the sources, the student card and the
// run id for 👍/👎. They arrive as `data: {"hanguk": …}` events (rich: true)
// and are stored with the answer in ai_conversations.context_snapshot.

export type SourceKind = 'guideline' | 'pdf' | 'web' | 'crm';

export interface AnswerSource {
  kind: SourceKind;
  label: string;
  url?: string | null;
  page?: string | null;
  date?: string | null;
}

export interface StudentEntity {
  kind: 'student';
  id: string;
  name: string;
  initials: string;
  season: string | null;
  docsApproved: number | null;
  docsRequired: number | null;
  universities: { name: string; status: string; tone: 'good' | 'bad' | 'neutral' }[];
}

/** "spring 2027" → { term: 'spring', year: '2027' }. */
export function parseSeason(s?: string | null): { term: 'spring' | 'fall'; year: string } | null {
  const m = (s ?? '').match(/^(spring|fall)\s+(\d{4})$/i);
  return m ? { term: m[1].toLowerCase() as 'spring' | 'fall', year: m[2] } : null;
}

export interface AnswerMeta {
  runId?: string;
  steps?: string[];
  sources?: AnswerSource[];
  entity?: StudentEntity | null;
}

/** One SSE `hanguk` event folded into the answer's meta. */
export function applyEvent(meta: AnswerMeta, e: unknown): AnswerMeta {
  if (!e || typeof e !== 'object') return meta;
  const ev = e as Record<string, unknown>;
  if (ev.type === 'step' && Array.isArray(ev.tools)) {
    const steps = [...(meta.steps ?? [])];
    for (const name of ev.tools) if (typeof name === 'string' && name && !steps.includes(name)) steps.push(name);
    return { ...meta, steps };
  }
  if (ev.type === 'meta') return { ...meta, ...fromSnapshot(ev) };
  return meta;
}

/** ai_conversations.context_snapshot (or a meta event) → AnswerMeta. */
export function fromSnapshot(s: unknown): AnswerMeta {
  if (!s || typeof s !== 'object') return {};
  const o = s as Record<string, unknown>;
  return {
    runId: typeof o.run_id === 'string' ? o.run_id : undefined,
    steps: Array.isArray(o.steps) ? (o.steps.filter((x) => typeof x === 'string') as string[]) : undefined,
    sources: Array.isArray(o.sources) ? (o.sources as AnswerSource[]) : undefined,
    entity: o.entity && typeof o.entity === 'object' ? (o.entity as StudentEntity) : null,
  };
}

/** Tool name → i18n key of its step label; similar tools share one label. */
export function stepKey(tool: string): string {
  if (tool === 'search_students' || tool === 'list_students') return 'searchStudent';
  if (tool === 'get_student_card') return 'readCard';
  if (tool === 'search_leads' || tool === 'list_leads') return 'searchLead';
  if (tool === 'get_lead_card') return 'readLead';
  if (tool === 'season_pipeline') return 'pipeline';
  if (tool === 'guideline_text_search') return 'guidelinePdf';
  if (tool.startsWith('uni_') || tool === 'gks_info' || tool === 'glossary' || tool === 'announcements') return 'guideline';
  if (tool === 'web_search' || tool === 'web_fetch') return 'web';
  if (tool === 'daily_reports') return 'reports';
  if (tool === 'group_summary') return 'groupSummary';
  if (tool === 'team_history_search') return 'teamHistory';
  if (tool === 'query_database') return 'compute';
  if (tool === 'my_card') return 'myCard';
  if (tool.startsWith('memory_')) return 'memory';
  return 'data';
}

/** Step labels in order, one per kind (search_students twice = one chip). */
export function stepKeys(tools: string[] = []): string[] {
  const out: string[] = [];
  for (const t of tools) {
    const k = stepKey(t);
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

/** "https://www.hanyang.ac.kr/x" → "hanyang.ac.kr". */
export function hostOf(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The source named next to the "N manba" chip: a web page first, else the first one. */
export function leadSource(sources: AnswerSource[] = []): AnswerSource | null {
  return sources.find((s) => s.kind === 'web') ?? sources.find((s) => s.kind === 'pdf') ?? sources[0] ?? null;
}

/** "2026-10-29" → "29.10.2026". */
export function dmy(date?: string | null): string {
  const m = (date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : date ?? '';
}
