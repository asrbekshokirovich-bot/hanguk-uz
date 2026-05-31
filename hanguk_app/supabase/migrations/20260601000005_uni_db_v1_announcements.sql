-- ============================================================================
--  uni_db v1 — announcement_sources, announcements
--  Plan §C.11
--
--  Both tables are admin-only (anon/authenticated cannot read). They
--  are operational metadata, not user-facing content.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  announcement_sources
-- ----------------------------------------------------------------------------
create table if not exists public.announcement_sources (
  id                          uuid primary key default gen_random_uuid(),
  institution_id              uuid references public.institutions(id) on delete cascade,
  source_type                 text not null check (source_type in (
    'university_admission_board','university_oia_board',
    'moe_okep','adiga','study_in_korea','niied','other_korean'
  )),
  url_ko                      text not null,
  cron_high_season_minutes    int not null default 360,
  cron_off_season_minutes     int not null default 1440,
  jitter_minutes              int not null default 15,
  consecutive_fails           int not null default 0,
  last_polled_at              timestamptz,
  next_poll_at                timestamptz,
  status                      text not null default 'discovered' check (status in (
    'discovered','pending_review','live','deprecated','blocked'
  )),
  notes                       text,
  created_at                  timestamptz not null default now(),
  unique (url_ko)
);

create index if not exists announcement_sources_status_next_poll_idx
  on public.announcement_sources (status, next_poll_at);

alter table public.announcement_sources enable row level security;
drop policy if exists announcement_sources_admin_only on public.announcement_sources;
create policy announcement_sources_admin_only on public.announcement_sources
  for select using (false);     -- service_role bypasses; anon/auth blocked

-- ----------------------------------------------------------------------------
--  announcements
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id                       uuid primary key default gen_random_uuid(),
  source_id                uuid not null references public.announcement_sources(id) on delete cascade,
  external_post_id         text,
  title_ko                 text not null,
  url_ko                   text not null,
  attachments              jsonb,         -- [{filename, hash, size, mime}]
  posted_at                timestamptz,
  detected_at              timestamptz not null default now(),
  classifier_label         text check (classifier_label in (
    'admission_announcement','correction_notice','schedule_change',
    'additional_recruitment','results_announcement','other','unknown'
  )),
  classifier_confidence    numeric(3,2),
  guideline_document_id    uuid references public.guideline_documents(id),
  unique (source_id, external_post_id)
);

create index if not exists announcements_source_detected_idx
  on public.announcements (source_id, detected_at desc);
create index if not exists announcements_classifier_idx
  on public.announcements (classifier_label);

alter table public.announcements enable row level security;
drop policy if exists announcements_admin_only on public.announcements;
create policy announcements_admin_only on public.announcements
  for select using (false);
