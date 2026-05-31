-- Fully-automated uni-DB pipeline: remove the human review gate.
--
-- The pipeline auto-approves every non-empty/non-failed extraction at parse
-- time (parse_worker) and the existing publish_worker drains review_queue rows
-- with status='approved' into the public content tables. Low-confidence /
-- difficult-field extractions are still PUBLISHED, but flagged
-- needs_attention=true so staff can triage them on a read-only dashboard —
-- nothing blocks applicant-facing data anymore.
--
-- This migration is idempotent and safe to run on a DB that lags prod
-- (e.g. staging is missing review_queue.published_at/published_outcome).

-- 1) review_queue: parity columns (no-op on prod, fills the gap on staging) ----
alter table public.review_queue
  add column if not exists published_at timestamptz,
  add column if not exists published_outcome text,
  add column if not exists needs_attention boolean not null default false;

comment on column public.review_queue.needs_attention is
  'Auto-gate flag: true when this item was auto-approved despite low extractor '
  'confidence or a difficult field. The row still publishes; the flag drives the '
  'read-only "needs attention" dashboard. Carried onto the published content row.';

-- 2) Allow the auto-approval reason + keep published_outcome values consistent.
--    Drop+recreate so this converges from whatever each environment had.
alter table public.review_queue drop constraint if exists review_queue_reason_check;
alter table public.review_queue add constraint review_queue_reason_check
  check (reason = any (array[
    'low_confidence', 'correction_notice', 'high_difficulty_field',
    'translation_low_confidence', 'user_reported', 'parse_error',
    'schema_violation', 'extraction_failed', 'field_hallucination',
    'network_error', 'pdf_unreachable', 'cost_circuit_breaker',
    'mime_mismatch',
    'auto_approved'  -- new: clean high-confidence auto-approval
  ]));

alter table public.review_queue drop constraint if exists review_queue_published_outcome_check;
alter table public.review_queue add constraint review_queue_published_outcome_check
  check (published_outcome is null or published_outcome = any (array[
    'published', 'held', 'skipped'
  ]));

-- 3) Content tables carry the flag so the app/dashboard can surface it ---------
alter table public.admission_cycles
  add column if not exists needs_attention boolean not null default false,
  add column if not exists attention_reason text;
alter table public.requirements
  add column if not exists needs_attention boolean not null default false,
  add column if not exists attention_reason text;
alter table public.tuition
  add column if not exists needs_attention boolean not null default false,
  add column if not exists attention_reason text;
alter table public.scholarships
  add column if not exists needs_attention boolean not null default false,
  add column if not exists attention_reason text;
alter table public.documents_required
  add column if not exists needs_attention boolean not null default false,
  add column if not exists attention_reason text;
alter table public.university_admission_periods
  add column if not exists needs_attention boolean not null default false,
  add column if not exists attention_reason text;

-- 4) Read-only "needs attention" dashboard feed -------------------------------
--    Published rows that were auto-approved at low confidence, unified across
--    sections with their institution name + source rationale. security_invoker
--    so the caller's RLS applies (mirrors the other uni_db views).
create or replace view public.v_needs_attention
  with (security_invoker = on) as
  select 'requirements'::text as section, r.id, c.institution_id,
         i.name_ko, i.name_en, r.attention_reason, r.created_at
    from public.requirements r
    join public.admission_cycles c on c.id = r.cycle_id
    join public.institutions i on i.id = c.institution_id
   where r.needs_attention
  union all
  select 'documents_required', d.id, c.institution_id,
         i.name_ko, i.name_en, d.attention_reason, d.created_at
    from public.documents_required d
    join public.admission_cycles c on c.id = d.cycle_id
    join public.institutions i on i.id = c.institution_id
   where d.needs_attention
  union all
  select 'tuition', t.id, t.institution_id,
         i.name_ko, i.name_en, t.attention_reason, t.created_at
    from public.tuition t
    join public.institutions i on i.id = t.institution_id
   where t.needs_attention
  union all
  select 'scholarships', s.id, s.institution_id,
         i.name_ko, i.name_en, s.attention_reason, s.created_at
    from public.scholarships s
    join public.institutions i on i.id = s.institution_id
   where s.needs_attention
  union all
  select 'admission_cycles', c.id, c.institution_id,
         i.name_ko, i.name_en, c.attention_reason, c.created_at
    from public.admission_cycles c
    join public.institutions i on i.id = c.institution_id
   where c.needs_attention
  union all
  select 'admission_periods', p.id, p.institution_id,
         i.name_ko, i.name_en, p.attention_reason, p.created_at
    from public.university_admission_periods p
    join public.institutions i on i.id = p.institution_id
   where p.needs_attention;

comment on view public.v_needs_attention is
  'Read-only feed of auto-published rows flagged needs_attention (low extractor '
  'confidence / difficult field). Drives the CRM "needs attention" triage view. '
  'No human approval is required for data to publish; this is purely advisory.';
