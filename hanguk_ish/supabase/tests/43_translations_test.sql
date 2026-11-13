-- P55: what is written waits for the translator (ish.translation_queue);
-- what comes back is written only for the text it was made from; nobody but
-- the service role (ish-translate) reaches the queue; asking the function
-- never fails a write.
--
-- People (fixtures): a1 Aziz — worker on application …0004 (s4 of biz1);
-- b1 Seoyeon — owner of biz1.
select tests.as_admin();

-- The fixtures' shifts and businesses wait (written without translations).
select tests.eq((select count(*)::int from ish.translation_queue q join ish.shifts s on q.kind = 'shift' and q.ref = s.id::text),
                8, 'every new shift waits');
select tests.eq((select count(*)::int from ish.translation_queue q join ish.businesses b on q.kind = 'business' and q.ref = b.id::text),
                2, 'every new business waits');

-- A worker writes: the message waits.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ish.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', 'Salom! Ertaga 10:00 da kelaman');
-- The owner writes in Korean (the app marks it so).
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.messages (application_id, body, lang) values ('30000000-0000-0000-0000-000000000004', '네, 내일 봬요', 'ko');
select tests.as_admin();
create temp table m1 as select id from ish.messages where body = 'Salom! Ertaga 10:00 da kelaman';
create temp table m2 as select id from ish.messages where body = '네, 내일 봬요';
grant select on m1, m2 to authenticated, anon;
select tests.ok(exists (select 1 from ish.translation_queue where kind = 'message' and ref = (select id::text from m1)),
                'the worker''s message waits');
select tests.ok(exists (select 1 from ish.translation_queue where kind = 'message' and ref = (select id::text from m2)),
                'and the owner''s');

-- Written with its translations (a copy): nothing to do.
insert into ish.messages (application_id, sender_id, body, lang, translations)
values ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1', '수고하셨어요', 'ko',
        '{"uz": "Rahmat, yaxshi ishladingiz"}');
select tests.ok(not exists (select 1 from ish.translation_queue q join ish.messages m on q.kind = 'message' and q.ref = m.id::text
                            where m.body = '수고하셨어요'),
                'a message written with its translations does not wait');

-- Taking: every due row with its texts, each try counted and the next one
-- a minute later.
create temp table c1 as select * from ish.translation_claim(50);
select tests.eq((select count(*)::int from c1), (select count(*)::int from ish.translation_queue), 'everything due is taken');
select tests.eq((select texts from c1 where kind = 'message' and ref = (select id::text from m1)),
                '{"body": "Salom! Ertaga 10:00 da kelaman", "lang": null}'::jsonb, 'a message: its text, no language yet');
select tests.eq((select texts ->> 'lang' from c1 where kind = 'message' and ref = (select id::text from m2)),
                'ko', 'the language the app gave');
