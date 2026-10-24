-- ─────────────────────────────────────────────────────────────────────────────
-- Schema-drift repair — backfill objects that live only on the hosted project.
--
-- A handful of objects were created directly on the hosted Supabase project (via
-- the dashboard / SQL editor) and were never captured as migrations, yet LATER
-- migrations reference them (RLS policies, GRANTs, a function body). On a fresh
-- database — `supabase db reset` for local development, a preview branch, or a
-- brand-new staging project — those forward references abort the reset because
-- the objects do not exist yet.
--
-- This migration recreates the missing objects so the full migration history
-- applies cleanly on an empty database. Every statement is guarded
-- (IF NOT EXISTS / to_regprocedure), so on the hosted project — where these
-- objects already exist — it is a complete no-op and never overwrites the real
-- definitions.
--
-- Placed at 2026-01-04 09:00 so it runs after the base profiles/user_roles
-- migration (…073858) and before the first forward reference (…20260126161437).
--
-- Backfilled (all in schema public):
--   • table    student_budgets    — referenced by policies in 20260126161437
--   • table    finance_audit_log  — referenced by a policy in 20260611000000
--   • column   profiles.role      — referenced by search_students in 20260612000000
--   • function finance_audit_log_fn(), fn_delete_my_account(), get_regional_stats()
--                                 — referenced by GRANT/REVOKE in 20260611000100
--
-- Column shapes were taken from the committed src/integrations/supabase/types.ts
-- (generated from the hosted schema) and the legacy_export_v2.json data dump.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── extensions (drift) ──────────────────────────────────────────────────────
-- PGroonga (multilingual full-text search) is enabled on hosted via the
-- dashboard and used by the comms/document full-text migrations (…20260606150000,
-- …20260606160000) through `USING pgroonga` indexes and the `&@~` operator, but
-- no migration enables it. It ships in the Supabase Postgres image, so enabling
-- it here lets those later migrations apply on a fresh database.
create extension if not exists pgroonga with schema extensions;

-- ── student_budgets ─────────────────────────────────────────────────────────
create table if not exists public.student_budgets (
  id                        uuid primary key default gen_random_uuid(),
  student_id                uuid,
  category                  text,
  allocated_amount          numeric,
  spent_amount              numeric default 0,
  currency                  text default 'UZS',
  status                    text default 'allocated',
  allocated_from_payment_id uuid,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
alter table public.student_budgets enable row level security;

-- ── finance_audit_log ───────────────────────────────────────────────────────
create table if not exists public.finance_audit_log (
  id         uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id     uuid not null,
  op         text not null,
  before     jsonb,
  after      jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
alter table public.finance_audit_log enable row level security;

-- ── profiles drift columns ──────────────────────────────────────────────────
-- These columns exist on hosted (added over time via the dashboard) but no
-- migration creates them, yet later migrations and the app read them. Adding
-- them here (IF NOT EXISTS, so a no-op on hosted) makes the local profiles table
-- match the generated types.ts schema. `role` is a free-text tag distinct from
-- the authoritative role model in public.user_roles (only read by search_students).
alter table public.profiles add column if not exists role                     text;
alter table public.profiles add column if not exists status                   text;
alter table public.profiles add column if not exists notes                    text;
alter table public.profiles add column if not exists university_notes         text;
alter table public.profiles add column if not exists office_location          text;
alter table public.profiles add column if not exists payment_plan             text;
alter table public.profiles add column if not exists contract_date            text;
alter table public.profiles add column if not exists dob                      text;
alter table public.profiles add column if not exists additional_phone         text;
alter table public.profiles add column if not exists ielts_score              numeric;
alter table public.profiles add column if not exists korean_region_preference text;
alter table public.profiles add column if not exists study_work_priority      text;
alter table public.profiles add column if not exists language_track_source    text;
alter table public.profiles add column if not exists region_source            text;
alter table public.profiles add column if not exists parental_email           text;
alter table public.profiles add column if not exists marketing_consent        boolean not null default false;
alter table public.profiles add column if not exists marketing_consent_at     timestamptz;
alter table public.profiles add column if not exists parental_consent         boolean not null default false;
alter table public.profiles add column if not exists sip1_label               text;
alter table public.profiles add column if not exists sip1_server              text;
alter table public.profiles add column if not exists sip1_port                text;
alter table public.profiles add column if not exists sip1_user                text;
alter table public.profiles add column if not exists sip1_password            text;
alter table public.profiles add column if not exists sip2_label               text;
alter table public.profiles add column if not exists sip2_server              text;
alter table public.profiles add column if not exists sip2_port                text;
alter table public.profiles add column if not exists sip2_user                text;
alter table public.profiles add column if not exists sip2_password            text;

-- ── functions ───────────────────────────────────────────────────────────────
-- Guarded so this never replaces the real hosted implementations: each is created
-- only when it is absent (i.e. on a fresh local/branch database).
do $repair$
begin
  -- Generic finance audit trigger function. No migration attaches it to a trigger,
  -- so locally it exists to satisfy the GRANT/REVOKE only; the body is written to
  -- be correct if it is ever wired to a trigger on a table with a uuid `id`.
  if to_regprocedure('public.finance_audit_log_fn()') is null then
    execute $func$
      create function public.finance_audit_log_fn()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        insert into public.finance_audit_log (table_name, row_id, op, before, after, changed_by)
        values (
          tg_table_name,
          coalesce((case when tg_op = 'DELETE' then old.id else new.id end), gen_random_uuid()),
          tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end,
          auth.uid()
        );
        return case when tg_op = 'DELETE' then old else new end;
      end
      $body$;
    $func$;
  end if;

  -- Lets a signed-in user delete their own account (Google Play "Data safety"
  -- account-deletion flow). Cascades to profiles / user_roles via FK ON DELETE CASCADE.
  if to_regprocedure('public.fn_delete_my_account()') is null then
    execute $func$
      create function public.fn_delete_my_account()
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        if auth.uid() is null then
          raise exception 'not authenticated';
        end if;
        delete from auth.users where id = auth.uid();
      end
      $body$;
    $func$;
  end if;

  -- Student counts grouped by region/city, as a jsonb array. Body is resolved at
  -- call time (well after every migration), so referencing profiles.city is fine.
  if to_regprocedure('public.get_regional_stats()') is null then
    execute $func$
      create function public.get_regional_stats()
      returns jsonb
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare result jsonb;
      begin
        select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
          into result
        from (
          select coalesce(nullif(btrim(city), ''), 'Unknown') as region,
                 count(*)                                      as student_count
          from public.profiles p
          where not exists (
            select 1 from public.user_roles ur where ur.user_id = p.user_id
          )
          group by 1
          order by count(*) desc
        ) t;
        return coalesce(result, '[]'::jsonb);
      end
      $body$;
    $func$;
  end if;
end
$repair$;
