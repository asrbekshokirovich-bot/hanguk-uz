-- The owner names their business; nobody else can.
-- People: b1 — an owner; b2 — another owner.
select tests.as_admin();
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000b1', '+821000000041'),
  ('00000000-0000-0000-0000-0000000000b2', '+821000000042');

select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.open_business();
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select ish.open_business();

select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.update_my_business(
  (select id from ish.businesses where owner_id = '00000000-0000-0000-0000-0000000000b1'),
  '  달빛카페  ', 'cafe', '신촌', '마포구 신촌로 15');
select tests.eq(
  (select name || '|' || category || '|' || area || '|' || address from ish.businesses
   where owner_id = '00000000-0000-0000-0000-0000000000b1'),
  '달빛카페|cafe|신촌|마포구 신촌로 15', 'the owner names their business');

select tests.throws(
  $$select ish.update_my_business((select id from ish.businesses
    where owner_id = '00000000-0000-0000-0000-0000000000b2'), 'x', 'cafe', '', '')$$,
  'NOT_FOUND', 'not another owner''s business');
select tests.throws(
  $$select ish.update_my_business((select id from ish.businesses
    where owner_id = '00000000-0000-0000-0000-0000000000b1'), '', 'cafe', '', '')$$,
  'INVALID', 'a name is needed');
select tests.throws(
  $$select ish.update_my_business((select id from ish.businesses
    where owner_id = '00000000-0000-0000-0000-0000000000b1'), 'x', 'spaceship', '', '')$$,
  'INVALID', 'a known kind of work');
