-- Lead module v2 (spec "HANGUK Lid bo'limi TT", 2026-10-05) — part 1 of 5.
--
-- The new `lead_senior` role (spec §13): sees every lead, may pin, reassign and
-- start reactivation queues, and reads the report panel. An enum value cannot
-- be used in the transaction that adds it, so this is a migration of its own
-- and must be applied BEFORE 20261015231000_lead_v2_schema.sql.
--
-- Apply order for the whole module (see docs/lead-module-v2.md):
--   20261015230000_lead_v2_role_lead_senior.sql
--   20261015231000_lead_v2_schema.sql
--   20261015232000_lead_v2_engine.sql
--   20261015233000_lead_v2_jobs.sql
--   20261015234000_lead_v2_migrate_old_leads.sql   (data migration, last)

alter type public.app_role add value if not exists 'lead_senior';
