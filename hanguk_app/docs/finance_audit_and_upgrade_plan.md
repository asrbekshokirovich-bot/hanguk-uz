# Finance Section — Audit & Upgrade Plan

_Project: `lysjdtyanhdfphqyijsr` (Hanguk 2026, Supabase)._
_Date: 2026-05-23._

The finance feature lives entirely in Supabase and is driven by the
Lovable admin web app. The Flutter mobile/web client has no finance UI.

---

## 1. State of the data — before & after cleanup

| Table                          | Before | After | Δ   | Why                                                          |
| ------------------------------ | ------ | ----- | --- | ------------------------------------------------------------ |
| `payments`                     | 83     | 49    | -34 | Duplicate "initial deposit" rows for the same student.       |
| `payment_transactions`         | 82     | 49    | -33 | Cascade-deleted with their parent payment.                   |
| `expenses`                     | 46     | 30    | -16 | 17 identical PayMe gateway-fee rows for 2026-02-03.          |
| `monthly_payment_categories`   | 8      | 1     | -7  | "Odina opa" salary row had been re-created 8 times.          |
| `operational_fund_allocations` | 8      | 1     | -7  | Same student/category/month re-allocated 8 times.            |
| `income_distribution_settings` | 6      | 3     | -3  | "Asrbek / owner / 47.5%" row had been re-created 4 times.    |
| `operational_fund_settings`    | 2      | 1     | -1  | Second row had `amount_per_student = 0` (accidental reset).  |
| `income_distributions`         | 6      | 6     | 0   | All retained (only ones tied to surviving payments).         |
| `scheduled_payments`           | 1      | 1     | 0   | No dupes.                                                    |
| **Total deletes**              |        |       | **-101 rows** (incl. cascades) |                                              |

Migration committed: `supabase/migrations/20260801000000_finance_duplicates_cleanup.sql`.

---

## 2. Root cause — why so many duplicates appeared

1. **No uniqueness constraints anywhere in the finance schema.** Every
   table accepts arbitrary re-inserts of the same business key.
2. **The Lovable admin pages re-submit the whole "payment + transaction"
   stack on every save.** 30 out of 34 duplicate payments were created
   on **2026-03-17 between 08:30 and 12:00** — clearly a single afternoon
   of someone re-opening the form and clicking "save" again.
3. **No idempotency key on the gateway-fee insert** that runs after a
   webhook callback — explains the 17 identical PayMe rows from 2026-02-03,
   all sharing the exact same `created_at` timestamp (`17:02:51.701+00`).
4. **The "settings" tables (`income_distribution_settings`,
   `monthly_payment_categories`, `operational_fund_settings`) behave
   like event logs instead of singletons.** Edits append new rows
   instead of `UPDATE`ing the existing one.

---

## 3. Upgrade plan

Goal: make the finance section _impossible to break the same way again_,
plus build the missing reporting layer.

### Phase 1 — Lock down the schema (1 migration, no downtime)

Add deferred-unique partial indexes that block obvious re-submits but
still allow correct multi-deposit scenarios:

```sql
-- one "initial_deposit" per (student, application)
CREATE UNIQUE INDEX uniq_payments_initial_deposit
  ON public.payments (student_id, COALESCE(application_id::text,''))
  WHERE payment_type = 'initial_deposit';

-- gateway-fee idempotency — only one fee row per transaction
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_one_fee_per_tx UNIQUE (linked_transaction_id);

-- settings are singletons per (recipient_name, recipient_type)
ALTER TABLE public.income_distribution_settings
  ADD CONSTRAINT idist_settings_unique_recipient
  UNIQUE (recipient_name, recipient_type);

ALTER TABLE public.monthly_payment_categories
  ADD CONSTRAINT mpc_unique_name_type UNIQUE (name, category_type);

ALTER TABLE public.operational_fund_allocations
  ADD CONSTRAINT ofa_unique_student_month
  UNIQUE (student_id, category_id, allocation_month);

-- only ONE operational_fund_settings row
CREATE UNIQUE INDEX uniq_op_fund_settings_singleton
  ON public.operational_fund_settings ((1));
```

These are idempotent — they will only succeed because we've already
removed the duplicates.

### Phase 2 — Idempotency

**Backend (shipped)** — `20260801000400_finance_phase2_idempotent_inserts.sql`.
Six `BEFORE INSERT` triggers on `payments` (initial_deposit only),
`expenses`, `income_distribution_settings`,
`monthly_payment_categories`, `operational_fund_allocations` and
`operational_fund_settings`. A duplicate insert is silently converted
into an `UPDATE` of the existing row. The Lovable frontend keeps
working with no code change — the unique constraints from Phase 1
never surface as 23505 errors to the user.

**Lovable frontend (still on the website team)** — pure UX polish now,
no longer correctness-critical:

- **Disable** the "Add payment" button while a save is in flight,
  re-enable on success/error.
- Show a "Last saved by <user> at <time>" badge so editors stop
  "re-saving just in case."
- (Optional) Switch settings pages from `insert` to `upsert` /
  `update`, mostly for clarity.

### Phase 3 — Auditability (1 migration)

Add an append-only audit table so we can replay any future incident:

```sql
CREATE TABLE public.finance_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name    text NOT NULL,
  row_id        uuid NOT NULL,
  op            text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  changed_by    uuid REFERENCES auth.users(id),
  changed_at    timestamptz NOT NULL DEFAULT now(),
  before        jsonb,
  after         jsonb
);

-- per-table AFTER triggers fan in here.
```

Attach `AFTER INSERT/UPDATE/DELETE` triggers on the 5 most important
tables (`payments`, `payment_transactions`, `expenses`,
`income_distributions`, `operational_fund_allocations`). Cost is tiny
(<1ms per write at current volume).

### Phase 4 — Reporting views

Replace the half-finished aggregation logic that lives in the
frontend today with stable SQL views:

```sql
-- monthly P&L
CREATE VIEW public.v_finance_monthly_pnl AS
  SELECT date_trunc('month', paid_at)::date AS month,
         currency,
         SUM(paid_amount)                   AS income,
         (SELECT SUM(amount) FROM public.expenses e
            WHERE date_trunc('month', e.expense_date) = date_trunc('month', p.paid_at)
              AND e.currency = p.currency)  AS expenses
    FROM public.payments p
   WHERE status IN ('completed','partial')
   GROUP BY 1, currency;

-- per-student outstanding balance
CREATE VIEW public.v_student_balance AS
  SELECT student_id,
         currency,
         SUM(amount - paid_amount) AS outstanding
    FROM public.payments
   WHERE status IN ('pending','partial','overdue')
   GROUP BY student_id, currency;
```

### Phase 5 — Flutter "Finance" tab (optional, owner-only)

A read-only mobile view for the owner using the views above. Behind a
`--dart-define=FINANCE_TAB=true` flag, same pattern as `UNI_DB_ENABLED`
described in the project README. Gives Asrbek a live dashboard without
needing to open the admin website.

---

## 4. Order of operations

1. Ship `20260801000000_finance_duplicates_cleanup.sql` (this PR — **done**).
2. Ship Phase 1 unique constraints — next PR, same day.
3. Lovable frontend fixes (Phase 2) — done by the website team in parallel.
4. Phase 3 audit log — once Phase 1 is in production a week.
5. Phase 4 views — at the same time as Phase 5 if mobile UI is wanted.

Each phase is independently shippable and rolls back cleanly.
