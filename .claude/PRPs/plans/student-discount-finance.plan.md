# Plan: Per-Student Discount (Sale %) Across the Finance System

## Summary

Staff can today only pick a fixed payment plan (STANDART / PREMIUM / NO RISK) when adding a student; every money figure in the CRM is then re-derived from hardcoded plan-price constants. This plan adds a per-student **discount percentage** that staff enter when adding (or editing) a student, and threads it through **every** place money is computed: expected payments, payment recording, remaining balances, income distribution, reports, dashboards, AI-chat answers, and student-facing balances — so all incomes and finance figures are automatically calculated, separated, and recorded according to the discount.

## User Story

As a staff member (owner / admin / call operator / document handler), when I add a student I can enter a sale/discount percentage (e.g. 15%). The student's contract price, expected payments, invoices, remaining balance, and every finance report then automatically use the discounted amounts. When the student pays the discounted price in full, the payment is marked completed and income distribution runs on the discounted amount — with no manual arithmetic by staff anywhere.

## Problem → Solution

**Problem.** There is no stored contract price and no discount concept anywhere. Prices live only in the frontend constant `PAYMENT_PLANS` (`src/hooks/useStudentPlan.ts:128-176`), duplicated as display copies in at least 5 more files. "What a student owes" is recomputed at read time from those constants in four independent places, and `payments.amount` is a snapshot of the constant taken at insert time. Staff currently implement discounts by hand-editing the amount field, which desynchronizes the expected-payment engine (student shows a phantom remaining balance forever, payment never reaches `completed`, and the completion-gated allocation chain — budgets → bonus → operational fund → income distribution — never fires).

**Solution.** Store a validated `discount_percent` per (student, season) on `student_intakes` (same grain as the existing `is_free_reapplication` billing modifier), make the central price helpers in `useStudentPlan.ts` discount-aware with one rounding rule, and update every writer so `payments.amount` is always stored **already discounted**. Everything that reads stored rows (status transitions, reports, investor views, `v_student_balance`, AI chat, student insights) then self-corrects; everything that re-derives from plan constants (expected payments, planned income, collection rates, finance cards) is switched to the discounted helpers.

## Metadata

| Field | Value |
|---|---|
| Complexity | High — touches schema, edge function, 3 payment-recording paths, 4 expected-amount derivations, reports, i18n |
| Source PRD | Owner request 2026-09-01 (discount/sale % at student creation; all finance auto-calculated from it) |
| PRD Phase | Full feature (single release, 7 workstreams below) |
| Estimated Files | ~35 changed, 2 created (1 migration, 1 test file extension) |

## Confirmed System Facts (from the codebase review)

These were verified by reading the code and both migration trees; the implementation must not "re-discover" them differently:

