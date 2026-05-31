-- ============================================================================
--  uni_db v1 — crawl_runs, crawl_findings, change_events,
--             extraction_jobs, review_queue
--  Plan §C.12 / §C.13
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  crawl_runs
-- ----------------------------------------------------------------------------
create table if not exists public.crawl_runs (
  id               uuid primary key default gen_random_uuid(),
  source_id        uuid not null references public.announcement_sources(id),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  status           text check (status in ('running','succeeded','failed','partial')),
  http_status_code int,
  error_text       text,
  records_seen     int not null default 0,
  records_new      int not null default 0,
  records_changed  int not null default 0
);

create index if not exists crawl_runs_source_started_idx
  on public.crawl_runs (source_id, started_at desc);

alter table public.crawl_runs enable row level security;
drop policy if exists crawl_runs_admin_only on public.crawl_runs;
create policy crawl_runs_admin_only on public.crawl_runs for select using (false);

-- ----------------------------------------------------------------------------
--  crawl_findings
-- ----------------------------------------------------------------------------
create table if not exists public.crawl_findings (
  id               uuid primary key default gen_random_uuid(),
  crawl_run_id     uuid references public.crawl_runs(id) on delete cascade,
  announcement_id  uuid references public.announcements(id) on delete set null,
  finding_type     text check (finding_type in (
    'new_post','title_change','attachment_change','correction_notice','removed'
  )),
  details          jsonb,
  detected_at      timestamptz not null default now()
);

create index if not exists crawl_findings_run_idx on public.crawl_findings (crawl_run_id);

alter table public.crawl_findings enable row level security;
drop policy if exists crawl_findings_admin_only on public.crawl_findings;
create policy crawl_findings_admin_only on public.crawl_findings for select using (false);

-- ----------------------------------------------------------------------------
--  change_events
-- ----------------------------------------------------------------------------
create table if not exists public.change_events (
  id               uuid primary key default gen_random_uuid(),
  entity_type      text not null,
  entity_id        uuid not null,
  field_name       text,
  old_value        jsonb,
  new_value        jsonb,
  detected_at      timestamptz not null default now(),
  notify_users_at  timestamptz,
  notify_status    text not null default 'pending' check (notify_status in (
    'pending','queued','delivered','suppressed','failed'
  )),
  reason           text                                  -- e.g. 'hitl_correction'
);

create index if not exists change_events_entity_idx
  on public.change_events (entity_type, entity_id, detected_at desc);
create index if not exists change_events_notify_idx
  on public.change_events (notify_status, notify_users_at);

alter table public.change_events enable row level security;
drop policy if exists change_events_admin_only on public.change_events;
create policy change_events_admin_only on public.change_events for select using (false);

-- ----------------------------------------------------------------------------
--  extraction_jobs
-- ----------------------------------------------------------------------------
create table if not exists public.extraction_jobs (
  id                       uuid primary key default gen_random_uuid(),
  guideline_document_id    uuid not null references public.guideline_documents(id) on delete cascade,
  archetype                text not null,
  field_group              text not null,
  status                   text not null default 'queued' check (status in (
    'queued','running','succeeded','failed','needs_review'
  )),
  llm_provider             text,
  llm_model                text,
  input_tokens             int,
  output_tokens            int,
  cost_usd                 numeric(10,4),
  latency_ms               int,
  accuracy_self_score      numeric(3,2),
  raw_output               jsonb,
  parsed_output            jsonb,
  error_text               text,
  started_at               timestamptz,
  ended_at                 timestamptz
);

create index if not exists extraction_jobs_doc_idx    on public.extraction_jobs (guideline_document_id);
create index if not exists extraction_jobs_status_idx on public.extraction_jobs (status);

alter table public.extraction_jobs enable row level security;
drop policy if exists extraction_jobs_admin_only on public.extraction_jobs;
create policy extraction_jobs_admin_only on public.extraction_jobs for select using (false);

-- ----------------------------------------------------------------------------
--  review_queue (HITL)
-- ----------------------------------------------------------------------------
create table if not exists public.review_queue (
  id                  uuid primary key default gen_random_uuid(),
  entity_type         text not null,
  entity_id           uuid not null,
  reason              text not null check (reason in (
    'low_confidence','correction_notice','high_difficulty_field',
    'translation_low_confidence','user_reported'
  )),
  priority            smallint not null default 5,                  -- 1 = highest
  assigned_to         uuid references auth.users(id),
  status              text not null default 'open' check (status in (
    'open','in_review','approved','rejected','escalated'
  )),
  reviewer_decision   jsonb,
  reviewer_notes      text,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

create index if not exists review_queue_status_priority_idx
  on public.review_queue (status, priority);

alter table public.review_queue enable row level security;

drop policy if exists review_queue_admin_select on public.review_queue;
create policy review_queue_admin_select on public.review_queue
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
