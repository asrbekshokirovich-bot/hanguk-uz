-- Ushlab qolish rejasi P15 (U2): when a new admission guideline of the
-- current or next season lands for a university, the guests who saved it
-- (♥) or opened its page in the last 30 days get «Yangi qabul yo'riqnomasi»
-- through guest_push_queue (P08) — notify-guest-reminders (P09) sends it
-- with the same limits (one a day, two a week, quiet nights).
-- The 411 stale change_event_outbox rows are NOT touched here: that delete
-- is run separately, after Asrbek's own confirmation (QU7).

create or replace function public.trg_guideline_new_queue()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_season record;
begin
  if new.institution_id is null or new.qabul_yili is null or new.semestr is null then
    return new;
  end if;
  select * into v_season from public.ai_uni_season();
  -- the current season or a later one; an old guideline re-imported is not news
  if (new.qabul_yili * 10 + case new.semestr when 'bahor' then 1 else 2 end)
     < (v_season.qabul_yili * 10 + case v_season.semestr when 'bahor' then 1 else 2 end) then
    return new;
  end if;
  insert into public.guest_push_queue (install_id, kind, institution_id, ref_date)
  select i.install_id, 'guideline_new', new.institution_id,
         make_date(new.qabul_yili, case new.semestr when 'bahor' then 3 else 9 end, 1)
    from public.app_install_interests i
    join public.fn_guest_reminder_installs() r on r.install_id = i.install_id
    left join public.app_install_answers a on a.install_id = i.install_id
   where i.institution_id = new.institution_id
     and (i.heart_slot is not null or i.last_open_at > now() - interval '30 days')
     and (a.route is null or new.daraja is null
          or new.daraja = case a.route when 'bachelor' then 'bakalavr' when 'master' then 'magistratura'
                                       when 'languageCourse' then 'til_kursi' end)
  on conflict do nothing;
  return new;
exception when others then
  -- a guideline upload must never fail because of a reminder
  raise warning 'trg_guideline_new_queue: %', sqlerrm;
  return new;
end;
$$;
revoke all on function public.trg_guideline_new_queue() from public, anon, authenticated;

drop trigger if exists guideline_new_queue on public.university_guidelines;
create trigger guideline_new_queue
  after insert on public.university_guidelines
  for each row execute function public.trg_guideline_new_queue();

-- A «new guideline» that could not go within 3 days is no longer news.
do $$
begin
  perform cron.unschedule('guest-push-expire')
    where exists (select 1 from cron.job where jobname = 'guest-push-expire');
end $$;
select cron.schedule('guest-push-expire', '45 4 * * *', $cron$
  update public.guest_push_queue set status = 'skipped', note = 'expired'
   where status = 'pending' and kind = 'guideline_new' and created_at < now() - interval '3 days'
$cron$);
