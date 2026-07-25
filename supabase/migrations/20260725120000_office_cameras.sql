-- Office camera surveillance: device registry + event log.
--
-- ARCHITECTURE NOTE — read before extending this.
--
-- The Xiaomi C300/C301 have no RTSP and no ONVIF (confirmed by Xiaomi's own
-- support FAQ, KA-515565), so nothing in the cloud can talk to them directly.
-- An on-prem bridge (see camera-bridge/) logs into Mi Home, pulls the stream
-- over Xiaomi's P2P protocol via go2rtc, and re-serves it as RTSP/WebRTC.
--
-- Video NEVER leaves the office. Recordings and thumbnails stay on the bridge's
-- own disk; only event METADATA is mirrored into these tables so the CRM can
-- render a timeline. `clip_path` / `thumb_path` are paths on the bridge, NOT
-- public URLs — resolving them requires being able to reach the bridge.
--
-- Because the footage shows staff and students, both tables are owner/admin
-- only. Do not widen these policies to call_operator or document_handler
-- without a matching consent + retention decision.

create table if not exists public.cameras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  -- Mi Home device model, e.g. 'xiaomi.camera.c01a01' (C300),
  -- 'mxiang.camera.c301' (C301). Used to pick the go2rtc source template.
  model text,
  -- Mi Home device id ("did"). Needed by go2rtc and, later, by MIoT PTZ calls.
  did text,
  -- go2rtc stream name; the CRM builds its live-view URL from this.
  stream_key text not null unique,
  ptz_supported boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.camera_events (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.cameras(id) on delete cascade,
  -- Which producer wrote this row: 'frigate' (motion/object), 'manual', or an
  -- analyzer name once AI analysis is switched on.
  source text not null default 'frigate',
  -- The producer's own id, so re-polling the bridge is idempotent.
  external_id text,
  label text,
  score numeric,
  started_at timestamptz not null,
  ended_at timestamptz,
  clip_path text,
  thumb_path text,
  -- Filled in later by whichever analyzer the agency chooses.
  ai_summary text,
  ai_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists camera_events_camera_started_idx
  on public.camera_events (camera_id, started_at desc);
create index if not exists camera_events_started_idx
  on public.camera_events (started_at desc);

drop trigger if exists set_cameras_updated_at on public.cameras;
create trigger set_cameras_updated_at
  before update on public.cameras
  for each row execute function public.update_updated_at_column();

alter table public.cameras enable row level security;
alter table public.camera_events enable row level security;

-- Owner/admin only, on every verb. The bridge agent writes with the service
-- role key, which bypasses RLS, so it needs no policy of its own.
drop policy if exists "Owners and admins manage cameras" on public.cameras;
create policy "Owners and admins manage cameras"
  on public.cameras
  for all
  to authenticated
  using (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role)
  )
  with check (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role)
  );

drop policy if exists "Owners and admins manage camera events" on public.camera_events;
create policy "Owners and admins manage camera events"
  on public.camera_events
  for all
  to authenticated
  using (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role)
  )
  with check (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Live event feed in the CRM.
alter publication supabase_realtime add table public.camera_events;