1. **Students are `profiles` rows** (no students table; addressed by `user_id`, no auth account, only `magic_code`). Billing config = `payment_plan` + `payment_mode` + `contract_date`. **No price, amount, or discount column exists anywhere in the DB.**
2. **Prices are frontend constants**: `PAYMENT_PLANS` in `src/hooks/useStudentPlan.ts:128-176` — free 0; standart 5,000,000 UZS one-time / 4M+2M split (total 6M); premium 10M / 7M+6M (13M); no_risk **USD** 5,000 / 3,000+2,500 (5,500). Split totals deliberately exceed one-time prices. Duplicated price tables: `AddStudentDialog.tsx:39-80`, `EditStudentDialog.tsx:46-87`, `StudentDetail.tsx:137-141` (strings), `LeadDetailSheet.tsx:164-173`, `SmartContactDialog.tsx:61-70` (strings, plus legacy lead-only values `standart_2`, `premium_2`, `no_risk_2`, `tekin`, `tekin_natija`).
3. **Three parallel payment-recording paths**, each with its own prefill and completion logic: `usePayments.createPayment/recordTransaction`, `src/components/crm/AddPaymentDialog.tsx`, `src/components/finance/ManualTransactionDialog.tsx`. Completion test is `paid_amount >= amount`; on completion each path fires the allocation chain (allocateBudgetsForPayment → createBonusForPayment → allocateOperationalFund → distributeIncomeFromPayment) client-side, exactly once (idempotency guards), with **no recompute path** except owner-run "sync" buttons.
4. **Expected payments have no table** — derived in memory in 4 places: `useExpectedPayments.ts` (:63, :93-94), `PlannedIncomePanel.tsx:48`, `FinanceReports.tsx:110`, `StudentFinanceCard.tsx:54`; plus `useCRMData.ts:179` (initial-payment-overdue flag).
5. **Per-season billing modifier precedent**: `student_intakes.is_free_reapplication` (migration `20260803120000`) — its comments document why billing facts on `profiles` double-bill multi-season students. `useExpectedPayments.ts:52` short-circuits on it.
6. **Staff bonuses are flat per plan** (100k/150k/150k UZS), *not* price-derived, duplicated in three writers (`useStaffBonuses.ts:8-13`, `useIncomeDistribution.ts:290-294` fallback, `create-student/index.ts:311`) and recorded once per student forever (`record_staff_bonus` RPC).
7. **Income distribution waterfall** (`useIncomeDistribution.ts:349-353`): `netIncome = max(0, paid − gatewayFees − flatBonus − flatBudget − opFund(2M UZS))`, then split by `income_distribution_settings` percentages (47.5/47.5/5). The `max(0,…)` floor silently absorbs any deficit.
8. **Both migration trees are live**: the five `hanguk_app/supabase/migrations/20260801000*` finance migrations (uniqueness constraints, idempotency triggers, audit log, reporting views) are applied to the production project `lysjdtyanhdfphqyijsr` per `hanguk_app/docs/finance_audit_and_upgrade_plan.md`. The `payments_idempotent_initial_deposit` BEFORE INSERT trigger **silently converts a duplicate initial_deposit insert into an UPDATE that overwrites `amount`** — a stale prefill can clobber a discounted amount.
9. **Server-side money readers that follow `payments.amount`** and therefore self-correct once amounts are stored discounted: `v_student_balance`, `v_finance_monthly_pnl` (`hanguk_app/.../20260801000300`), the AI chat context and its `ai.*` analytics views (`20260718130000`), `useStudentInsights.ts` (student portal), `useStudentContext.ts` (messages rail), `useReports.ts`, `useSystemHealth.ts` (flags degraded on chronic partial/overdue rows).
10. **Repo-absent live objects** (must be dumped from the live DB before any change that touches them): `v_investor_position`, `v_investor_season_pnl`, `v_investor_season_monthly`, `v_investor_intakes`, `investor_payouts`, `investor_can_view_intake()`, `ai_list_payments` RPC.
11. **Inbound webhook writes money**: `supabase/functions/command-center-webhook/index.ts:184-206` sets `paid_amount` and `status='paid'` on external income events — `'paid'` is not in the payments status CHECK, so this currently fails silently (pre-existing bug, noted below).
12. **`scheduled_payments` is dead code** — `useScheduledPayments` has zero call sites (`ScheduledPaymentsPanel` actually renders `useExpectedPayments`), though the table exists and Delete/Transfer dialogs touch it.
13. **Currencies must never be summed** (UZS headline + USD no_risk, no FX rate stored — `investorFormat.ts:112-119`); `payments.amount` is DECIMAL(10,2).
14. **Lead conversion** (`LeadsContext.convertToStudent`) calls the same `create-student` edge function, hardcodes `payment_mode='one_time'`, and passes `lead.payment_plan` raw (legacy `_2` values lose their implicit installment meaning).

