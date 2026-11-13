-- P57: a business the 사장님 app opens and a worker's complaint become a
-- Telegram message to the staff (ish.staff_alerts → ish-staff-alerts); the
-- businesses the staff keep do not; a message that fails goes again; nobody
-- but the service role reaches the outbox.
--
-- People: c1 — staff; a1 — a worker on application …0004 (s4 of biz1); the
-- fixtures' biz1 and biz2 were opened from the app.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000c1', '+821000000031');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000c1');

-- The app's businesses wait to be told; the one the staff keep does not.
select tests.eq((select count(*)::int from ish.staff_alerts a join ish.businesses b on a.ref = b.id
                 where a.kind = 'business_opened'), 2, 'the two app businesses');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
create temp table kept as select ish.staff_save_business(null, '공사 현장 A') as id;
grant select on kept to authenticated, anon;
select tests.as_admin();
select tests.ok(not exists (select 1 from ish.staff_alerts where ref = (select id from kept)),
                'an employer the staff keep is not news to them');

-- A complaint (A11).
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ish.reports (application_id, reason, body)
values ('30000000-0000-0000-0000-000000000004', 'payment', 'Ish haqi hali to''lanmadi');
select tests.as_admin();
create temp table rep as select id from ish.reports where body = 'Ish haqi hali to''lanmadi';
grant select on rep to authenticated, anon;
select tests.ok(exists (select 1 from ish.staff_alerts where kind = 'report' and ref = (select id from rep)),
                'the complaint waits to be told');

-- Taking: what the message says, each try counted, the next a minute later.
create temp table c1 as select * from ish.staff_alerts_claim(50);
select tests.eq((select count(*)::int from c1), 3, 'all three are due');
select tests.eq((select data ->> 'name' || '|' || (data ->> 'name_uz') || '|' || (data ->> 'category') from c1
                 where kind = 'business_opened' and data ->> 'name' = '달빛카페 신촌점'),
                '달빛카페 신촌점|Dalbit Kafe · Sinchon|cafe', 'a business: its name, the workers'' name, its kind');
