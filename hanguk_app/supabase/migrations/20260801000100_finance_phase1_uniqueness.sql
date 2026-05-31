-- Phase 1: lock down the finance schema with uniqueness rules so
-- the dupes we just cleaned up can never come back.
--
-- Already applied to the Hanguk 2026 Supabase project on 2026-05-23.

ALTER TABLE public.income_distribution_settings
  ADD CONSTRAINT idist_settings_unique_recipient
  UNIQUE (recipient_name, recipient_type);

ALTER TABLE public.monthly_payment_categories
  ADD CONSTRAINT mpc_unique_name_type
  UNIQUE (name, category_type);

ALTER TABLE public.operational_fund_allocations
  ADD CONSTRAINT ofa_unique_student_category_month
  UNIQUE (student_id, category_id, allocation_month);

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_one_fee_per_tx
  UNIQUE (linked_transaction_id);

CREATE UNIQUE INDEX uniq_payments_initial_deposit
  ON public.payments (student_id, COALESCE(application_id::text, ''))
  WHERE payment_type = 'initial_deposit';

CREATE UNIQUE INDEX uniq_op_fund_settings_singleton
  ON public.operational_fund_settings ((true));