## Design Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Storage grain | `student_intakes.discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (0–100)` | Money facts are season-scoped (is_free_reapplication precedent). A student can re-apply next season at a different (or no) discount. Creation enrolls into exactly one intake, so the Add Student form maps cleanly. |
| D2 | One field, "sale" = "discount" | Single `discount_percent` | Owner's "sale percentage… discount percentage" treated as one concept. If separately stacked promos are ever needed, add a second column then (flagged in Open Questions). |
| D3 | What the % applies to | Every plan amount uniformly: `priceOneTime`, `firstPayment`, `secondPayment` each × (1 − d/100); `priceInstallment` = discounted first + discounted second | Keeps the installment surcharge structure intact and makes each installment's expected amount self-consistent with its own payment row. |
| D4 | Rounding rule | Per-amount, **round to whole currency units** (`Math.round`), UZS and USD alike; totals = sum of rounded parts | One rule everywhere; whole units fit DECIMAL(10,2); completion is a `>=` test so expected and stored amounts must be byte-identical — deriving both through the same helper guarantees it. |
| D5 | Where discounts are applied | `payments.amount` is always **stored discounted** (all 3 recording paths prefill discounted); read-time derivations use the same discounted helpers | Stored rows drive status, allocation, reports, SQL views, AI chat, student portal — one write-side fix corrects ~10 read surfaces automatically. |
| D6 | Fixed deductions (staff bonus, BUDGET_CATEGORIES, op-fund 2M) | **Stay flat in v1** — discounts reduce owner margin, not costs/bonuses | Bonuses were never price-derived; budget categories are real external costs; changing them is a separate business decision. The `max(0,…)` floor risk is surfaced in the UI instead (see Task 14) and in Risks. |
| D7 | `is_free_reapplication` precedence | Exemption wins; when set, discount is ignored (expected = 0 everywhere, unchanged) | Preserves existing semantics; avoids three overlapping zero-price mechanisms interacting. UI shows the discount input disabled when the flag is on. |
| D8 | Who can set/edit | Same four staff roles that can create/edit students; server-side range validation in `create-student`; DB CHECK constraint as backstop; changes audited via `finance_audit_log` trigger | Matches existing authority model (any of the 4 roles already sets the plan, which is a much bigger money lever). Owner-only approval can be layered later (Open Questions). |
| D9 | Editing a discount after payments exist | Rewrite `amount` on that intake's **pending** payment rows only (recompute from discounted helper); `partial`/`completed` rows untouched; dialog shows an explicit warning listing affected rows | Retroactively editing partial rows can instantly flip them completed and fire the allocation chain from an edit dialog — too dangerous. Correcting a partial row stays a deliberate act via EditPaymentDialog. |
| D10 | Investor views | **No change in v1.** Season revenue is paid-amount-based and self-corrects. A "discounts given" contra-revenue line is deferred | The financial views' SQL is not in the repo; altering them requires dumping live definitions first (Task 1 captures them regardless, so the follow-up is unblocked). |
| D11 | Leads | Optional pass-through only: `convertToStudent` sends `discountPercent: 0`; a `leads.discount_percent` column is deferred | Keeps v1 scope contained; the conversion path still compiles against the new function signature. |
| D12 | `scheduled_payments` | Not discounted; explicitly documented as dormant | Zero call sites. Reviving it is out of scope; if revived it must use the discounted helpers. |

## UX Design

### Before (Add Student — Payment section)

```
┌─ Payment Plan & Contract ────────────────────────────┐
│ ( ) STANDART  5,000,000 UZS   (•) PREMIUM 10,000,000 │
│ ( ) NO RISK   $5,000                                 │
│ Payment mode: (•) One-time  ( ) 2 Payments           │
│ Contract date: [2026-09-01]   Contract file: [ … ]   │
│ 💳 Total: 10,000,000 UZS                             │
└──────────────────────────────────────────────────────┘
```

### After

```
┌─ Payment Plan & Contract ────────────────────────────┐
│ ( ) STANDART  5,000,000 UZS   (•) PREMIUM 10,000,000 │
│ ( ) NO RISK   $5,000                                 │
│ Payment mode: (•) One-time  ( ) 2 Payments           │
│ Discount (%):  [ 15 ]   ⓘ 0–100                      │
│ Contract date: [2026-09-01]   Contract file: [ … ]   │
│ 💳 List: 10,000,000 UZS  −15%  → Total: 8,500,000 UZS│
└──────────────────────────────────────────────────────┘
```

### Interaction Changes

