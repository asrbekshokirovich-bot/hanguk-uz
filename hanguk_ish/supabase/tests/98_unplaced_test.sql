-- A business registered with only its number (BA0) has no address and no
-- point yet. Its shifts still reach the feed under a distance filter: after
-- the ones in range, with no distance, carrying the shift's own address.
select tests.as_admin();
insert into ish.businesses (id, owner_id, name, biz_no, nts_status, status, category)
values ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', '사업장 999-00-00002',
        '9990000002', '01', 'verified', 'cafe');
insert into ish.business_members (business_id, user_id, role)
values ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'owner');
insert into ish.shifts (id, business_id, title, address, starts_at, ends_at, hourly_wage, slots, auto_confirm)
values ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f1', '홀 보조',
        '서울 마포구 양화로 160', now() + interval '1 day', now() + interval '1 day 4 hours', 11000, 1, true);

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
-- In Sinchon with the feed's 3 km.
select tests.ok(exists (select 1
                        from jsonb_array_elements(ish.shift_feed(now(), now() + interval '4 days',
                                                                    37.5559, 126.9368, 3.0)) c
                        where c ->> 'id' = '20000000-0000-0000-0000-0000000000f1'),
                'a shift with no known place is not left out by the distance filter');
select tests.eq((select c ->> 'id'
                 from jsonb_array_elements(ish.shift_feed(now(), now() + interval '4 days',
                                                             37.5559, 126.9368, 3.0)) with ordinality as e(c, n)
                 order by n desc limit 1),
                '20000000-0000-0000-0000-0000000000f1', 'it comes after the shifts in range');
select tests.ok((select c -> 'distance_km'
                 from jsonb_array_elements(ish.shift_feed(now(), now() + interval '4 days',
                                                             37.5559, 126.9368, 3.0)) c
                 where c ->> 'id' = '20000000-0000-0000-0000-0000000000f1') = 'null'::jsonb,
                'with no distance');
select tests.eq((select c ->> 'address'
                 from jsonb_array_elements(ish.shift_feed(now(), now() + interval '4 days',
                                                             37.5559, 126.9368, 3.0)) c
                 where c ->> 'id' = '20000000-0000-0000-0000-0000000000f1'),
                '서울 마포구 양화로 160', 'the shift''s own address');
-- A shift whose place is known and out of range is still left out.
select tests.eq(jsonb_array_length(ish.shift_feed(now(), now() + interval '4 days', 37.5665, 126.9780, 1.0)), 1,
                'from City Hall within 1 km: only the one with no known place');
