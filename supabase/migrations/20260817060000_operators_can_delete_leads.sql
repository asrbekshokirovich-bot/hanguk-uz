-- Let call operators delete a lead, not just owners and admins.
--
-- The intake sheet now offers two endings side by side: convert the person
-- into a student, or delete the record because no contract was signed. The
-- operator who worked the lead is the one holding that outcome — they are on
-- the call when it is decided — and routing the second half of it through an
-- admin means the list fills with records nobody will ever action.
--
-- Every other write on `leads` already trusts this role: "Staff can update
-- leads" is owner + admin + call_operator, and an operator can already set a
-- lead to `lost`, rewrite its note, and create a student account from it
-- ("Staff can insert student profiles"). DELETE was the one verb left behind,
-- so the UI had to hide a button the database would have refused — a dead end
-- dressed as a choice.
--
-- The role list is written to MATCH the update policy exactly rather than
-- inventing a new predicate: two policies on one table that mean "staff" and
-- spell it differently is how they drift apart.
--
-- This is a real widening of destructive power, and worth naming plainly:
-- deletion here is a hard DELETE with no soft-delete column and no audit row,
-- so a lead removed by mistake is gone. The mitigation in front of it is the
-- confirmation dialog, not the database. If that turns out to be too thin in
-- practice, the fix is a `deleted_at` column and a restore path — not putting
-- this policy back, which only moves the same irreversible action to a
-- different person.

drop policy if exists "Admins can delete leads" on public.leads;

create policy "Staff can delete leads"
  on public.leads
  for delete
  using (
    exists (
      select 1
        from public.user_roles
       where user_roles.user_id = (select auth.uid())
         and user_roles.role = any (
           array['owner'::app_role, 'admin'::app_role, 'call_operator'::app_role]
         )
    )
  );
