-- A worker keeps seeing the shifts they applied to — also once the business
-- calls one off. Others do not see a cancelled shift.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select public.apply_to_shift('20000000-0000-0000-0000-000000000001');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select public.cancel_shift('20000000-0000-0000-0000-000000000001');

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select status::text from public.shifts where id = '20000000-0000-0000-0000-000000000001'),
                'cancelled', 'the worker still reads the cancelled shift they applied to');

select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from public.shifts where id = '20000000-0000-0000-0000-000000000001'),
                0, 'another worker does not see the cancelled shift');
select tests.eq((select count(*)::int from public.shifts where id = '20000000-0000-0000-0000-000000000008'),
                0, 'nor a shift of an unverified business');
