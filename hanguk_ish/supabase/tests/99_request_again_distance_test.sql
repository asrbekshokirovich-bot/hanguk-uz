-- «다시 요청» says how far the shift is from where the app last saw the worker.
select tests.as_admin();
update public.applications set status = 'completed', check_out_at = now(), worked_minutes = 180, pay_amount = 36000
  where id = '30000000-0000-0000-0000-000000000005';
update public.worker_profiles set lat = 37.5559, lng = 126.9368 where user_id = '00000000-0000-0000-0000-0000000000a2';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select public.request_again('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a2');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.ok((select (data ->> 'distance_km')::numeric from public.notifications
                 where kind = 'request_again' and data ->> 'shift_id' = '20000000-0000-0000-0000-000000000006')
                  between 0 and 0.1,
                'the invitation says how far the shift is');

-- No saved position: no distance at all (not a null in the data).
select tests.as_admin();
update public.worker_profiles set lat = null, lng = null where user_id = '00000000-0000-0000-0000-0000000000a2';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select public.request_again('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.ok((select not (data ? 'distance_km') from public.notifications
                 where kind = 'request_again' and data ->> 'shift_id' = '20000000-0000-0000-0000-000000000001'),
                'no saved position: no distance key');