| Surface | Before | After |
|---|---|---|
| Add Student dialog | Plan/mode/contract only | + Discount % input (default 0); live preview shows list price, −d%, final price |
| Edit Student dialog | Plan/mode/contract + free-reapplication toggle | + Discount % (per current season, next to the free-reapplication toggle; disabled when exempt); saving with existing pending payments shows a confirm listing rows whose `amount` will be recomputed |
| Student detail | Plan badge + list price string | Shows `List − d% = Final` when d > 0 |
| Add/Create/Manual payment dialogs | Amount prefilled with list price | Amount prefilled with **discounted** price; expected-amounts banner shows discounted figures with the discount noted |
| Invoice | Total = amount | When d > 0: List price, Discount (−d%), Net total, Paid, Balance due |
| Finance panels & reports | Expected income = flat plan price × students | Expected income = Σ per-student discounted price; optional "Discounts given" (Σ list − Σ discounted) line in PlannedIncomePanel |
| Payments list / balances / AI chat / student portal | Follow stored `amount` | Unchanged code — correct automatically because stored amounts are discounted |

## Mandatory Reading (before implementing)

| P | File | Lines | Why |
|---|---|---|---|
| P0 | `src/hooks/useStudentPlan.ts` | 128-216, 297-355 | The price constants and every helper to make discount-aware; the rounding rule lands here |
| P0 | `src/hooks/useExpectedPayments.ts` | 40-180 | The owed-engine; freeReapplication short-circuit at :52 is the pattern for reading per-season fields |
| P0 | `src/hooks/usePayments.ts` | 85-240 | Recording path 1; completion gate :181; allocation chain :205-238 (min-capped) |
| P0 | `src/components/crm/AddPaymentDialog.tsx` | 74-116, 143-173, 206-330 | Recording path 2; DB-fallback profile fetch :74-87 must also fetch the discount; chain passes uncapped paidAmount :311-324 |
| P0 | `src/components/finance/ManualTransactionDialog.tsx` | 77-210 | Recording path 3 |
| P0 | `supabase/functions/create-student/index.ts` | 59-81, 128, 235-336 | Creation path: body parse, role allowlist, profiles insert, student_intakes upsert, flat bonus |
| P0 | `supabase/migrations/20260803120000_free_reapplication_flag.sql` | all | The per-season billing-modifier precedent the migration mirrors |
| P0 | `hanguk_app/supabase/migrations/20260801000400_finance_phase2_idempotent_inserts.sql` | payments trigger | The amount-overwriting idempotency trigger every insert path must stay consistent with |
| P1 | `src/hooks/useCRMData.ts` | 47-64, 158-201 | Roster select (add discount column here), freeReapplication propagation, initialPaymentOverdue |
| P1 | `src/components/crm/AddStudentDialog.tsx` / `EditStudentDialog.tsx` | forms + previews | Where the input goes; duplicated price tables to consolidate |
| P1 | `src/hooks/useIncomeDistribution.ts` | 249-353, 390-449, 470-615 | Deduction waterfall, idempotency, the sync/rebase pattern (`syncGatewayFeesForDistributions`) a future discount-resync would follow |
| P1 | `src/hooks/__tests__/expectedPayments.test.ts` | all | Test template to extend |
| P1 | `supabase/migrations/20260718130000_ai_analytics_views.sql` | ai.students / ai.payments | Explicit column lists to extend |
| P1 | `src/contexts/LeadsContext.tsx` | 278-354 | Conversion path that must pass the new field |

## Patterns to Mirror

- **Per-season field plumbing**: how `is_free_reapplication` flows — migration on `student_intakes` → `useCRMData` roster select → derived flag on the student object → consumed in `useExpectedPayments` (`:52`) and `EditStudentDialog` (fetch :193-205, write :312-319).
- **Server-validated creation**: `create-student` required-field validation block (`:70-81`) for the 0–100 range check.
- **Recompute-in-place**: `syncGatewayFeesForDistributions` (`useIncomeDistribution.ts:542-615`) — the only existing pattern for rebasing stored money rows; reuse its shape for the pending-payment rewrite in D9.
- **Plan normalization**: all plan lookups go through `normalizePlanName`/`getPlanByValue`; never key discount math off the raw string.
- **i18n**: every new string in all four of `src/locales/{en,uz,ru,ko}.json` under the `crm.*` / `payments.*` namespaces (do not reuse `sch.waiverPct` — that means university tuition waivers).