select tests.eq((select texts from c1 where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000001'),
                '{"title": "홀·카운터 보조", "duties": "주문 접수", "dress": "", "address": ""}'::jsonb, 'a shift: its four texts');
select tests.eq((select texts from c1 where kind = 'business' and ref = '10000000-0000-0000-0000-000000000001'),
                '{"name": "달빛카페 신촌점", "area": "", "address": "마포구 신촌로12길 15, 2층", "address_detail": ""}'::jsonb,
                'a business: its name and place');
select tests.ok((select bool_and(attempts = 1 and hash = md5(texts::text)) from c1), 'each try is counted, with the texts'' hash');
select tests.ok((select bool_and(next_at = now() + interval '1 minute') from ish.translation_queue), 'the next try is a minute later');
select tests.eq((select count(*)::int from ish.translation_claim(50)), 0, 'nothing is due before then');

-- A message's translation: saved with the language found, off the queue.
select tests.ok(ish.translation_save('message', (select id::text from m1), (select hash from c1 where ref = (select id::text from m1)),
                                     'uz', '{"ru": "Привет! Завтра приду в 10:00", "en": "Hi! I will come tomorrow at 10:00",
                                             "ko": "안녕하세요! 내일 10시에 갈게요"}'),
                'the translation is saved');
select tests.eq((select lang || '|' || (translations ->> 'ko') from ish.messages where id = (select id from m1)),
                'uz|안녕하세요! 내일 10시에 갈게요', 'with the language found and the translations');
select tests.ok(not exists (select 1 from ish.translation_queue where kind = 'message' and ref = (select id::text from m1)),
                'off the queue');
-- The app's language stays.
select tests.ok(ish.translation_save('message', (select id::text from m2), (select hash from c1 where ref = (select id::text from m2)),
                                     'uz', '{"uz": "Ha, ertaga ko''rishamiz"}'), 'the owner''s');
select tests.eq((select lang from ish.messages where id = (select id from m2)), 'ko', 'its language is the app''s');
-- The read mark changes nothing.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update ish.messages set read_at = now() where id = (select id from m1);
select tests.as_admin();
select tests.ok(not exists (select 1 from ish.translation_queue where kind = 'message'), 'reading does not queue a message again');

-- A shift whose text changes after it was taken: the old translation is
-- refused, the new text waits from the start.
update ish.shifts set title = '홀 서빙' where id = '20000000-0000-0000-0000-000000000001';
select tests.ok(not ish.translation_save('shift', '20000000-0000-0000-0000-000000000001',
                                         (select hash from c1 where ref = '20000000-0000-0000-0000-000000000001'), 'ko',
                                         '{"uz": {"title": "Zal va kassa yordamchisi"}}'),
                'a translation of the old text is refused');
select tests.eq((select translations from ish.shifts where id = '20000000-0000-0000-0000-000000000001'), '{}'::jsonb,
                'nothing is written');
select tests.eq((select attempts::int from ish.translation_queue where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000001'),
                0, 'the new text waits, from the start');
-- Only the four texts count.
update ish.translation_queue set attempts = 3 where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000002';
update ish.shifts set slots = 2, hourly_wage = 11500 where id = '20000000-0000-0000-0000-000000000002';
select tests.eq((select attempts::int from ish.translation_queue where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000002'),
                3, 'slots or wage are not a new text');
update ish.translation_queue set attempts = 1 where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000002';

-- A shift's translation, as the worker reads it (A05).
select tests.ok(ish.translation_save('shift', '20000000-0000-0000-0000-000000000002',
                                     (select hash from c1 where ref = '20000000-0000-0000-0000-000000000002'), 'ko',
                                     '{"uz": {"title": "Yopilishda tozalash yordamchisi"}, "ru": {"title": "Помощник по уборке при закрытии"},
                                       "en": {"title": "Closing clean-up helper"}}'),
                'a shift''s translation is saved');
select tests.ok(not exists (select 1 from ish.translation_queue where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000002'),
                'off the queue, and saving it does not queue it again');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(ish.shift_details('20000000-0000-0000-0000-000000000002') -> 'translations' -> 'ru' ->> 'title',
                'Помощник по уборке при закрытии', 'the worker''s A05 shows it');
select tests.as_admin();

-- A business: the name the staff typed (uz) stays, the others are added.
select tests.ok(ish.translation_save('business', '10000000-0000-0000-0000-000000000001',
                                     (select hash from c1 where ref = '10000000-0000-0000-0000-000000000001'), 'ko',
                                     '{"uz": {"address": "Mapo-gu, Sinchon-ro 12-gil 15, 2-qavat"},
                                       "en": {"address": "Sinchon-ro 12-gil 15, Mapo-gu, 2F"}}',
                                     '{"uz": "Dalbit Kafe", "ru": "Dalbit Kafe Sinchon", "en": "Dalbit Cafe Sinchon"}'),
                'a business''s translation is saved');
select tests.eq((select name_i18n from ish.businesses where id = '10000000-0000-0000-0000-000000000001'),
                '{"uz": "Dalbit Kafe · Sinchon", "ru": "Dalbit Kafe Sinchon", "en": "Dalbit Cafe Sinchon"}'::jsonb,
                'the staff''s name stays; the others are added');
select tests.eq((select translations -> 'en' ->> 'address' from ish.businesses where id = '10000000-0000-0000-0000-000000000001'),
                'Sinchon-ro 12-gil 15, Mapo-gu, 2F', 'and the address');
select tests.ok(not exists (select 1 from ish.translation_queue where kind = 'business' and ref = '10000000-0000-0000-0000-000000000001'),
                'off the queue, and saving it does not queue it again');
update ish.businesses set name_i18n = name_i18n || '{"uz": "Dalbit"}' where id = '10000000-0000-0000-0000-000000000001';
select tests.ok(not exists (select 1 from ish.translation_queue where kind = 'business' and ref = '10000000-0000-0000-0000-000000000001'),
                'a name the staff type is not a new text');
update ish.businesses set name = '달빛카페 홍대점' where id = '10000000-0000-0000-0000-000000000001';
select tests.eq((select attempts::int from ish.translation_queue where kind = 'business' and ref = '10000000-0000-0000-0000-000000000001'),
                0, 'a new Korean name is');
select tests.throws($$select ish.translation_save('nothing', '1', 'x', 'uz', '{}')$$, 'INVALID', 'an unknown kind is refused');

-- Gone before it was translated: dropped when taken.
delete from ish.shifts where id = '20000000-0000-0000-0000-000000000008';
update ish.translation_queue set next_at = now() where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000008';
select tests.ok(not exists (select 1 from ish.translation_claim(50) where ref = '20000000-0000-0000-0000-000000000008'),
                'a deleted shift is not taken');
select tests.ok(not exists (select 1 from ish.translation_queue where ref = '20000000-0000-0000-0000-000000000008'),
                'and leaves the queue');

-- Retries: 1, 2, 4 … minutes, at most an hour; after 10 tries the row stays
-- as a record and is not taken again.
update ish.translation_queue set attempts = 5, next_at = now() where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000003';
select tests.eq((select attempts from ish.translation_claim(50) where ref = '20000000-0000-0000-0000-000000000003'), 6, 'the 6th try');
select tests.eq((select next_at from ish.translation_queue where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000003'),
                now() + interval '32 minutes', 'the next one in 32 minutes');
update ish.translation_queue set attempts = 9, next_at = now() where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000003';
select tests.eq((select attempts from ish.translation_claim(50) where ref = '20000000-0000-0000-0000-000000000003'), 10, 'the 10th try');
select tests.eq((select next_at from ish.translation_queue where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000003'),
                now() + interval '1 hour', 'at most an hour apart');
select ish.translation_fail('shift', '20000000-0000-0000-0000-000000000003', 'no items in the answer');
update ish.translation_queue set next_at = now() where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000003';
select tests.eq((select count(*)::int from ish.translation_claim(50) where ref = '20000000-0000-0000-0000-000000000003'), 0,
                'after 10 tries it is not taken again');
select tests.eq((select last_error from ish.translation_queue where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000003'),
                'no items in the answer', 'why the last try failed is kept');
-- A new text starts over.
update ish.shifts set duties = '테이블 정리' where id = '20000000-0000-0000-0000-000000000003';
select tests.eq((select attempts::int || '|' || coalesce(last_error, '-') from ish.translation_queue
                 where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000003'), '0|-', 'a new text starts over');
-- The minute job drops what was given up a month ago, and keeps the rest.
update ish.translation_queue set attempts = 10, queued_at = now() - interval '31 days'
where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000004';
update ish.translation_queue set attempts = 10, queued_at = now() - interval '29 days'
where kind = 'shift' and ref = '20000000-0000-0000-0000-000000000005';
select ish.translation_tick();
select tests.ok(not exists (select 1 from ish.translation_queue where ref = '20000000-0000-0000-0000-000000000004'),
                'given up a month ago: gone');
select tests.ok(exists (select 1 from ish.translation_queue where ref = '20000000-0000-0000-0000-000000000005'),
                'given up this month: kept');

-- Asking ish-translate (pg_net and the vault key; stand-ins here — on a
-- Supabase stack the real ones are there and nothing is checked).
do $$
begin
  if to_regnamespace('net') is not null or to_regnamespace('vault') is not null then
    raise notice 'pg_net / vault present: the call itself is not checked here';
    return;
  end if;
  create schema net;
  create table net.calls (url text, body jsonb, headers jsonb, timeout_milliseconds int);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                                headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $f$
    insert into net.calls values (url, body, headers, timeout_milliseconds) returning 1::bigint
  $f$;
  create schema vault;
  create table vault.decrypted_secrets (name text, decrypted_secret text);

  perform ish.translation_kick();
  perform tests.eq((select count(*)::int from net.calls), 0, 'no key: nothing is sent');

  insert into vault.decrypted_secrets values ('secret_key', 'sb_secret_test');
  perform ish.translation_kick();
  perform tests.eq((select count(*)::int from net.calls), 1, 'something due and the key: one call');
  perform tests.eq((select url || ' ' || (headers ->> 'apikey') from net.calls),
                   'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/ish-translate sb_secret_test',
                   'to ish-translate, with the secret key');

  -- One call per statement, however many rows it writes.
  delete from net.calls;
  perform tests.as_user('00000000-0000-0000-0000-0000000000a1');
  insert into ish.messages (application_id, body)
  select '30000000-0000-0000-0000-000000000004', t from unnest(array['Bir', 'Ikki']) t;
  perform tests.as_admin();
  perform tests.eq((select count(*)::int from net.calls), 1, 'two messages in one statement: one call');

  -- Nothing due: nothing is sent.
  delete from net.calls;
  update ish.translation_queue set next_at = now() + interval '1 hour';
  perform ish.translation_kick();
  perform tests.eq((select count(*)::int from net.calls), 0, 'nothing due: no call');

  -- A failing call does not fail the write.
  create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                                           headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language plpgsql as $f$ begin raise exception 'pg_net is down'; end $f$;
  perform tests.as_user('00000000-0000-0000-0000-0000000000a1');
  insert into ish.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', 'Uch');
  perform tests.as_admin();
  perform tests.ok(exists (select 1 from ish.messages where body = 'Uch'), 'the message is sent anyway');
end
$$;

-- Nobody but the service role.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select count(*) from ish.translation_queue$$, 'permission denied', 'a worker cannot read the queue');
select tests.throws($$select * from ish.translation_claim(1)$$, 'permission denied', 'nor take from it');
select tests.throws($$select ish.translation_save('message', (select id::text from m1), 'x', 'uz', '{}')$$, 'permission denied',
                    'nor write a translation');
select tests.throws($$select ish.translation_fail('message', '1', 'x')$$, 'permission denied', 'nor mark a failure');
select tests.throws($$select ish.translation_kick()$$, 'permission denied', 'nor call the translator');
select tests.throws($$select ish.translation_tick()$$, 'permission denied', 'nor run the minute job');
select tests.throws($$select ish.translation_source(m) from ish.messages m$$, 'permission denied', 'nor read the hash source');
select tests.throws($$update ish.messages set translations = '{"uz": "x"}' where id = (select id from m1)$$, 'permission denied',
                    'nor write a message''s translations');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$update ish.shifts set translations = '{"uz": {"title": "x"}}' where id = '20000000-0000-0000-0000-000000000002'$$,
                    'permission denied', 'an owner cannot write a shift''s translations');
select tests.as_anon();
select tests.throws($$select count(*) from ish.translation_queue$$, 'permission denied', 'nor anybody signed out');
select tests.throws($$select * from ish.translation_claim(1)$$, 'permission denied', 'who cannot take from it either');
select tests.as_admin();
set local role service_role;
select tests.ok((select count(*) >= 0 from ish.translation_claim(1)), 'the service role takes from the queue');
select tests.ok(not ish.translation_save('message', '0', 'x', 'uz', '{}'), 'and writes (a row that is not there: false)');
select tests.as_admin();
