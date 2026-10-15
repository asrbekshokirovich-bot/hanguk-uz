-- leads.password held guest passwords AS TYPED (11 rows, 14.04–30.09.2026),
-- written by the old guest sign-up in guest-auth. The sign-up is now a contact
-- request with no password (20261014190000_site_contact_request.sql), and the
-- "accounts" never led anywhere (/guest-portal did not exist). The owner
-- approved erasing them (2026-10-14).
--
-- APPLY ONLY AFTER the new guest-auth is deployed: the old one writes and
-- reads this column. From then on the constraint refuses any new value.
-- (The column stays for now: views and old code paths still name it.)

update public.leads set password = null where password is not null;

alter table public.leads drop constraint if exists leads_password_never_stored;
alter table public.leads add constraint leads_password_never_stored check (password is null);