## Files to Change

| File | Action | Justification |
|---|---|---|
| `supabase/migrations/<ts>_student_discount_percent.sql` | CREATE | `student_intakes.discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100)`; partial index `WHERE discount_percent > 0`; attach existing `finance_audit_log_fn()` AFTER UPDATE trigger to `student_intakes` (guarded with `to_regproc` check since the fn lives in the other tree); `CREATE OR REPLACE` `ai.students` adding the column |
| `src/integrations/supabase/types.ts` | UPDATE | Regenerate after migration |
| `supabase/functions/create-student/index.ts` | UPDATE | Accept `discountPercent`, validate 0–100 server-side, persist on the `student_intakes` upsert |
| `src/components/crm/AddStudentDialog.tsx` | UPDATE | Discount input, pass to edge function, discounted total preview; drop local price table in favor of `useStudentPlan` helpers |
| `src/components/crm/EditStudentDialog.tsx` | UPDATE | Load/save per-season discount (same fetch as is_free_reapplication), disabled when exempt; pending-payment rewrite confirm (D9); consolidate price table |
| `src/contexts/LeadsContext.tsx` | UPDATE | Pass `discountPercent: 0` explicitly (D11) |
| `src/hooks/useStudentPlan.ts` | UPDATE | Core: `applyDiscount(amount, pct)` with the rounding rule; `getPlanPrice`, `getPaymentAmount`, `getInstallmentAmount`, `getPaymentSchedule` gain an optional `discountPercent` param (default 0 — zero-risk for untouched callers); export a `getStudentPricing(plan, mode, discountPercent)` convenience returning list/discounted pairs for previews |
| `src/hooks/useCRMData.ts` | UPDATE | Select `discount_percent` from `student_intakes` (:47-64), expose on student rows like `freeReapplication`; discount `expectedInitial` (:179) |
| `src/hooks/useExpectedPayments.ts` | UPDATE | Thread `student.discountPercent` into expected amounts (:63, :93-94); type on `StudentProfile` (:28-34) |
| `src/hooks/usePayments.ts` | UPDATE | `createPayment` callers supply discounted amounts; no formula change (completion/stats follow stored amount) |
| `src/components/payments/CreatePaymentDialog.tsx` | UPDATE | Discounted prefill (:63-91) + expected banner (:124-142); receive discount with the students prop |
| `src/components/crm/AddPaymentDialog.tsx` | UPDATE | Discounted prefill (:107-173) and banner; DB-fallback fetch adds discount; both call sites (`StudentDetail.tsx:2221-2233`, `StudentFinanceList.tsx:191`) pass it |
| `src/components/finance/ManualTransactionDialog.tsx` | UPDATE | Discounted prefill (:82-92) |
| `src/components/crm/EditPaymentDialog.tsx` | UPDATE | Show discounted expected as a hint so corrections don't re-type list price |
| `src/components/payments/InvoiceView.tsx` | UPDATE | List / discount / net lines when d > 0 |
| `src/components/finance/PlannedIncomePanel.tsx` | UPDATE | Per-student discounted expected (:48-49); optional "Discounts given" line |
| `src/components/finance/FinanceReports.tsx` | UPDATE | Discounted expected in collection rates (:110-111); switch plan matching to `normalizePlanName` (pre-existing bug, fix while touching) |
| `src/components/finance/StudentFinanceCard.tsx` | UPDATE | Discounted `getPaymentSchedule` (:54) |
| `src/components/crm/StudentDetail.tsx` | UPDATE | Discounted price description (:866-881); drop string price table (:137-141) |
| `src/components/crm/StudentList.tsx` | UPDATE | (only if a discount badge is wanted on roster rows — optional) |
| `src/hooks/useStaffBonuses.ts`, `src/hooks/useIncomeDistribution.ts`, `src/hooks/useOperationalFund.ts`, `src/hooks/useStudentBudgets.ts` | NONE (verify) | Flat deductions unchanged (D6); verify waterfall behavior under discounted gross in tests |
| `src/locales/en.json`, `uz.json`, `ru.json`, `ko.json` | UPDATE | New keys: discount label/hint, list/final price preview, rewrite-confirm text, invoice lines |
| `src/hooks/__tests__/expectedPayments.test.ts` | UPDATE | Discount cases (see Testing Strategy) |
| `src/hooks/__tests__/studentPlan.test.ts` | CREATE | Rounding + helper unit tests |

