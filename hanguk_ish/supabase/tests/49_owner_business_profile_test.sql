-- The owner names their business; nobody else can.
-- People: d1 — an owner; d2 — another owner.
select tests.as_admin();
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000d1', '+821000000051'),
  ('00000000-0000-0000-0000-0000000000d2', '+821000000052');

select tests.as_user('00000000-0000-0000-0000-0000000000d1');
select ish.open_business();
select tests.as_user('00000000-0000-0000-0000-0000000000d2');
select ish.open_business();

select tests.as_user('00000000-0000-0000-0000-0000000000d1');
select ish.update_my_business(
  (select id from ish.businesses where owner_id = '00000000-0000-0000-0000-0000000000d1'),
  '  달빛카페  ', 'cafe', '신촌', '마포구 신촌로 15');
select tests.eq(
  (select name || '|' || category || '|' || area || '|' || address from ish.businesses
   where owner_id = '00000000-0000-0000-0000-0000000000d1'),
  '달빛카페|cafe|신촌|마포구 신촌로 15', 'the owner names their business');

select tests.throws(
  $$select ish.update_my_business((select id from ish.businesses
    where owner_id = '00000000-0000-0000-0000-0000000000d2'), 'x', 'cafe', '', '')$$,
  'NOT_FOUND', 'not another owner''s business');
select tests.throws(
  $$select ish.update_my_business((select id from ish.businesses
    where owner_id = '00000000-0000-0000-0000-0000000000d1'), '', 'cafe', '', '')$$,
  'INVALID', 'a name is needed');
select tests.throws(
  $$select ish.update_my_business((select id from ish.businesses
    where owner_id = '00000000-0000-0000-0000-0000000000d1'), 'x', 'spaceship', '', '')$$,
  'INVALID', 'a known kind of work');
