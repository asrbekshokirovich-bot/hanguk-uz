-- Investor Overview: money per tariff ("No Risk" card).
--
-- Asrbek (2026-10-26): put the No Risk tariff's money in the Overview stat row
-- as its own block. The investor cannot read payments or profiles directly
-- (restrictive denials, migration 20260729_0005), so, like every other
-- v_investor_* view, this one runs with the owner's rights and self-gates on
-- investor_can_view_intake().
--
--   collected   - money received (completed/partial, paid_at set), the same
--                 rule v_investor_season_monthly uses for revenue;
--   outstanding - what is still owed on accounts that are not refunded;
--   students    - students who paid anything in that tariff and currency.
-- Nothing is summed across currencies.

create or replace view public.v_investor_plan_revenue as
select p.intake_id,
       coalesce(pr.payment_plan, 'unknown') as plan,
       p.currency,
       count(distinct p.student_id) filter (
         where p.status in ('completed', 'partial') and p.paid_at is not null
           and coalesce(p.paid_amount, 0) > 0
       ) as students,
       coalesce(sum(p.paid_amount) filter (
         where p.status in ('completed', 'partial') and p.paid_at is not null
       ), 0) as collected,
       coalesce(sum(greatest(p.amount - coalesce(p.paid_amount, 0), 0)) filter (
         where p.status <> 'refunded'
       ), 0) as outstanding
  from public.payments p
  join public.profiles pr on pr.user_id = p.student_id
 where p.intake_id is not null
   and not pr.is_demo
   and public.investor_can_view_intake(p.intake_id)
 group by p.intake_id, coalesce(pr.payment_plan, 'unknown'), p.currency;

revoke all on public.v_investor_plan_revenue from public, anon;
grant select on public.v_investor_plan_revenue to authenticated;