## NOT Building (v1)

- No change to staff bonus, budget-category, or operational-fund amounts (D6).
- No investor-view changes / "discounts given" contra-revenue line (D10) — but Task 1 captures the live view SQL into the repo so the follow-up is unblocked.
- No `leads.discount_percent` column (D11).
- No discounting of `scheduled_payments` (dead code, D12).
- No automatic re-distribution of already-completed payments when a discount is edited (D9) — the existing owner-run sync buttons plus EditPaymentDialog remain the correction path.
- No flat-amount (non-percentage) discounts — percentage only, which stays currency-safe.
- Not unifying `free` plan / `is_free_reapplication` / 100% discount into one mechanism (D7 defines precedence instead).

## Step-by-Step Tasks

### Task 0: Confirm business decisions with the owner
- ACTION: Get sign-off on D1–D9, especially: per-season grain (D1), flat deductions (D6), pending-only rewrite on edit (D9), and the Open Questions table. Everything below assumes these answers.

### Task 1: Live-DB pre-flight (read-only, via Supabase MCP)
- ACTION: `pg_get_viewdef` for `v_investor_position`, `v_investor_season_pnl`, `v_investor_season_monthly`, `v_finance_monthly_pnl`, `v_student_balance`; dump `ai_list_payments` and `finance_audit_log_fn` definitions; confirm the five `20260801000*` objects exist; verify none of the investor views embeds plan-price constants (expected: they aggregate `payments`/`expenses` rows and self-correct).
- IMPLEMENT: Commit the dumped SQL under `supabase/migrations/notes/` (or a docs file) so the repo finally carries the live definitions.
- Also confirm which real `payment_type` values exist in prod (`initial_deposit`/`remaining_payment`/`other` per the CHECK) so client branches matching `first_payment`/`full_payment` aren't relied on.

### Task 2: Migration + types
- IMPLEMENT: the migration described in Files to Change; backfill is implicit (`DEFAULT 0`).
- MIRROR: `20260803120000_free_reapplication_flag.sql` (comment style, partial index).
- Regenerate `src/integrations/supabase/types.ts`.

