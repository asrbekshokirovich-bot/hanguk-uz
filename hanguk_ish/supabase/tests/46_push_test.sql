-- P56: a notification for someone with a phone registered for that app
-- waits for ish-push (ish.push_queue); what is read, stale or phone-less is
-- not pushed; tries are counted; a gone token is dropped; nobody but the
-- service role reaches the queue.
--
-- People (fixtures): a1 Aziz — worker; a2 Malika — worker without a phone
-- registered; b1 Seoyeon — owner of biz1 (language ko).
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.register_push_token('tok-aziz', 'worker');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.register_push_token('tok-seoyeon', 'employer');
select tests.as_admin();

create temp table n (label text, id bigint);
grant select on n to authenticated, anon;
with ins as (
  insert into ish.notifications (user_id, kind, data) values
    ('00000000-0000-0000-0000-0000000000a1', 'application_confirmed',
     '{"application_id": "30000000-0000-0000-0000-000000000004", "shift_id": "20000000-0000-0000-0000-000000000004"}'),
    ('00000000-0000-0000-0000-0000000000a1', 'payment_marked', '{"paid": false}'),
    ('00000000-0000-0000-0000-0000000000a1', 'chat_message', '{"business_id": "10000000-0000-0000-0000-000000000001"}'),
    ('00000000-0000-0000-0000-0000000000a2', 'application_confirmed', '{}'),
    ('00000000-0000-0000-0000-0000000000b1', 'new_applicant',
     '{"worker_id": "00000000-0000-0000-0000-0000000000a1", "shift_id": "20000000-0000-0000-0000-000000000001"}'),
    ('00000000-0000-0000-0000-0000000000b1', 'chat_message', '{"worker_id": "00000000-0000-0000-0000-0000000000a1"}'),
    ('00000000-0000-0000-0000-0000000000b1', 'shift_reminder', '{}')
  returning id, user_id, kind, data
)
insert into n select
  case when user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'payment_marked' then 'unpaid'
       when user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'chat_message' then 'chat-worker'
       when user_id = '00000000-0000-0000-0000-0000000000a1' then 'confirmed'
       when user_id = '00000000-0000-0000-0000-0000000000a2' then 'no-phone'
       when kind = 'new_applicant' then 'applicant'
       when kind = 'chat_message' then 'chat-owner'
       else 'owner-reminder' end, id
from ins;

-- What waits: each to the app that shows it, for someone with a phone there.
select tests.eq((select array_agg(n.label order by n.label) from n join ish.push_queue q on q.notification_id = n.id),
                array['applicant', 'chat-owner', 'chat-worker', 'confirmed'],
                'the confirmed shift, both chats and the applicant wait');
select tests.eq((select ish.push_app('chat_message', '{"worker_id": "x"}') || '|' || ish.push_app('chat_message', '{"business_id": "x"}')),
                'employer|worker', 'a chat message: to the business''s app or the worker''s');
