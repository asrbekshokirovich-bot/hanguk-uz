-- Ofis kameralari (lokal variant, PR-B). Umumiy ko'rinish: docs/kameralar.md
--
--   cameras            — CRM'dagi kamera nomlari. id = go2rtc oqim nomi = camera-gate CAMERAS dagi nom.
--   camera_access      — owner'dan tashqari kim ko'radi. Faqat owner beradi va oladi (qaror D1, 2026-11-03).
--   camera_access_log  — har kalit berilishi: kim, qachon, qaysi kameralar, IP. 90 kun; faqat owner o'qiydi.
--   has_camera_access() — chaqirgan xodim uchun: owner yoki camera_access'da bor.
--
-- Kalitni edge camera-session beradi (CAMERA_GATE_SECRET bilan imzolaydi) va jurnalga o'zi yozadi
-- (service_role). Video Supabase'dan o'tmaydi: u ofis serveridan (cam.hanguk.uz) keladi.

-- 1. Kameralar ro'yxati -------------------------------------------------------
create table if not exists public.cameras (
  id         text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  name       text not null check (length(btrim(name)) between 1 and 60),
  sort       integer not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cameras is
  'Ofis kameralari: id = go2rtc oqim nomi (camera-gate CAMERAS). Nom va tartib CRM → Sozlamalar → Kameralar.';

drop trigger if exists update_cameras_updated_at on public.cameras;
create trigger update_cameras_updated_at
  before update on public.cameras
  for each row execute function public.update_updated_at_column();

-- 2. Kim ko'radi ---------------------------------------------------------------
create table if not exists public.camera_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now()
);

comment on table public.camera_access is
  'Owner''dan tashqari kameralarni ko''radigan xodimlar. Faqat owner beradi va oladi.';

-- 3. Jurnal --------------------------------------------------------------------
create table if not exists public.camera_access_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  camera_ids text[] not null,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists camera_access_log_created_at_idx on public.camera_access_log (created_at desc);

comment on table public.camera_access_log is
  'Har kamera kaliti berilishi (camera-session yozadi). 90 kun saqlanadi; faqat owner o''qiydi.';

-- 4. Ruxsat funksiyasi ---------------------------------------------------------
-- Faqat chaqirgan odam uchun javob beradi: boshqa xodimning ruxsatini owner camera_access'dan ko'radi.
create or replace function public.has_camera_access()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select (select auth.uid()) is not null and (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or exists (select 1 from public.camera_access a where a.user_id = (select auth.uid()))
  )
$$;

revoke all on function public.has_camera_access() from public, anon;
grant execute on function public.has_camera_access() to authenticated, service_role;

-- 5. RLS -----------------------------------------------------------------------
alter table public.cameras enable row level security;
alter table public.camera_access enable row level security;
alter table public.camera_access_log enable row level security;

revoke all on public.cameras, public.camera_access, public.camera_access_log from anon;

drop policy if exists "cameras_read" on public.cameras;
create policy "cameras_read" on public.cameras
  for select to authenticated
  using (public.has_camera_access());

drop policy if exists "cameras_manage" on public.cameras;
create policy "cameras_manage" on public.cameras
  for all to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role))
  with check (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- O'z qatorini ko'radi (CRM menyu bandi uchun), owner hammasini.
drop policy if exists "camera_access_read" on public.camera_access;
create policy "camera_access_read" on public.camera_access
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'owner'::public.app_role)
  );

drop policy if exists "camera_access_manage" on public.camera_access;
create policy "camera_access_manage" on public.camera_access
  for all to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role))
  with check (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- Jurnalni faqat owner o'qiydi; yozish faqat service_role (camera-session), o'zgartirib bo'lmaydi.
drop policy if exists "camera_access_log_read" on public.camera_access_log;
create policy "camera_access_log_read" on public.camera_access_log
  for select to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role));

revoke insert, update, delete, truncate on public.camera_access_log from authenticated;

-- 6. Jurnalni tozalash: har kuni 02:40 Toshkent (21:40 UTC), 90 kundan eski yozuvlar --------------
select cron.unschedule('camera-access-log-retention')
 where exists (select 1 from cron.job where jobname = 'camera-access-log-retention');
select cron.schedule('camera-access-log-retention', '40 21 * * *', $c$
  delete from public.camera_access_log where created_at < now() - interval '90 days'
$c$);
