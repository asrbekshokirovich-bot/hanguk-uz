# Phase 3 — design sketch (NOW IMPLEMENTED in code; deployment pending)

> **Status update 2026-05-08 (later):** the implementation referenced
> below is committed in the worktree. See
> [`CURRENT_STATUS.md` §13](../../CURRENT_STATUS.md#13-update--2026-05-08-later--phase-3-implementation-landed)
> for the file inventory and test counts. Deployment is delegated to
> [`docs/runbooks/gemini-deploy-prompt.md`](../../docs/runbooks/gemini-deploy-prompt.md).
>
> The remainder of this document is the original design sketch, kept
> for posterity and as a reference for future Phase 4+ work that
> extends these subsystems.
>
> Companions:
> - [`PHASE_2_NOTES.md`](PHASE_2_NOTES.md) — current state of the world
> - [`UNIVERSITY_DB_BUILD_PLAN.md` §I-Phase-3](../../UNIVERSITY_DB_BUILD_PLAN.md) — original plan scope
> - [`docs/decisions/`](../../docs/decisions/) — 10 ADRs that reframe the original plan

## Headline — Phase 3 reframed through the ADRs

The plan's §I-Phase-3 was written before ADR-007 (internal-only) and
ADR-004 (Uzbek deferral). After filtering through the ADRs:

| §I-Phase-3 deliverable | Status under ADRs | Phase 3 action |
|---|---|---|
| All 110 priority universities live | Carries forward | Build |
| Difficulty-5 fields (scholarship predicates, correction-notice routing) | Carries forward | Build |
| `notify-tracked-changes` Edge Function + push delivery | Carries forward | Build |
| `/institutions/compare` Flutter route | Carries forward | Build |
| `/admin/review` Flutter route | Carries forward (replaces Studio for in-office reviewer per ADR-005) | Build |
| Korean → English translation pipeline | Carries forward | Build (default-on per ADR-004) |
| Korean → Uzbek translation pipeline | **Gated** on native Uzbek reviewer (ADR-004) | Wire pipeline; keep `LanguageNotEnabledError` until reviewer hired |
| Public-facing API for partners | Deferred indefinitely (ADR-007) | Skip |

Net Phase 3 build list — six items: English translation, signed-URL
function, Hetzner VPS provisioning, push notifications, `/admin/review`
route, compare screen.

## 1. English translation worker

### 1.1 Goal

Default-on Korean → English translation of every prose field
(scholarship narratives, requirement descriptions, document checklist
notes). Structured fields (dates, amounts, quotas) stay locale-formatted
client-side via Flutter `intl`; translation is for prose only.

### 1.2 Pipeline shape

```
recruitment_units row inserted/updated
  ↓
trigger fn_enqueue_translation()  (new in Phase 3)
  ↓
public.translation_queue                (new table)
  ↓
worker: services/uni_db/translate/worker.py
  - poll translation_queue every 30s
  - for each row, call translate/provider.py
    └─ default: Naver Papago (ko→en)
    └─ fallback: Anthropic Claude (ko→en, prose only, cached)
  - run translate/back_translate_qc.py — back-translates en→ko, scores
    similarity vs original; rows below 0.7 confidence flag for HITL
  - write translations to {target_table}_translations (one row per
    target_lang per source row)
  - mark translation_queue row done
```

### 1.3 New files (planned)

```
services/uni_db/src/uni_db/translate/
├── __init__.py
├── provider_papago.py       # ko→en via Naver Papago REST
├── provider_anthropic.py    # ko→en fallback via Claude
├── worker.py                # systemd-managed long-running poller
├── back_translate_qc.py     # confidence scoring
├── glossary.py              # locked-term lookup (institutions, programs)
└── tests/
    ├── test_provider_papago.py
    ├── test_provider_anthropic.py
    ├── test_worker.py
    └── test_back_translate_qc.py
```

### 1.4 New migration (planned, not applied)

```
20260701000000_uni_db_v3_translation_queue.sql
  - public.translation_queue (id, target_table, target_id, target_lang,
    source_text, status, queued_at, completed_at)
  - public.recruitment_units_translations
  - public.scholarships_translations
  - public.documents_translations
  - trigger fn_enqueue_translation() on the three source tables
  - RLS: insert/update by service role only; select by fn_is_app_user()
```

### 1.5 Cost

Per [ADR-001](../../docs/decisions/001-budget-ceiling.md): English
translation budgeted at ~$15/mo for the contracted-cohort volume
(Papago primary at $0.020/1k chars; Claude fallback rare). Stays well
under the $80/mo internal-tool reframe.

### 1.6 ADR-004 reversal trigger for Uzbek

When the native Uzbek reviewer joins, the same pipeline gains a second
provider chain (`provider_anthropic` only — Papago doesn't support uz).
Flip `UNI_DB_TRANSLATION_LANGUAGES=en,uz` and the worker picks up
`target_lang='uz'` rows. No code change needed beyond a glossary entry.

## 2. Signed-URL Edge Function

### 2.1 Goal

Per [ADR-009](../../docs/decisions/009-pdf-blob-access.md): cached PDFs
accessible to authenticated app users via 15-minute signed URLs, with
every grant logged to `pdf_access_log` for audit.

The function lives in Supabase Edge Functions (Deno runtime, deploys
via `supabase functions deploy`).

### 2.2 Function shape

```
supabase/functions/get-pdf-url/index.ts
  POST { document_id: string }
  ↓
  1. Verify caller is authenticated (Authorization: Bearer <jwt>)
  2. Verify caller is an app user (call rpc fn_is_app_user())
  3. Look up storage_object_path from public.documents
  4. Call supabase.storage.from('guideline-blobs')
       .createSignedUrl(path, 60 * 15)
  5. Insert audit row into public.pdf_access_log
       (user_id, document_id, granted_at, expires_at, ip)
  6. Return { signed_url, expires_at }
```

### 2.3 Why an Edge Function and not direct client SDK calls

The Flutter client could call `createSignedUrl` directly via the
Supabase JS bridge — but then the audit log either misses the grant
or relies on an after-the-fact trigger that can be skipped. The Edge
Function is the chokepoint that guarantees `pdf_access_log` and the
signed URL ship together atomically.

### 2.4 New migration (planned)

```
20260702000000_uni_db_v3_pdf_access_log.sql
  - public.pdf_access_log (id, user_id, document_id, granted_at,
    expires_at, ip, user_agent)
  - RLS: insert by service role; select by user_id = auth.uid()
    OR by uni_db_reviewer role
```

The `pdf_access_log` table referenced in
[`PHASE_2_NOTES.md`](PHASE_2_NOTES.md#components-added--promoted-in-phase-2)
is still pending — Phase 2 created the bucket but not the audit
table. The Phase 3 migration above closes that gap.

### 2.5 Flutter client wire-up

```dart
// lib/features/uni_db/data/pdf_url_service.dart  (new)
class PdfUrlService {
  Future<String> getSignedUrl(String documentId) async {
    final res = await Supabase.instance.client.functions.invoke(
      'get-pdf-url',
      body: {'document_id': documentId},
    );
    return res.data['signed_url'] as String;
  }
}
```

Used by `institution_detail_screen.dart` when the user taps "Open
original PDF". Re-fetched on each tap (15-minute window) — no client-side
caching of the URL.

## 3. Hetzner VPS provisioning

### 3.1 Goal

Per [ADR-003](../../docs/decisions/003-worker-placement.md): move the
discovery / extraction / OCR / translation workers off the developer
laptop onto a 24/7 host. Hetzner CX22 in Helsinki or Falkenstein
(2 vCPU / 4 GB RAM / 40 GB disk, €5/mo).

### 3.2 What runs on the VPS

| Process | Source | Lifecycle |
|---|---|---|
| `discovery-poll.service` | `services/uni_db/src/uni_db/discovery/poll.py` | systemd timer, every 6 hours |
| `extract-worker.service` | `services/uni_db/src/uni_db/extract/worker.py` | systemd long-running, polls `extraction_queue` |
| `translate-worker.service` | new in Phase 3 | systemd long-running, polls `translation_queue` |
| `ocr-worker.service` | `services/uni_db/src/uni_db/parse/ocr_easyocr.py` | systemd long-running, polls `ocr_queue` |
| `metrics-export.service` | `services/uni_db/src/uni_db/metrics/export.py` (Phase 3) | sidecar pushing to a status endpoint Hanguk owns |

All four processes are stateless workers that read/write Supabase. No
shared state on the VPS — if it dies we replace it with a fresh CX22
in 10 minutes.

### 3.3 systemd unit template (planned)

```ini
# /etc/systemd/system/uni-db-extract.service
[Unit]
Description=uni_db extract worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=uni-db
Group=uni-db
WorkingDirectory=/opt/uni_db
EnvironmentFile=/etc/uni_db/env
ExecStart=/opt/uni_db/.venv/bin/python -m uni_db.extract.worker
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/cache/uni_db /var/log/uni_db

[Install]
WantedBy=multi-user.target
```

Source-of-truth template lives at `infra/systemd/uni-db-*.service` (new
directory, planned).

### 3.4 Deployment plan

```
infra/
├── README.md            # provisioning runbook
├── bootstrap.sh         # idempotent first-boot script (apt deps,
│                        # python 3.12, ufw, fail2ban, sudoers)
├── deploy.sh            # rsync + venv install + systemctl restart
├── systemd/
│   ├── uni-db-discovery-poll.timer
│   ├── uni-db-discovery-poll.service
│   ├── uni-db-extract.service
│   ├── uni-db-translate.service
│   └── uni-db-ocr.service
└── env.example          # /etc/uni_db/env template
```

### 3.5 What stays OFF the VPS

- The Supabase Edge Functions — those run on Supabase's edge network
- The Flutter app — it's the user-facing tier
- The Korean source PDFs — they live in Supabase Storage, not on the
  VPS disk. The VPS only streams them through during OCR.

### 3.6 Operational targets

| Metric | Target |
|---|---|
| Discovery polling interval | 6 hours per source |
| Extraction queue depth | < 50 items at any time |
| OCR throughput | ≥ 20 pages/minute (CPU only — no GPU on CX22) |
| Translation queue lag | < 30 minutes from insert to translation |
| VPS memory headroom | ≥ 1 GB free at all times |
| Disk usage | < 25 GB (≈40% of the 40 GB volume) |

If OCR throughput drops below target, switch the VPS to CX32 (4 vCPU /
8 GB RAM, €11/mo) — same shape, double the cores.

## 4. `notify-tracked-changes` Edge Function + push delivery

### 4.1 Goal

When a 정정공고 detected on a user's tracked university clears HITL,
deliver a push notification within 1 hour (per §I-Phase-3 success
criteria).

### 4.2 Pipeline

```
review_decisions row inserted with action='accepted' on a
  recruitment_units row
  ↓
trigger fn_emit_change_event()  (new)
  ↓
public.change_event_outbox      (new table — outbox pattern, not
                                  pg_notify, so retries survive crashes)
  ↓
supabase/functions/notify-tracked-changes/index.ts
  - cron-triggered every minute
  - SELECT FROM change_event_outbox WHERE status='pending'
  - For each event:
    └─ join user_tracked_universities to find affected users
    └─ for each user, build localized push payload
    └─ dispatch to:
       - FCM (Android)        via firebase-admin
       - APNs (iOS)           via apns2
       - Web Push (web)       via web-push (VAPID)
    └─ mark event 'sent'
```

### 4.3 Why outbox + cron rather than realtime

Supabase Realtime would be simpler — but if the function fails to
deliver to FCM we'd lose the event. The outbox table makes retries
safe; the cron Edge Function is idempotent and can be replayed.

### 4.4 New migration (planned)

```
20260703000000_uni_db_v3_change_event_outbox.sql
  - public.change_event_outbox (id, target_table, target_id, event_type,
    payload jsonb, status, queued_at, sent_at, attempts)
  - public.user_push_tokens (user_id, platform, token, last_seen_at)
  - trigger fn_emit_change_event() on review_decisions
```

### 4.5 What event_type values exist

The Hanguk app already has a `notification_event` enum on the existing
prod schema. Phase 3 extends it with:

| Value | Meaning |
|---|---|
| `recruitment_changed` | A field on a tracked recruitment unit changed |
| `correction_notice` | A 정정공고 was published |
| `deadline_within_7d` | Deadline crossing inside 7 days |
| `deadline_within_24h` | Deadline crossing inside 24 hours |

Adding to the enum requires a migration and a coordinated app-side
release (clients on old versions ignore unknown events, but the server
should not emit them until the rollout is at least 95%).

## 5. `/admin/review` Flutter route

### 5.1 Goal

Replace Supabase Studio for the in-office reviewer
(see [`reviewer-onboarding.md` §3.2](../../docs/runbooks/reviewer-onboarding.md)).
Side-by-side panels: cached PDF page on the left, extracted JSON form
on the right, accept / edit / reject buttons.

### 5.2 Route registration

```dart
// lib/features/uni_db/presentation/admin_review_screen.dart  (new)
// Registered conditionally in app_router.dart:
if (kUniDbEnabled) ..._uniDbRoutes(),

// _uniDbRoutes() adds:
GoRoute(
  path: '/admin/review',
  builder: (_, __) => const AdminReviewScreen(),
  redirect: (ctx, state) async {
    final role = await ctx.read(profileRoleProvider.future);
    return role == 'uni_db_reviewer' ? null : '/';
  },
),
```

### 5.3 Backing data

Powered by the existing `v_review_queue_dashboard` view plus the SQL
helpers (`fn_review_accept`, `fn_review_edit_accept`, `fn_review_reject`)
already shipped in Phase 1. No new RPCs needed.

### 5.4 PDF panel

Uses the signed-URL Edge Function (§2). The PDF renders in-app via
`pdfx` (already a dependency for the existing document features). Page
synchronisation between PDF and JSON form is per-field — clicking a
field highlights the page region the extractor pulled it from (data
already present in the queue row's `source_locations` JSONB).

## 6. University compare screen

### 6.1 Goal

Per §I-Phase-3 deliverable 4: 2-up institution comparison for tracked
universities. Picks two institutions the user is tracking, shows
deadlines, tuition, requirements, and document checklists side-by-side.

### 6.2 Route

```dart
// lib/features/uni_db/presentation/institution_compare_screen.dart
// already exists as a Phase 1 stub — Phase 3 fills out the implementation.
```

The stub already wires through the router. Phase 3 work is purely
inside the screen file plus a new provider that fetches both
institutions' rows in one round-trip.

## 7. Migration drafts (named only — none applied in Phase 3 design phase)

| File | Purpose |
|---|---|
| `20260701000000_uni_db_v3_translation_queue.sql` | Translation pipeline tables + trigger |
| `20260702000000_uni_db_v3_pdf_access_log.sql` | Audit table for signed-URL grants |
| `20260703000000_uni_db_v3_change_event_outbox.sql` | Outbox pattern for push events |
| `20260704000000_uni_db_v3_notification_event_enum.sql` | Extend the existing enum (coordinated with prod schema baseline) |

The fourth migration is gated on the real prod baseline being in place
(per [`MIGRATION_BASELINE_TODO.md`](../../supabase/migrations/MIGRATION_BASELINE_TODO.md))
because the `notification_event` enum lives on the existing prod
schema and the staging shim doesn't have it.

## 8. Tests planned

Same shape as Phase 2 — write unit tests under each module's `tests/`
subdirectory. Targets:

```
+ test_translate_provider_papago    ~ 6 tests
+ test_translate_provider_anthropic ~ 4 tests
+ test_translate_worker             ~ 8 tests
+ test_back_translate_qc            ~ 5 tests
+ test_glossary                     ~ 4 tests
+ test_change_event_outbox_trigger  ~ 5 tests
+ test_pdf_access_log_rls           ~ 3 tests (pgTAP via supabase)
+ test_admin_review_widget          ~ 6 tests (Flutter widget tests)
+ test_institution_compare_widget   ~ 4 tests
                                  ----
Phase 3 additions                ~ 45 tests
Phase 0+1+2 baseline               210 tests
                                  ----
Phase 3 target                   ~ 255 tests
```

## 9. What's still mocked / re-enable triggers (carries from Phase 2)

| Capability | Re-enable |
|---|---|
| Anthropic Claude live calls | `ANTHROPIC_API_KEY` set + `UNI_DB_LIVE_APIS=true` |
| EasyOCR live model | `pip install -e .[heavy]` then `UNI_DB_LIVE_APIS=true` |
| Naver Papago | `NAVER_PAPAGO_CLIENT_ID/SECRET` + `UNI_DB_LIVE_APIS=true` (new in Phase 3) |
| Live ac.kr crawl | `UNI_DB_LIVE_CRAWL=true` + owner approval |
| Uzbek translation | `UNI_DB_TRANSLATION_LANGUAGES=en,uz` after native reviewer hired |
| FCM / APNs / Web Push | Service account keys + `UNI_DB_PUSH_ENABLED=true` |

## 10. Phase 3 entry-criteria checklist

Don't start Phase 3 implementation until:

- [x] Real prod schema baseline replaces the staging shim
      (cleared 2026-05-08; `00000000000001_lovable_baseline.sql` is
      now a sanitized pg_dump of Hanguk 2026 prod)
- [ ] In-office reviewer hired and granted `role='uni_db_reviewer'`
      ([ADR-005](../../docs/decisions/005-hitl-reviewer.md))
- [ ] Anthropic API key + billing alerts at $200/$400/$1000 thresholds
      ([ADR-001](../../docs/decisions/001-budget-ceiling.md))
- [ ] First live ac.kr crawl approved (top-30 seed sources)
- [ ] Phase 2 migrations applied to production (currently staging-only)
- [ ] Hetzner account created with payment method (€5/mo CX22)
- [ ] Naver Papago API account provisioned (free tier covers Phase 3
      English volume)

Of those, the first is the longest pole — see
`MIGRATION_BASELINE_TODO.md` for the steps.

## 11. Out of scope for Phase 3 (deferred per ADRs)

These are §I-Phase-3 / §I-Phase-4 deliverables that the ADRs deferred:

- Public-facing REST API (ADR-007)
- Premium tier billing (ADR-007 / 008)
- Counselor mode B2B onboarding (ADR-008)
- Vietnamese / Mongolian translations (Phase 4 in original plan; needs
  Vietnamese + Mongolian native reviewers, neither in pipeline yet)
- Argilla self-host on the VPS (G.3 — only triggered if review queue
  exceeds 200 items/week sustained over 4 weeks)

## 12. Estimated effort

Per the §I plan budget (15 dev-days per phase) the Phase 3 split is
roughly:

| Workstream | Days |
|---|---|
| English translation pipeline + tests | 4 |
| Signed-URL Edge Function + audit log + Flutter wire-up | 2 |
| Hetzner VPS provisioning + systemd + deploy.sh | 2 |
| `notify-tracked-changes` + outbox + push providers | 4 |
| `/admin/review` Flutter route | 2 |
| Compare screen | 1 |
| **Total** | **15** |

Sequencing: English translation first (largest, most dependencies),
then Edge Function + push notifications in parallel, then VPS
provisioning once the workers are stable enough to deploy, then the two
Flutter screens last (they consume the backend work).
