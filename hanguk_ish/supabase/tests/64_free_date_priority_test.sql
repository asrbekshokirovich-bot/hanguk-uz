-- A free day says what matters most (2026-11-26): more money, lighter work,
-- close to home or no preference; the team's list shows it.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f7', '+821066665555');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f7');

select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq(ish.set_free_dates(jsonb_build_array(
  jsonb_build_object('day', ((now() at time zone 'Asia/Seoul')::date + 4)::text, 'part', 'night',
                     'district', 'Busan Sasang', 'priority', 'pay'),
  jsonb_build_object('day', ((now() at time zone 'Asia/Seoul')::date + 5)::text, 'part', 'day',
                     'district', 'Busan Sasang'))) -> 0 ->> 'priority',
  'pay', 'the night is for the money');
select tests.eq(ish.my_free_dates() -> 1 ->> 'priority', 'any', 'not said: no preference');
select tests.throws($$select ish.set_free_dates(jsonb_build_array(jsonb_build_object(
  'day', ((now() at time zone 'Asia/Seoul')::date + 4)::text, 'district', 'Busan', 'priority', 'fun')))$$,
  'INVALID', 'only the four choices');
select tests.throws($$select ish.set_free_dates(jsonb_build_array(jsonb_build_object(
  'day', ((now() at time zone 'Asia/Seoul')::date + 4)::text, 'district', 'Busan', 'part', 'evening')))$$,
  'INVALID', 'day, night or either');

select tests.as_user('00000000-0000-0000-0000-0000000000f7');
select tests.eq(ish.staff_free_workers((now() at time zone 'Asia/Seoul')::date + 4, 'sasang') -> 0 ->> 'priority',
                'pay', 'the team sees what matters most');
