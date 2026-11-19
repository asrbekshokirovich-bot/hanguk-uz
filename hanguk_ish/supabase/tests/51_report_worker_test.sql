-- The owner reports a worker of their own business.
-- fixtures: s5 (biz1) has a2 checked in; b1 owns biz1, b2 owns biz2.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.report_worker('30000000-0000-0000-0000-000000000005', 'no_show', ' Kelmadi, telefon ham ochmadi ');
select tests.as_admin();
select tests.eq((select count(*)::int from ish.reports
                 where application_id = '30000000-0000-0000-0000-000000000005'
                   and reporter_id = '00000000-0000-0000-0000-0000000000b1' and reason = 'no_show'), 1,
                'the report is in the same table the CRM reads');
select tests.ok((select body like 'Ish beruvchi ishchi ustidan: %Kelmadi, telefon ham ochmadi'
                 from ish.reports where application_id = '30000000-0000-0000-0000-000000000005'),
                'it says who it is about, trimmed');
select tests.eq((select count(*)::int from ish.staff_alerts where kind = 'report' and ref = (select id from ish.reports where application_id = '30000000-0000-0000-0000-000000000005')), 1, 'the Telegram alert is queued');

select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.throws($$select ish.report_worker('30000000-0000-0000-0000-000000000005', 'other', 'x')$$,
                    'NOT_FOUND', 'not about another business''s worker');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select ish.report_worker('30000000-0000-0000-0000-000000000005', 'other', 'x')$$,
                    'NOT_FOUND', 'a worker is not a business');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$select ish.report_worker('30000000-0000-0000-0000-000000000005', 'unpaid', 'x')$$,
                    'INVALID', 'only no_show, behaviour, other');
select tests.throws($$select ish.report_worker('30000000-0000-0000-0000-000000000005', 'other', '   ')$$,
                    'INVALID', 'a text is needed');
select tests.as_anon();
select tests.throws($$select ish.report_worker('30000000-0000-0000-0000-000000000005', 'other', 'x')$$,
                    'permission denied', 'not signed out');