### Task 3: Discount-aware price core (`useStudentPlan.ts`)
- IMPLEMENT: `applyDiscount(amount: number, pct: number): number` → `Math.round(amount * (1 - pct / 100))`; clamp pct to [0,100]; add optional `discountPercent = 0` parameter to `getPlanPrice`, `getPaymentAmount`, `getInstallmentAmount`, `getPaymentSchedule` (schedule's `totalAmount` for installment = discounted first + discounted second, per D3/D4); add `getStudentPricing` returning `{ list, discounted, currency }` per mode for previews.
- All existing callers compile unchanged (default 0).

### Task 4: Creation path
- IMPLEMENT: `create-student` accepts `discountPercent` (number, optional, default 0), rejects out-of-range with a 400 (mirror the :70-81 validation block), writes it in the `student_intakes` upsert. Skip/ignore when `free` plan.
- IMPLEMENT: `AddStudentDialog` input + preview via `getStudentPricing`; remove the local price table.
- IMPLEMENT: `LeadsContext.convertToStudent` passes `discountPercent: 0`.

### Task 5: Edit path
- IMPLEMENT: `EditStudentDialog` loads the active-intake `student_intakes` row (extend the existing is_free_reapplication fetch), shows the discount input (disabled + hint when exempt per D7), saves alongside the flag.
- IMPLEMENT (D9): on discount change, fetch that student's **pending** payments for the intake; if any, show a confirm dialog listing them with old → new amounts; on confirm, update each `payments.amount` via the discounted helper. Never touch `partial`/`completed` rows; surface a notice when such rows exist ("N partial/completed payments keep their recorded amounts — correct via Edit Payment if needed").

### Task 6: Roster plumbing
- IMPLEMENT: `useCRMData` selects `discount_percent` with the roster (:47-64), exposes `discountPercent` on student rows next to `freeReapplication`; discount `expectedInitial` (:179).
- IMPLEMENT: `useExpectedPayments` consumes `student.discountPercent` (D7: exemption check at :52 stays first).

### Task 7: Recording paths write discounted amounts
- IMPLEMENT: discounted prefills + banners in `CreatePaymentDialog`, `AddPaymentDialog` (including its fallback profile fetch and both call sites), `ManualTransactionDialog`; hint in `EditPaymentDialog`.
- While touching `AddPaymentDialog`, align its allocation input with `usePayments` (`Math.min(paid, amount)` — fixes the pre-existing uncapped-overpayment divergence).

### Task 8: Read-time derivations
- IMPLEMENT: `PlannedIncomePanel` (:48-49), `FinanceReports` (:110-111 + normalizePlanName fix), `StudentFinanceCard` (:54), `StudentDetail` price description.

### Task 9: Invoice
- IMPLEMENT: `InvoiceView` list/discount/net lines when the student's discount > 0 (pass discount via props from the payments page student data; fall back to plain rendering when absent).

### Task 10: i18n
- IMPLEMENT: all new keys in en/uz/ru/ko.

### Task 11: Tests (see Testing Strategy)

### Task 12: AI surface
- IMPLEMENT: `ai.students` view exposes `discount_percent` (in the Task 2 migration); extend the hanguk-ai-chat system-prompt schema notes if they enumerate columns.

### Task 13: Docs
- IMPLEMENT: short section in `hanguk_app/docs/finance_audit_and_upgrade_plan.md` (or a sibling doc) recording the discount design, D1–D12, and the deficit-floor caveat.

### Task 14 (stretch, if time allows): Deficit-floor surfacing
- IMPLEMENT: in `IncomeDistributionPanel`, when a payment's fixed deductions exceeded its gross (netIncome floored to 0), render a warning badge on that month so the owner can see discounts eating the distributable base.

## Testing Strategy

- **Unit (`studentPlan.test.ts`)**: `applyDiscount` rounding (15% of 5,000,000 = 4,250,000; 33% of $5,000 = $3,350; 33% of 4,000,000 = 2,680,000); clamping; `getPaymentSchedule` installment total = sum of discounted parts; 0% and 100% edges.
- **Unit (`expectedPayments.test.ts` extension)**: discounted one-time expected/remaining/status; discounted split (first + second independently); discount + freeReapplication → exemption wins; 100% discount → expected 0 but row still emitted (unlike exemption); completion flips exactly at the discounted amount (paid == discounted → completed).
- **Manual QA script** (staff flows): add student with 15% discount → prefill in all three payment dialogs shows discounted; pay discounted amount in full → status completed, allocation chain fires once, income distribution rows show discounted base; invoice shows three lines; PlannedIncomePanel/FinanceReports/StudentFinanceCard agree with each other; edit discount with a pending payment → confirm dialog → amount rewritten; student portal insights and messages rail show discounted balance.
- **Regression**: students with discount 0 behave byte-identically (default-0 params); free-reapplication students unchanged; `standart` legacy spellings still normalize.

## Validation Commands

```bash
npm run lint
npx tsc -p tsconfig.app.json --noEmit
npx vitest run src/hooks/__tests__/expectedPayments.test.ts src/hooks/__tests__/studentPlan.test.ts
npm run build
```

## Acceptance Criteria

1. Staff can enter a 0–100 discount % when adding a student; out-of-range is rejected server-side and in the UI.
2. Every expected-amount surface (expected payments, planned income, collection rates, finance cards, initial-overdue flag, previews) shows the discounted figure for that student; students with 0% are unchanged everywhere.
3. All three payment-recording paths prefill and store discounted `payments.amount`; paying the discounted price in full marks the payment `completed` and fires the allocation chain exactly once on the discounted gross.
4. Invoices show list price, discount, and net when a discount applies.
5. Editing a discount rewrites only pending payment amounts, after an explicit confirm; partial/completed rows are never silently changed.
6. Free-reapplication students ignore the discount (expected 0, unchanged behavior).
7. Reports, SQL views, AI chat, and the student portal reflect discounted balances with no code change beyond this plan (they follow stored amounts).
8. Staff bonus, budget allocations, and operational-fund deductions are unchanged (flat), and the plan documents the resulting margin behavior.
9. All new UI strings exist in en/uz/ru/ko.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A prefill site is missed → undiscounted `amount` stored → phantom balance / stuck-partial | Medium | High | Single choke point (helpers default-0 param); grep-audit all 17 `useStudentPlan` importers in review; regression test comparing derived expected vs dialog prefill for the same student |
| Idempotency trigger overwrites a discounted amount with a stale undiscounted re-submit | Low | High | All insert paths compute from the same helper, so a re-submit carries the same discounted value; D9 keeps pending rows in sync after edits |
| Rounding mismatch between expected and stored amounts breaks the `>=` completion test | Low | High | One `applyDiscount` function used by both writers and readers (D4); unit tests pin exact values |
| Discount > margin drives netIncome to the silent 0 floor | Medium | Medium | D6 documented; Task 14 warning badge; owner sign-off on max discount policy (Open Q3) |
| Client-side RLS gap: non-owner staff recording a completed payment already fails to write distribution rows silently | Pre-existing | Medium | Out of scope to fix, but discount work must not add new owner-only writes to staff paths; sync buttons remain the recovery |
| Multi-currency: USD no_risk discount + UZS deductions | Pre-existing | Medium | Percentage-only discounts (currency-safe); no new cross-currency sums |
| `command-center-webhook` writes `status='paid'` (invalid) and bypasses discount logic | Pre-existing | Low (currently inert) | Flag to owner; fix separately — do not let it silently start working mid-feature |
| Legacy lead plan values (`standart_2` etc.) skip expected payments entirely | Pre-existing | Medium | Out of scope; noted so discount work doesn't mask it (getPlanByValue returns undefined → student silently unbilled) |

## Open Questions (need owner answers before/during Task 0)

1. **Grain confirm**: per-season discount (recommended, D1) — or should a discount follow the student across seasons?
2. **Are "sale %" and "discount %" one field or two stacked fields?** (Plan assumes one, D2.)
3. **Maximum discount policy** — any cap (e.g. 50%) or approval rule for large discounts? (Plan ships 0–100 with CHECK; a cap is a one-line change in the edge function + UI.)
4. **Should staff bonuses shrink for discounted students?** (Plan keeps them flat, D6.)
5. **Should the investor P&L eventually show "discounts given" as a contra-revenue line?** (Deferred, D10; Task 1 makes it possible.)
6. **Should leads carry a negotiated discount** so conversion inherits it? (Deferred, D11.)
7. **Is a 100% discount ever legitimate**, or should the UI steer staff to the free-reapplication flag / free plan instead? (Plan allows it but emits expected-0 rows, D7.)

## Notes

- The single highest-leverage insight from the system review: **the database has no notion of a student's price at all** — fixing the write side (`payments.amount` stored discounted) is what makes ~10 read surfaces (SQL views, AI chat, student portal, reports) correct for free. The read-time derivations are the second half and must land in the same release, or dashboards and stored rows will disagree.
- The full subsystem maps behind this plan (8 areas + completeness audit: exact `file:line` formulas for every money calculation in the app) were produced during the 2026-09-01 review session; key facts are inlined above.