select tests.ok(ish.push_app('payment_marked', '{"paid": false}') is null, 'pay not marked is not news');
select tests.ok(ish.push_app('something_new', '{}') is null, 'a kind no app shows');
-- (an owner's shift_reminder: a worker kind, and the owner has no worker phone)

-- Taking: its card, the reader's language and phones; each try counted.
create temp table c1 as select * from ish.push_claim(50);
select tests.eq((select count(*)::int from c1), 4, 'all four are due');
select tests.eq((select app || '|' || lang || '|' || array_to_string(tokens, ',') from c1
                 where id = (select id from n where label = 'confirmed')), 'worker|uz|tok-aziz', 'the worker''s');
select tests.eq((select app || '|' || lang || '|' || array_to_string(tokens, ',') from c1
                 where id = (select id from n where label = 'applicant')), 'employer|ko|tok-seoyeon', 'the owner''s, in Korean');
select tests.eq((select card -> 'business' ->> 'name' from c1 where id = (select id from n where label = 'confirmed')),
                '달빛카페 신촌점', 'the card names the business');
select tests.eq((select card #>> '{worker,first_name}' || ' / ' || (card #>> '{shift,title}') from c1
                 where id = (select id from n where label = 'applicant')), 'Aziz / 홀·카운터 보조', 'and the worker and shift');
select tests.ok((select bool_and(attempts = 1) from c1), 'each try is counted');
select tests.ok((select bool_and(next_at = now() + interval '1 minute') from ish.push_queue), 'the next try a minute later');
select tests.eq((select count(*)::int from ish.push_claim(50)), 0, 'nothing due before then');

-- Sent: off the queue. Refused: why is kept.
select ish.push_done((select id from n where label = 'confirmed'));
select ish.push_fail((select id from n where label = 'applicant'), 'FCM 503');
select tests.ok(not exists (select 1 from ish.push_queue where notification_id = (select id from n where label = 'confirmed')), 'sent');
select tests.eq((select last_error from ish.push_queue where notification_id = (select id from n where label = 'applicant')),
                'FCM 503', 'why it failed');

-- Read meanwhile, stale, or no phone left: not pushed, off the queue.
update ish.push_queue set next_at = now();
update ish.notifications set read_at = now() where id = (select id from n where label = 'chat-worker');
update ish.notifications set created_at = now() - interval '31 minutes' where id = (select id from n where label = 'chat-owner');
select tests.eq((select array_agg(id) from ish.push_claim(50)), array[(select id from n where label = 'applicant')],
                'only the unread, fresh one');
select tests.eq((select count(*)::int from ish.push_queue), 1, 'the read and the stale left the queue');
update ish.push_queue set next_at = now();
select ish.push_drop_token('tok-seoyeon');
select tests.ok(not exists (select 1 from ish.push_tokens where token = 'tok-seoyeon'), 'a gone token is dropped');
select tests.eq((select count(*)::int from ish.push_claim(50)), 0, 'no phone left: not pushed');
select tests.eq((select count(*)::int from ish.push_queue), 0, 'and off the queue');

-- Tries: 1, 2, 4, 8, 16 minutes; 5 at most.
insert into ish.notifications (user_id, kind, data) values ('00000000-0000-0000-0000-0000000000a1', 'job_offer', '{}');
create temp table offer as select max(id) as id from ish.notifications where kind = 'job_offer';
update ish.push_queue set attempts = 3, next_at = now() where notification_id = (select id from offer);
select tests.eq((select attempts from ish.push_claim(50)), 4, 'the 4th try');
select tests.eq((select next_at from ish.push_queue where notification_id = (select id from offer)), now() + interval '8 minutes',
                'the next one in 8 minutes');
update ish.push_queue set next_at = now() where notification_id = (select id from offer);
select tests.eq((select attempts from ish.push_claim(50)), 5, 'the 5th');
update ish.push_queue set next_at = now() where notification_id = (select id from offer);
select tests.eq((select count(*)::int from ish.push_claim(50)), 0, 'then no more');
-- The minute job drops what is a day old.
update ish.push_queue set created_at = now() - interval '25 hours';
select ish.push_tick();
select tests.eq((select count(*)::int from ish.push_queue), 0, 'a day old: gone');

-- Asking ish-push (pg_net and the vault key; stand-ins here — on a Supabase
-- stack the real ones are there and nothing is checked).
do $$
begin
  if to_regnamespace('net') is not null or to_regnamespace('vault') is not null then
    raise notice 'pg_net / vault present: the call itself is not checked here';
    return;
  end if;
  create schema net;
  create table net.calls (url text);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                                headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $f$ insert into net.calls values (url) returning 1::bigint $f$;
  create schema vault;
  create table vault.decrypted_secrets (name text, decrypted_secret text);
  insert into vault.decrypted_secrets values ('secret_key', 'sb_secret_test');
  insert into ish.notifications (user_id, kind, data)
  values ('00000000-0000-0000-0000-0000000000a1', 'new_shift_match', '{}'),
         ('00000000-0000-0000-0000-0000000000a2', 'new_shift_match', '{}');
  perform tests.eq((select count(*)::int from net.calls where url like '%/functions/v1/ish-push'), 1,
                   'one call for the statement');
  delete from net.calls;
  delete from ish.push_queue;
  insert into ish.notifications (user_id, kind, data) values ('00000000-0000-0000-0000-0000000000a2', 'job_offer', '{}');
  perform tests.eq((select count(*)::int from net.calls where url like '%/functions/v1/ish-push'), 0,
                   'nothing to push (no phone): no call');
end
$$;

-- Nobody but the service role.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select count(*) from ish.push_queue$$, 'permission denied', 'a worker cannot read the queue');
select tests.throws($$select * from ish.push_claim(1)$$, 'permission denied', 'nor take from it');
select tests.throws($$select ish.push_done(1)$$, 'permission denied', 'nor mark one sent');
select tests.throws($$select ish.push_drop_token('tok-aziz')$$, 'permission denied', 'nor drop a token');
select tests.throws($$select ish.push_tick()$$, 'permission denied', 'nor run the minute job');
select tests.as_anon();
select tests.throws($$select * from ish.push_claim(1)$$, 'permission denied', 'nor anybody signed out');
select tests.as_admin();
set local role service_role;
select tests.ok((select count(*) >= 0 from ish.push_claim(1)), 'the service role takes from the queue');
select tests.as_admin();
