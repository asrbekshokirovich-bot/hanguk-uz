-- Generic key/value store for large binary assets that edge functions need at
-- runtime (e.g. the certified-translation .docx templates), kept out of the
-- function bundle. Values are base64 text. Service-role only — never exposed to
-- anon/authenticated via the REST API.
create table if not exists public.app_assets (
  key text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_assets enable row level security;

-- No anon/authenticated policies: only the service role (edge functions) reads it.
-- (RLS enabled with no policy = deny all for anon/authenticated; service role bypasses RLS.)
