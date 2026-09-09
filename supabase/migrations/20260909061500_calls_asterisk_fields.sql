-- Fields the Asterisk feed needs and the Mediateka one never carried.
--
-- answered_at: Mediateka only reported a call's start and its end, so `duration`
-- was whatever the PBX chose to call duration. Asterisk sends a distinct Answer
-- event, which is the only way to tell ringing time from talk time — the number
-- that actually says how long the operator spoke.
--
-- recording_path: the object key inside the private call-recordings bucket. The
-- file is uploaded by the office PBX after hangup, so it arrives later than the
-- call row. recording_url still holds a fetchable URL for the transcription
-- worker; recording_path is what survives that URL expiring.
alter table public.calls
  add column if not exists answered_at    timestamptz,
  add column if not exists recording_path text;

comment on column public.calls.answered_at is
  'When the operator picked up (Asterisk Answer event). Null = never answered.';
comment on column public.calls.recording_path is
  'Object key in the private call-recordings storage bucket, once uploaded.';

-- Private bucket: recordings are student conversations, never public.
insert into storage.buckets (id, name, public)
values ('call-recordings', 'call-recordings', false)
on conflict (id) do nothing;

-- Only the service role writes (the PBX uploader authenticates as a secret key);
-- staff read through signed URLs the CRM mints, not by listing the bucket.
drop policy if exists call_recordings_staff_read on storage.objects;
create policy call_recordings_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'call-recordings'
    and exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role in ('owner', 'admin', 'call_operator')
    )
  );