select tests.eq((select data #>> '{worker,first_name}' || ' ' || (data #>> '{worker,last_name}') from c1 where kind = 'report'),
                'Aziz Karimov', 'a complaint: who wrote it');
select tests.eq((select data ->> 'reason' || '|' || (data ->> 'body') from c1 where kind = 'report'),
                'payment|Ish haqi hali to''lanmadi', 'its subject and text');
select tests.eq((select data #>> '{business,name}' || '|' || (data #>> '{shift,title}') from c1 where kind = 'report'),
                '달빛카페 신촌점|홀·카운터 보조', 'about which business and shift (through the application)');
select tests.ok((select bool_and(attempts = 1) from c1), 'each try is counted');
select tests.ok((select bool_and(next_at = now() + interval '1 minute') from ish.staff_alerts where sent_at is null),
                'the next try a minute later');
select tests.eq((select count(*)::int from ish.staff_alerts_claim(50)), 0, 'nothing is due before then');

-- Sent: done. Failed: why is kept, and it goes again at its time.
select ish.staff_alerts_done((select id from c1 where kind = 'report'));
select tests.ok((select sent_at is not null from ish.staff_alerts where kind = 'report'), 'sent');
select ish.staff_alerts_fail((select id from c1 where data ->> 'name' = '이음식당'), 'Telegram: chat not found');
select tests.eq((select last_error from ish.staff_alerts a join ish.businesses b on a.ref = b.id where b.name = '이음식당'),
                'Telegram: chat not found', 'why it failed');
update ish.staff_alerts set next_at = now();
select tests.eq((select array_agg(kind order by kind) from ish.staff_alerts_claim(50)), array['business_opened', 'business_opened'],
                'the unsent go again; the sent one does not');
-- After 8 tries it is not taken again.
update ish.staff_alerts set attempts = 7, next_at = now() where sent_at is null;
select tests.eq((select count(*)::int from ish.staff_alerts_claim(50)), 2, 'the 8th try');
update ish.staff_alerts set next_at = now() where sent_at is null;
select tests.eq((select count(*)::int from ish.staff_alerts_claim(50)), 0, 'then no more');

-- Gone before it was told: nothing to say.
update ish.staff_alerts set attempts = 0, next_at = now() where sent_at is null;
delete from ish.businesses where id = '10000000-0000-0000-0000-000000000002';
select tests.eq((select count(*)::int from ish.staff_alerts_claim(50)), 1, 'only the business still there');
select tests.eq((select last_error from ish.staff_alerts where ref = '10000000-0000-0000-0000-000000000002'), 'gone',
                'the deleted one is closed as gone');

-- The minute job: what was sent a month ago goes; the rest stays.
update ish.staff_alerts set created_at = now() - interval '31 days' where kind = 'report';
select ish.staff_alerts_tick();
select tests.ok(not exists (select 1 from ish.staff_alerts where kind = 'report'), 'sent a month ago: gone');
select tests.ok(exists (select 1 from ish.staff_alerts where ref = '10000000-0000-0000-0000-000000000001'), 'the rest stays');

-- Asking ish-staff-alerts (pg_net and the vault key; stand-ins here — on a
-- Supabase stack the real ones are there and nothing is checked).
do $$
begin
  if to_regnamespace('net') is not null or to_regnamespace('vault') is not null then
    raise notice 'pg_net / vault present: the call itself is not checked here';
    return;
  end if;
  create schema net;
  create table net.calls (url text, headers jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                                headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $f$ insert into net.calls values (url, headers) returning 1::bigint $f$;
  create schema vault;
  create table vault.decrypted_secrets (name text, decrypted_secret text);
  insert into vault.decrypted_secrets values ('secret_key', 'sb_secret_test');

  perform tests.as_user('00000000-0000-0000-0000-0000000000a1');
  insert into ish.reports (reason, body) values ('safety', 'Omborda dubulg''a berilmadi');
  perform tests.as_admin();
  perform tests.eq((select count(*)::int from net.calls where url like '%/functions/v1/ish-staff-alerts'), 1,
                   'a complaint: one call to ish-staff-alerts');
  perform tests.eq((select headers ->> 'apikey' from net.calls limit 1), 'sb_secret_test', 'with the secret key');

  -- The app opens a business (P50): the staff are asked about too.
  delete from net.calls;
  insert into auth.users (id, phone, raw_app_meta_data)
  values ('00000000-0000-0000-0000-0000000000f7', '+821000000077', '{"app": "hanguk_ish"}');
  perform tests.as_user('00000000-0000-0000-0000-0000000000f7');
  perform ish.open_business();
  perform tests.as_admin();
  perform tests.eq((select count(*)::int from net.calls where url like '%/functions/v1/ish-staff-alerts'), 1,
                   'a business from the app: one call');
end
$$;

-- Nobody but the service role.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.throws($$select count(*) from ish.staff_alerts$$, 'permission denied', 'not even the staff read the outbox');
select tests.throws($$select * from ish.staff_alerts_claim(1)$$, 'permission denied', 'nor take from it');
select tests.throws($$select ish.staff_alerts_done(1)$$, 'permission denied', 'nor mark one sent');
select tests.throws($$select ish.staff_alerts_fail(1, 'x')$$, 'permission denied', 'nor failed');
select tests.throws($$select ish.staff_alerts_tick()$$, 'permission denied', 'nor run the minute job');
select tests.throws($$select ish.staff_alert_data('report', (select id from rep))$$, 'permission denied',
                    'nor read what a message says');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select count(*) from ish.staff_alerts$$, 'permission denied', 'nor a worker');
select tests.as_anon();
select tests.throws($$select * from ish.staff_alerts_claim(1)$$, 'permission denied', 'nor anybody signed out');
select tests.as_admin();
set local role service_role;
select tests.ok((select count(*) >= 0 from ish.staff_alerts_claim(1)), 'the service role takes from the outbox');
select tests.as_admin();
