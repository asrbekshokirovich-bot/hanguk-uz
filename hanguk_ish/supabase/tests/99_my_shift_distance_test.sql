-- A06: the worker's own cards measure from the position the app saved.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.ok((select c -> 'shift' -> 'distance_km'
                 from jsonb_array_elements(public.my_shifts()) c
                 where c ->> 'application_id' = '30000000-0000-0000-0000-000000000004') = 'null'::jsonb,
                'no saved position: no distance');
update public.worker_profiles set lat = 37.5559, lng = 126.9368 where user_id = auth.uid();
select tests.ok((select (c -> 'shift' ->> 'distance_km')::numeric
                 from jsonb_array_elements(public.my_shifts()) c
                 where c ->> 'application_id' = '30000000-0000-0000-0000-000000000004') between 0 and 0.01,
                'my_shifts: from the saved position');
select tests.ok((public.my_shift('30000000-0000-0000-0000-000000000004') -> 'shift' ->> 'distance_km')::numeric
                  between 0 and 0.01,
                'my_shift too');
