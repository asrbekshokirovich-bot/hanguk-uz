-- Limits against misuse: chat, applications, reports, «다시 요청», and the
-- business-register tries (P14). now() is fixed within the transaction, so
-- everything below happens «within the same minute».

-- Chat: twenty messages a minute.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ish.messages (application_id, body)
select '30000000-0000-0000-0000-000000000004', 'xabar ' || i from generate_series(1, 20) as i;
select tests.eq((select count(*)::int from ish.messages where sender_id = auth.uid()), 20, 'twenty go through');
select tests.throws($$insert into ish.messages (application_id, body)
                      values ('30000000-0000-0000-0000-000000000004', 'yana')$$,
                    'TOO_MANY_REQUESTS', 'the 21st in a minute is refused');

-- The other side of the chat is not held back by a1's messages.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', '네, 알겠습니다');
select tests.eq((select count(*)::int from ish.messages where sender_id = auth.uid()), 1, 'the owner can still answer');

-- The server's own writes (no signed-in person) are not limited.
select tests.as_admin();
insert into ish.messages (application_id, sender_id, body)
values ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a1', 'admin');
select tests.eq((select count(*)::int from ish.messages
                 where sender_id = '00000000-0000-0000-0000-0000000000a1'), 21, 'fixtures and jobs are not counted');

-- Applications: the same shift at most three times.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.apply_to_shift('20000000-0000-0000-0000-000000000002')).status::text, 'pending', 'first');
select ish.cancel_application(id) from ish.applications
  where worker_id = auth.uid() and shift_id = '20000000-0000-0000-0000-000000000002' and status = 'pending';
select tests.eq((ish.apply_to_shift('20000000-0000-0000-0000-000000000002')).status::text, 'pending', 'second');
select ish.cancel_application(id) from ish.applications
  where worker_id = auth.uid() and shift_id = '20000000-0000-0000-0000-000000000002' and status = 'pending';
select tests.eq((ish.apply_to_shift('20000000-0000-0000-0000-000000000002')).status::text, 'pending', 'third');
select ish.cancel_application(id) from ish.applications
  where worker_id = auth.uid() and shift_id = '20000000-0000-0000-0000-000000000002' and status = 'pending';
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000002')$$,
                    'TOO_MANY_REQUESTS', 'a fourth time is refused');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_applicant'), 3,
                'the owner was told three times, not more');

-- Applications: thirty a day.
select tests.as_admin();
insert into ish.applications (shift_id, worker_id, status, cancelled_at)
select '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a2', 'cancelled', now()
from generate_series(1, 30);
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000002')$$,
                    'TOO_MANY_REQUESTS', 'a 31st application in a day is refused');

-- Reports: ten a day.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ish.reports (reason, body) select 'other', 'shikoyat ' || i from generate_series(1, 10) as i;
select tests.throws($$insert into ish.reports (reason, body) values ('other', 'yana')$$,
                    'TOO_MANY_REQUESTS', 'the 11th report in a day is refused');

-- «다시 요청»: one invitation per worker and shift.
select tests.as_admin();
update ish.applications set status = 'completed', check_out_at = now(), worked_minutes = 180, pay_amount = 36000
  where id = '30000000-0000-0000-0000-000000000005';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.request_again('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a2');
select ish.request_again('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a2');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.notifications where kind = 'request_again'), 1,
                'pressed twice, told once');

-- The tries of BA0 are the edge function's: nobody else reads or writes them.
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.throws($$select count(*) from ish.business_register_attempts$$, 'permission denied',
                    'the app cannot read the tries');
select tests.throws($$insert into ish.business_register_attempts (user_id, biz_no)
                      values ('00000000-0000-0000-0000-0000000000b2', '1234567890')$$,
                    'permission denied', 'nor write them');
select tests.as_anon();
select tests.throws($$select count(*) from ish.business_register_attempts$$, 'permission denied',
                    'nor anyone signed out');
select tests.as_admin();
