-- Schema basics: profiles, minimum wage, QR secrets, translations.

select tests.eq(ish.minimum_wage('2026-11-10 12:00+09'), 10320, '2026 minimum wage');
select tests.eq(ish.minimum_wage('2027-01-01 00:00+09'), 10700, '2027 minimum wage from 1 Jan, Korean time');
select tests.eq(ish.minimum_wage('2026-12-31 23:59+09'), 10320, 'still 2026 on 31 Dec 23:59 KST');
-- 2026-12-31 16:00 UTC is already 2027-01-01 01:00 in Seoul.
select tests.eq(ish.minimum_wage('2026-12-31 16:00+00'), 10700, 'year is taken on the Korean clock');

-- The fixture shifts start from now(): their wages must stay legal a year
-- ahead, or the tests start failing at the turn of the year (P44). When the
-- next year's minimum is added, this says which wages to raise.
select tests.eq((select count(*)::int from ish.shifts
                 where hourly_wage < ish.minimum_wage(now() + interval '400 days')), 0,
                'fixture wages are legal a year ahead');

select tests.eq((select count(*)::int from ish.profiles), 5, 'a profile per auth user');
select tests.eq((select phone from ish.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
                '+821000000001', 'profile copies the phone');

select tests.eq((select count(*)::int from ish.shift_secrets), 8, 'every shift gets a QR secret');
select tests.ok((select length(qr_secret) = 32 from ish.shift_secrets limit 1), 'secret is 16 random bytes in hex');

select tests.throws($$
  insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
  values ('10000000-0000-0000-0000-000000000001', 'x', now() + interval '1 day',
          now() + interval '1 day 2 hours', 10319, 1)
$$, 'WAGE_BELOW_MINIMUM', 'wage under the minimum is refused');

select tests.throws($$
  insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
  values ('10000000-0000-0000-0000-000000000001', 'x', '2027-01-05 10:00+09', '2027-01-05 12:00+09', 10500, 1)
$$, 'WAGE_BELOW_MINIMUM', 'a 2027 shift needs the 2027 minimum');

select tests.throws($$
  insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
  values ('10000000-0000-0000-0000-000000000001', 'x', now() + interval '1 day', now() + interval '1 day', 10800, 1)
$$, 'shifts_time_order', 'end must be after start');

select tests.throws($$
  insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
  values ('10000000-0000-0000-0000-000000000001', 'x', now() + interval '1 day', now() + interval '1 day 17 hours', 10800, 1)
$$, 'shifts_max_length', 'at most 16 hours');

-- Translations are dropped when the Korean text changes, kept otherwise.
update ish.shifts set translations = '{"uz": {"title": "Kassa"}}' where id = '20000000-0000-0000-0000-000000000001';
update ish.shifts set slots = 3 where id = '20000000-0000-0000-0000-000000000001';
select tests.eq((select translations->'uz'->>'title' from ish.shifts where id = '20000000-0000-0000-0000-000000000001'),
                'Kassa', 'translation kept when only slots change');
update ish.shifts set title = '홀 보조' where id = '20000000-0000-0000-0000-000000000001';
select tests.eq((select translations from ish.shifts where id = '20000000-0000-0000-0000-000000000001'),
                '{}'::jsonb, 'translation cleared when the title changes');

select tests.ok(ish.distance_km(37.5559, 126.9368, 37.5665, 126.9780) between 3.7 and 3.9,
                'Sinchon → City Hall is about 3.8 km');
