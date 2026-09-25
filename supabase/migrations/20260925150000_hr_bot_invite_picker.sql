-- HR bot: interview invitations are now built from buttons (date, then time)
-- plus an address that can be typed text, a map pin, or both.
--
-- hr_candidates.interview_at        the interview moment, for sorting and
--                                   future reminders (interview_info stays the
--                                   human-readable line shown on cards)
-- hr_candidates.interview_location  {text, lat, lon} sent to the candidate
-- hr_admins.last_address            {text, lat, lon} of the admin's previous
--                                   invitation, offered as "♻️ Oldingi manzil"

alter table public.hr_candidates
  add column if not exists interview_at       timestamptz,
  add column if not exists interview_location jsonb;

alter table public.hr_admins
  add column if not exists last_address jsonb;
