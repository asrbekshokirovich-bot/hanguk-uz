-- App analytics, plan R0 (2026-11-05, claude/ilova-rivojlantirish-reja.md):
-- what the app could not yet tell.
--
-- * data_ready (new): once per run per public read (catalogue, map, rules) —
--   where the first screen's rows came from (memory, the saved or shipped
--   copy, the network, or a failure), how long it took, how many rows and,
--   for a saved copy, how old it was (R0.6, R1.1).
-- * ai_chat (new): one per question to the app's AI chat — ok / empty /
--   error, the HTTP status, the wait for the first words and for the whole
--   answer, the question's length (not its text) and its turn (R0.8).
-- * app_error: + code (a Firebase plugin's code, an auth error's status) and
--   at (the file:line it was thrown from) — 36 FirebaseException and 80
--   AuthRetryableFetchException in ten days carried only their type (R1.4).
-- * document_upload: + result, error, code — a failed upload was not sent at
--   all (R0.9).
-- * share, account_delete: + result; the app now sends them, with sign_out
--   (R0.11).

insert into public.app_event_types (event, family, description_uz, props, status, added_in) values
  ('data_ready', 'quality', 'Katalog/xarita/qoidalar birinchi marta tayyor bo''ldi (manba, vaqt)',
   '{name,source,ms,rows,age_h}', 'active', '1.1.3'),
  ('ai_chat', 'contact', 'AI chatga savol (natija, kutish vaqti)',
   '{result,status,first_ms,ms,chars,turn}', 'active', '1.1.3')
on conflict (event) do update set
  family = excluded.family, description_uz = excluded.description_uz,
  props = excluded.props, status = excluded.status;

update public.app_event_types set props = '{type,lib,fatal,code,at}' where event = 'app_error';
update public.app_event_types set props = '{type,result,error,code}' where event = 'document_upload';
update public.app_event_types set props = '{what,result}' where event = 'share';
update public.app_event_types set props = '{result}' where event = 'account_delete';
