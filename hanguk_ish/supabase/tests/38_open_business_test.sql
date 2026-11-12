-- P50: the 사장님 app opens the owner's business at «시작하기» — no
-- 사업자등록번호, no check (Asrbek's choice): it can post shifts at once.

-- An owner's account from the app (P49: anonymous, marked, with a profile).
insert into auth.users (id, is_anonymous, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000f1', true, '{"app": "hanguk_ish"}');

select tests.as_user('00000000-0000-0000-0000-0000000000f1');
create temp table opened as select ish.open_business() as id;
select tests.as_admin();
select tests.eq((select status::text from ish.businesses where id = (select id from opened)), 'verified',
                'the business is open at once, without a check');
select tests.ok((select biz_no is null and not managed_by_staff from ish.businesses where id = (select id from opened)),
                'an owner''s business without a number');
select tests.eq((select name from ish.businesses where id = (select id from opened)),
                '사업장 ' || upper(left((select id from opened)::text, 4)), 'named 사업장 + the start of its id');
select tests.eq((select owner_id from ish.businesses where id = (select id from opened)),
                '00000000-0000-0000-0000-0000000000f1'::uuid, 'the caller owns it');
select tests.eq((select role from ish.business_members where business_id = (select id from opened)
                   and user_id = '00000000-0000-0000-0000-0000000000f1'), 'owner', 'and runs it as the owner');

-- «시작하기» again (or the app reopened): the same business, not a second.
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select tests.eq(ish.open_business(), (select id from opened), 'pressing again gives the same business');
select tests.eq(jsonb_array_length(ish.my_businesses()), 1, 'one business on the owner''s list');

-- It posts a shift right away (shifts_guard lets a verified business in).
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ((select id from opened), '홀 서빙', now() + interval '1 day', now() + interval '1 day 4 hours', 10800, 2);
select tests.as_admin();
select tests.eq((select count(*)::int from ish.shifts where business_id = (select id from opened)), 1,
                'the new owner''s shift is posted');

-- A second owner gets a business of their own.
insert into auth.users (id, is_anonymous, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000f2', true, '{"app": "hanguk_ish"}');
select tests.as_user('00000000-0000-0000-0000-0000000000f2');
select tests.ok(ish.open_business() <> (select id from opened), 'another account, another business');

-- Signed out: no business.
select tests.as_anon();
select tests.throws($$select ish.open_business()$$, 'permission denied', 'the signed-out cannot open one');

-- The number stays unique for those who register one (국세청 path).
select tests.as_admin();
select tests.throws($$update ish.businesses set biz_no = (select biz_no from ish.businesses where biz_no is not null limit 1)
                      where id = (select id from opened)$$,
                    'duplicate key', 'a number is still on one business only');
