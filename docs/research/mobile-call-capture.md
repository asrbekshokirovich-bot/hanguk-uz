# Capturing staff phone calls from a personal Android phone (Call Sync)

**Ask:** an APK installed on the owner's (and later each staff member's) personal
phone that watches every call made or received on **one chosen SIM**, captures the
other party's number, records the conversation, and attaches it automatically to
the matching student or lead — or leaves it for staff to attach by hand.

**Scope of this document:** (1) is it possible on today's Android, (2) which
technologies, (3) a build plan that plugs into what Hanguk already has.
**Date:** 2026‑09‑02. Platform facts checked against the Android developer docs
and the public statements of the main call‑recorder vendors (sources at the end).
Uzbek legal points are flagged as *unverified* where that is the honest status.

---

## 0. Executive verdict

| Capability | Feasible on a sideloaded APK? | Confidence |
|---|---|---|
| Detect every call on the selected SIM (number, direction, start/end, duration, SIM slot / carrier) and auto‑attach it to the student or lead | **Yes**, on any Android 8+ phone, no root, no special OEM. | High |
| Upload metadata and create `calls` rows automatically, staff attach the rest | **Yes** — the identity spine (`resolveIdentity`, `communication_identities`, `LinkContactDialog`) already does this for Mediateka calls. | High |
| Record **two‑way call audio** from a normal third‑party app | **No official API since Android 10.** Third‑party apps are denied the call audio stream; only pre‑installed / privileged apps hold `CAPTURE_AUDIO_OUTPUT`. | High |
| Record audio anyway | **Yes, with caveats**, by one of four device‑dependent routes (§2.3). The most reliable one is *not* recording ourselves: it is syncing the files the phone's **own built‑in recorder** produces (Xiaomi/HyperOS, Samsung in some regions). | Medium — must be verified on the actual phone |
| Transcribe + analyse Uzbek/Russian audio and search it | **Already built** (`process-call-recording`: ElevenLabs Scribe → Gemini → pgvector). A synced recording enters the same pipeline untouched. | High |

**Recommendation.** Build it as a native **Call Sync** module inside the existing
Capacitor staff app (`com.hanguk.app`), in this order:

1. **Phase 0 (2–3 days): probe the actual phone.** A throw‑away build that tells us
   which recording route works on *that* model/Android version before we commit.
2. **Phase 1: metadata sync.** Reliable everywhere, delivers most of the CRM value
   (every call logged, timed, and linked to the right person, per SIM).
3. **Phase 2: audio via pluggable "recording adapters"**, picked per device:
   OEM‑recorder folder sync first, our own accessibility‑assisted recorder as the
   fallback, Shizuku/root as opt‑in advanced modes. Recordings land in Supabase
   Storage and flow through the existing transcription/analysis pipeline.
4. **Phase 3: hardening and staff rollout** (battery‑killer survival, consent,
   admin visibility, per‑staff devices).

**The honest alternative.** Everything Android makes hard becomes trivial if the
SIM leaves the phone: a **GSM gateway** in the office holding the same SIM, or
mobile/FMC numbers from Mediateka (already integrated via `voip-webhook`), or —
cheapest of all for a single line — a **SIM‑card desk phone with a built‑in
recorder** (the owner already has one, see §6.1: confirmed automatic recording,
no PBX, no Android app). Recording there is solved and works 100 % of the time;
it costs hardware or a monthly fee and only covers calls taken at that seat.
Section 6 compares the options so the choice is deliberate.

---

## 1. What Hanguk already has (and will reuse)

| Piece | Where | Reuse |
|---|---|---|
| `calls` table: `phone_number`, `direction`, `status`, `duration`, `recording_url`, `external_call_id`, `voip_provider`, `staff_id`, `student_id`, `lead_id` | `supabase/migrations/20260104081730_*.sql`, `..._20260210094629_*.sql` | Mobile calls become rows with `voip_provider = 'mobile'`. |
| Identity spine: `communication_identities`, `student_phones`, `normalize_phone()` (SQL) / `normalizePhone()` (edge + client) | `_shared/identity.ts`, `src/lib/phone.ts` | `resolveIdentity(admin, 'phone', number)` links the row; unmatched → staff attach with `LinkContactDialog`, which already back‑links every call from that number. |
| Processing pipeline: trigger `enqueue_call_processing` (fires when `recording_url` is set and `status = 'completed'`) → `process-call-recording` → Scribe / Gemini → `call_transcripts`, `call_analyses`, `communication_embeddings`; `dispatch-comm-jobs` retries | `20260606120000_communication_intelligence_foundation.sql`, `supabase/functions/process-call-recording` | Unchanged. Only `_shared/recording.ts#fetchRecording` needs to learn to read from Supabase Storage. |
| Playback: `RecordingPlayer` → `mediateka-recording` proxy (staff JWT, role check, Range support) | `src/components/calls/RecordingPlayer.tsx`, `supabase/functions/mediateka-recording` | Generalise the proxy to serve storage‑backed recordings too. |
| Manual logging: `ClickToCall` inserts a `calls` row with `status = 'no_answer'`, then `CallOutcomeDialog` | `src/components/calls/ClickToCall.tsx` | The sync must **merge** into that row instead of creating a duplicate (§3.4). |
| Android shell: Capacitor 8, `minSdk 24`, `targetSdk 36`, `RECORD_AUDIO` already declared, no custom plugins yet | `android/`, `capacitor.config.ts` | Add one Kotlin plugin package `com.hanguk.app.callsync`. |
| Distribution: the staff app is sideloaded (Despia/Play optional); CI only builds the Flutter *student* app | `STORE_DEPLOYMENT.md`, `.github/workflows/build-test-apk.yml` | Add a CI job that builds a sideload APK of the staff app with a `callsync` flavor that is **never** uploaded to Google Play (§2.4). |

---

## 2. Is it possible? The Android facts

### 2.1 The rule that decides everything

Since **Android 10 (API 29)** the platform's audio‑input sharing policy says: while
a phone call is active, the call always gets the audio; a second app may capture
it **only if it is an accessibility service or a privileged/pre‑installed app
holding `CAPTURE_AUDIO_OUTPUT`**. Ordinary apps get silence. The telephony sources
(`VOICE_CALL`, `VOICE_UPLINK`, `VOICE_DOWNLINK`) require that privileged
permission, which a sideloaded APK cannot obtain. Google's own statement is
blunter: Android has never officially supported third‑party call‑audio access.

Google Play additionally **bans** using the Accessibility API for call recording
(policy effective 11 May 2022). That is a *store distribution* rule, not an OS
block: **it does not apply to a sideloaded APK**, which is exactly the delivery
model requested here. It does mean the recorder must never ship inside a Play
build of the staff app.

### 2.2 Metadata: fully supported, no tricks

| Need | API | Notes |
|---|---|---|
| Know a call started/ended | Manifest `BroadcastReceiver` for `TelephonyManager.ACTION_PHONE_STATE_CHANGED`; on API 31+ also `TelephonyCallback.CallStateListener` registered on `TelephonyManager.createForSubscriptionId(subId)` so we listen to **only the selected SIM** | The broadcast wakes the app even when it is not running, so no permanent foreground service is needed for metadata. |
| Number, direction, duration, exact times | `CallLog.Calls` content provider (`NUMBER`, `TYPE`, `DATE`, `DURATION`, `PHONE_ACCOUNT_ID`) queried right after the call ends, plus a `ContentObserver` as a safety net | Since Android 9 the phone‑state broadcast no longer carries the number unless the app holds `READ_CALL_LOG`; we read the call log anyway, so this is fine. |
| Which SIM the call used | `PHONE_ACCOUNT_ID` on the call‑log row (on modern Android it is the SIM's ICCID) matched against `SubscriptionManager.getActiveSubscriptionInfoList()` (`simSlotIndex`, `subscriptionId`, `iccId`, `carrierName`, `number`) | Gives "SIM 2 · Ucell · +998 9x…" for the UI and lets the app ignore the private SIM entirely. |
| Dial out from the CRM on the chosen SIM | `Intent.ACTION_CALL` with `TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE` | Optional Phase 3 improvement to `ClickToCall` on native. |

Permissions: `READ_PHONE_STATE`, `READ_CALL_LOG`, `READ_PHONE_NUMBERS`,
`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE`. All are
normal runtime permissions on a sideloaded app.

### 2.3 Audio: four routes, ranked by reliability

| Route | How | Quality | Requirements on the phone | Verdict |
|---|---|---|---|---|
| **A. OEM built‑in recorder + file sync** | The phone's own dialer records (auto‑record all calls). Our app watches the recordings folder via `MediaStore`/`ContentObserver`, matches each file to the call by timestamp and number, uploads it. | Two‑way, clean (the OEM has the privileged permission). | **Xiaomi / Redmi / POCO (MIUI, HyperOS):** built‑in, files in `MIUI/sound_recorder/call_rec/` — the most common Android brand in Uzbekistan. **Samsung One UI:** built‑in only in some regions (US on One UI 7; blocked in the EU) — files in `Recordings/Call/`; must be checked on the actual handset. **Google Phone app (Pixel and many others):** region‑gated and stores files privately, **not reachable**. | **Best where available.** Zero audio hacks, survives OS updates. |
| **B. Our own recorder, accessibility‑assisted** | Enable our `AccessibilityService`, then record with `AudioRecord` using `VOICE_RECOGNITION` (Android 10+) or `VOICE_COMMUNICATION` (Android 9) inside a `microphone` foreground service. This is the Cube ACR / ACR‑legacy method. | Device‑dependent: often good near‑end, weak or missing far‑end; Bluetooth/headset calls unsupported; some 2023+ phones give silence. | On Android 13+ a sideloaded app must be granted "Allow restricted settings" before accessibility can be enabled. On Android 14+ a `microphone` foreground service **cannot be started from the background** unless the app is exempt from battery optimisation or holds "Display over other apps" (`SYSTEM_ALERT_WINDOW`; Android 15 additionally requires a visible overlay, which we can satisfy with a small "Recording" bubble during calls). | **Fallback.** Worth having because it needs nothing from the OEM, but expect breakage and one‑sided audio on some phones. |
| **C. Shizuku (wireless ADB)** | The user installs Shizuku, pairs via Wireless debugging; our app then uses shell‑level privileges to reach the telephony audio route (the method ACR Phone recommends today). | Two‑way, including Bluetooth, on most phones. | Shizuku must be re‑started after every reboot (a manual step); behaviour varies by ROM. | **Opt‑in "advanced" mode** for a technically comfortable owner. Not for a fleet. |
| **D. Root (Magisk) + BCR‑style system app** | Install as a system app with `CAPTURE_AUDIO_OUTPUT`, record `VOICE_CALL` directly. | Best possible; stereo up/downlink on Pixel. | Unlocked bootloader; voids warranty; banking apps may refuse to run. | **Not recommended** for staff personal phones. |
| E. Speakerphone + microphone | Force speaker, record `MIC`. | Poor, both parties audible only if speaker is on. | None. | Emergency fallback only; not planned. |

Two things are true at once: recording **is** achievable on most phones people
actually own in Tashkent (Xiaomi‑heavy market → route A), and there is **no route
that Google guarantees**. The plan therefore treats audio as an adapter chosen per
device, with metadata sync as the guaranteed baseline.

#### Device note — Samsung Galaxy A33 5G (the school's current phone)

Checked specifically because it is the device Phase 0 will run on:

- **Route A (OEM built‑in recorder) is unlikely to be available.** Samsung's
  native call recording is enabled per‑region via CSC code; the confirmed‑enabled
  list (Phone app → ⋮ → Settings → "Record calls") includes the US, Vietnam,
  Ukraine, Israel and India — Uzbekistan is not on it. **Verify on the actual
  handset before assuming it's absent**, since it costs nothing to check.
- **Route B (accessibility + `VOICE_RECOGNITION`) is the fallback, but the
  Galaxy A‑series is a documented weak spot.** Multiple Galaxy A owners (A14,
  A33, A50) report the far‑end voice is missing or faint with third‑party
  recorders on Android 10+ — Samsung's audio‑routing software makes the
  workaround less reliable here than on, say, a Xiaomi phone. If Voice Recognition
  mode yields one‑sided audio, Cube ACR's own fallback is **Microphone mode**
  (records via the live mic instead of the call stream) — lower quality, but
  reliably two‑way. Bluetooth/wired‑headset calls do not record under either
  mode; this is an Android limitation, not app‑specific.
- **Recommended app for Phase 0:** **Cube ACR**, installed from its
  **Galaxy Store build** (`com.catalinagroup.callrecorder.sgs`), which ships a
  companion "Helper" app for better Samsung compatibility, rather than the
  generic sideloaded APK from the vendor's site.
- **If two‑way audio matters more than easy setup:** **ACR Phone** via its
  **Shizuku** method gives real two‑way recording (including Bluetooth) without
  the accessibility trick, at the cost of re‑enabling Shizuku's wireless‑debugging
  toggle after every reboot — acceptable for one owner's phone, not for a fleet.

### 2.4 Distribution and app‑store hygiene

- Ship the recorder as a **product flavor** (`callsync`) of the Capacitor app or
  as a separate sideloaded APK. The Play‑bound flavor must not declare the
  accessibility service, `READ_CALL_LOG`, or `SYSTEM_ALERT_WINDOW` — Google reviews
  the manifest, not the behaviour (the student app already learned this with
  `REQUEST_INSTALL_PACKAGES`, see `docs/RELEASE.md`).
- The student app already has a proven pattern for a sideload APK published to a
  rolling GitHub Release (`build-test-apk.yml`). Copy it for the staff app.
- Android 13+ "restricted settings" and OEM auto‑start / battery menus (Xiaomi
  especially) must be walked through in an in‑app onboarding checklist; without
  them the receiver is killed and calls are missed silently.

### 2.5 Legal and consent (Uzbekistan) — *partly unverified*

- Uzbek law protects the **secrecy of telephone conversations** (Criminal Code
  art. 143 and the Criminal Procedure Code). Those provisions target interception
  of *other people's* communications. I could not find a statute or court practice
  that explicitly settles whether a **party to the call** may record it without the
  other party's consent. Treat this as **open** and get a written opinion from a
  local lawyer before rollout beyond the owner's own phone.
- The **Personal Data Law** (2019, with the 2021 localisation amendments) covers
  recordings of identifiable people and, on its face, requires personal data of
  Uzbek citizens to be stored on servers in Uzbekistan. Hanguk already stores
  student data in Supabase (outside Uzbekistan), so this is a pre‑existing question,
  not a new one — but audio makes it more visible.
- Regardless of the legal answer, the plan includes a **recording notice**: a
  short pre‑recorded announcement for outbound calls (optional, adapter B/C only)
  and a line in the student agreement / first‑contact script. It is standard
  call‑centre practice and removes most of the grey area.

---

## 3. Target architecture

```
 Staff phone (Android, sideloaded staff app, flavor "callsync")
 ┌──────────────────────────────────────────────────────────────────────┐
 │  PHONE_STATE receiver ─┐                                             │
 │  per‑SIM TelephonyCallback (API 31+) ─┤→ CallSessionTracker          │
 │  CallLog ContentObserver ─┘              │  (only the selected SIM)  │
 │                                          ▼                           │
 │                      RecordingAdapter (per device)                   │
 │   A: OemFolderAdapter  B: AccessibilityRecorder  C: ShizukuAdapter   │
 │                                          │                           │
 │            local queue (Room DB) ──► UploadWorker (WorkManager)      │
 │                                          │  x-device-token           │
 │  CallSyncPlugin (Capacitor bridge) ◄─► React settings / status UI    │
 └──────────────────────────────────────────┼───────────────────────────┘
                                            ▼
              Edge function  mobile-call-ingest  (device‑token auth)
              ├─ register / heartbeat  → staff_devices
              ├─ upsert call           → resolveIdentity('phone', number)
              │                          → calls (voip_provider='mobile')
              └─ signed upload URL     → Storage bucket call-recordings
                                            │
                       calls.recording_url set + status='completed'
                                            ▼
              existing trigger → comm_processing_jobs → process-call-recording
                       (Scribe → Gemini → embeddings, unchanged)
                                            ▼
              CallList / CallDetail / CallIntelligence / RecordingPlayer
```

### 3.1 On the phone (Kotlin, package `com.hanguk.app.callsync`)

| Component | Responsibility |
|---|---|
| `CallSyncPlugin` (`@CapacitorPlugin`) | Bridge for the React UI: `getSims()`, `getStatus()`, `setConfig({subscriptionId, adapter, retention})`, `requestPermissions()`, `openSystemSetting(kind)`, `listPending()`, `retryUploads()`, `pairDevice(token)`. |
| `PhoneStateReceiver` | Manifest receiver for `ACTION_PHONE_STATE_CHANGED` + `BOOT_COMPLETED` + `MY_PACKAGE_REPLACED`. Wakes `CallSessionTracker`. |
| `CallSessionTracker` | State machine idle → ringing/dialing → off‑hook → idle. On idle: read the newest `CallLog` row, verify `PHONE_ACCOUNT_ID` matches the selected SIM, build a `PendingCall` (number, direction, start, duration, calllog id) and enqueue it. Ignores calls on the other SIM entirely. |
| `RecordingAdapter` interface | `start(session)`, `stop(session): File?`, `isAvailable(): Availability`. Implementations: `OemFolderAdapter` (watches the OEM folder, matches by time ± 90 s and number in the file name), `AccessibilityRecorderAdapter` (accessibility service + `AudioRecord` + AAC encoding via `MediaCodec`, run in a `microphone` foreground service with the "Recording" overlay bubble), `ShizukuAdapter` (opt‑in). |
| `UploadWorker` | WorkManager unique work per pending call, `NetworkType.CONNECTED`, exponential backoff. Calls `mobile-call-ingest` (upsert → signed URL → PUT audio → complete). Deletes the local file after confirmation, respecting a retention setting. |
| `DeviceAuth` | Stores the device token in `EncryptedSharedPreferences`; adds `x-device-token` to every request. Nothing else from the staff session leaves the WebView. |
| Onboarding checklist | Permissions, choose SIM, choose adapter (auto‑detected), battery optimisation off, OEM auto‑start, "Allow restricted settings" (13+), accessibility (adapter B), overlay permission (adapter B on 14+), test call. |

### 3.2 Server (Supabase)

**Migration `…_mobile_call_sync.sql`**

- `staff_devices(id, staff_id → auth.users, device_name, model, android_version, token_hash, selected_sim jsonb, adapter text, last_seen_at, revoked_at, created_at)`. RLS: owner/admin read all; a staff member reads their own.
- `calls` new columns: `sim_slot int`, `sim_carrier text`, `sim_number text`, `device_id uuid → staff_devices`, `recording_source text` (`oem_folder | accessibility | shizuku | none`), `calllog_id bigint`. `voip_provider` value `'mobile'`.
- Partial unique index on `external_call_id` (`mobile:<device_id>:<calllog_id>`) so re‑uploads are idempotent.
- Storage bucket `call-recordings` (private). Objects `mobile/<staff_id>/<yyyy>/<mm>/<call_id>.m4a`. Policies: service role only; browsers go through the proxy.

**Edge function `mobile-call-ingest`** (device‑token auth, service‑role client)

| Action | Behaviour |
|---|---|
| `register` (staff JWT, from the React UI) | Creates the `staff_devices` row, returns a one‑time raw token; the UI hands it to `pairDevice()`. |
| `heartbeat` | Updates `last_seen_at`, selected SIM, adapter, app version. |
| `upsert_call` | Normalises the number, `resolveIdentity('phone', …)`, **merges** into a `ClickToCall` row if one exists for the same staff, same normalised number, `started_at` within ± 3 min and `status = 'no_answer'`; otherwise inserts. Returns `call_id` and, if the client says a recording exists, a signed upload URL for the storage path. |
| `complete_recording` | Verifies the object exists, sets `recording_url` (full storage object URL) and `status = 'completed'` → the existing trigger enqueues transcription. Nudges `process-call-recording` like `voip-webhook` does. |

**Small edits to existing functions**

- `_shared/recording.ts#fetchRecording`: when the URL is under `SUPABASE_URL/storage/…`, send the service‑role bearer (or download via the storage client) instead of the Mediateka key.
- `mediateka-recording`: rename/alias to `call-recording`; same role check; branch on `voip_provider` to fetch from storage with the service key. `RecordingPlayer` points at the new name.

### 3.3 Web UI (React, native‑only via `PlatformGate`)

- **Settings → Call Sync**: pairing button, SIM picker (carrier, slot, number), adapter auto‑detection with a plain‑language explanation ("Your Xiaomi records calls itself — we will sync those files"), the onboarding checklist with deep links into system settings, live status (last call synced, pending uploads, last error), retention slider, "make a test call" flow.
- **Calls list / detail**: provider badge "Mobile · SIM 2 · Ucell", recording source, the existing `CallIntelligence` and `RecordingPlayer` unchanged.
- **Admin → Devices**: every paired phone, staff owner, last seen, adapter, revoke.
- `ClickToCall` on native: dial through `ACTION_CALL` with the selected SIM's `PhoneAccountHandle`, so the sync completes the row it just created.

### 3.4 Matching rules

1. Normalise with the shared `normalizePhone` (E.164‑ish, `+998…`).
2. `resolveIdentity('phone')` → `student_id` / `lead_id` (exact identity map → `profiles.phone` / `additional_phone` → `student_phones` → leads).
3. No match → row stays unlinked; it appears in the Calls inbox with "Link to student" (`LinkContactDialog`), which persists a `communication_identities` row and back‑links earlier calls from that number.
4. Staff attribution: the device's `staff_id`, never guessed from the number.
5. Idempotency: `external_call_id = mobile:<device>:<calllog_id>`; merges with the `ClickToCall` row per the ± 3 min rule.

---

## 4. Build plan

### Phase 0 — Feasibility probe on the real phone (2–3 days)

Deliverable: a debug APK "Call Sync Probe" and a one‑page result.

- Lists SIMs (`SubscriptionManager`), shows live call state per SIM, dumps the
  `CallLog` row with `PHONE_ACCOUNT_ID` after a test call.
- Detects the OEM recorder folder and whether the built‑in recorder exists on this
  phone (route A).
- Tries `VOICE_RECOGNITION` and `VOICE_COMMUNICATION` with accessibility enabled and
  plays the result back (route B) — records whether both sides are audible.
- Confirms the `microphone` foreground service can start during a call once
  battery optimisation is off / overlay is granted (Android 14+).

Exit criteria: we know which adapter Phase 2 builds first, and whether the
owner's phone model needs any OEM‑specific steps.

### Phase 1 — Metadata sync (5–8 working days)

1. Migration: `staff_devices`, new `calls` columns, indexes, RLS.
2. Edge function `mobile-call-ingest` with `register`, `heartbeat`, `upsert_call`;
   unit tests for matching and merge rules (mirroring the existing tests under
   `src/lib/__tests__`).
3. Kotlin: `CallSyncPlugin`, `PhoneStateReceiver`, `CallSessionTracker`,
   `UploadWorker` (metadata only), `DeviceAuth`; `callsync` product flavor; manifest
   split per flavor.
4. React: Settings → Call Sync (pairing, SIM picker, permissions checklist, status),
   provider badge in the calls list, Admin → Devices.
5. CI: `build-staff-apk.yml` publishing the sideload APK to a rolling release.

Acceptance: on the owner's phone, every call on the selected SIM appears in the
CRM within a minute of hanging up, linked to the right student when the number is
known, with direction, duration and SIM shown; calls on the other SIM never appear;
`ClickToCall` no longer produces duplicates; a reboot or app update does not stop
syncing.

### Phase 2 — Audio (7–10 working days, adapter order decided by Phase 0)

1. Storage bucket + policies; `complete_recording` action with signed uploads.
2. `OemFolderAdapter` (Xiaomi/Samsung folders, timestamp + number matching,
   `READ_MEDIA_AUDIO` / legacy storage permission).
3. `AccessibilityRecorderAdapter`: accessibility service declaration (flavor only),
   `microphone` foreground service, overlay bubble, AAC encoding, headset/Bluetooth
   detection with a "cannot record this call" notice.
4. `fetchRecording` + `call-recording` proxy generalisation; `RecordingPlayer`
   pointed at it.
5. Retention and local cleanup; upload resume on flaky mobile data.
6. Optional: `ShizukuAdapter` behind an "Advanced" toggle.

Acceptance: a recorded call plays in `CallDetail` and, within a few minutes, shows
a diarised Uzbek transcript and the bilingual summary from the existing pipeline;
failures surface in the Call Sync status screen rather than silently.

### Phase 3 — Hardening and rollout (4–6 working days)

- OEM battery‑killer matrix (Xiaomi, Samsung, others in use by staff) with
  per‑OEM deep links in the checklist; a "missed sync" detector that compares the
  call log against synced rows daily and backfills.
- Consent: recording announcement asset (UZ/RU), staff notice text, a per‑device
  "recording on/off" switch and audit of who enabled it.
- Admin dashboard counters: calls synced per staff per day, unlinked calls queue.
- Roll out to a second staff phone, then the rest; document the setup in
  `COMMUNICATION_INTELLIGENCE.md`.

Estimates assume one developer familiar with Kotlin and the existing edge
functions. Phase 0 can start immediately.

---

## 5. Risks and how the plan handles them

| Risk | Impact | Mitigation |
|---|---|---|
| The owner's phone has no built‑in recorder and route B yields one‑sided audio | Recording quality unacceptable | Phase 0 finds out first; metadata sync still delivers; Shizuku or the PBX alternative (§6) become the audio path. |
| Android or OEM update breaks route B | Recordings stop | Sync status screen + daily missed‑sync detector; adapters are swappable without touching the server. |
| App killed by OEM battery manager → missed calls | Silent data loss | Onboarding checklist, boot/package‑replaced receivers, daily reconciliation against the call log. |
| Play policy | Staff app rejected from Play if the recorder is in it | Recorder lives only in the sideloaded `callsync` flavor; CI asserts the Play manifest has no recording permissions. |
| Legal exposure for recording without consent | Reputational/legal | Lawyer's opinion before wider rollout; announcement; per‑device switch; audit log. |
| Private data on a personal phone | Leakage if the phone is lost | Files encrypted at rest by Android, short local retention, token revocation from Admin → Devices. |
| Data residency (Personal Data Law) | Compliance question | Flagged for the owner; identical to the existing student‑data situation, decide once for the whole system. |

---

## 6. The alternative: take the SIM out of the phone

| Option | What changes for staff | Recording | Cost (indicative, verify) | Fit |
|---|---|---|---|---|
| **Mediateka** (already integrated): ask whether they offer mobile/FMC numbers or accept a GSM gateway trunk | Dial via the Mediateka softphone/app, calls carry the existing office numbers | Server‑side, already flowing through `voip-webhook` | Existing contract | Best if students may be called from the office numbers. |
| **GSM gateway in the office** (GoIP/Dinstar/Yeastar TG) holding the current SIM + Asterisk/FreePBX or Mediateka trunk | Staff dial through a softphone; the student still sees the same mobile number | Server‑side, 100 % | One‑time hardware ≈ USD 60–300 per SIM port + a small PBX | Best when the *number itself* must stay. |
| **Cloud PBX** (UzCloud VPBX, Zadarma, Sipuni/OnlinePBX) | New numbers, softphone on the phone | Server‑side, 100 % | ≈ 190 000 UZS/month (UzCloud) or ≈ USD 25–30/month per Uzbek number (Zadarma) | Cheapest to operate, but changes the caller ID. |
| **On‑device Call Sync (this plan)** | Nothing — personal phone, personal SIM | Device‑dependent (§2.3) | Development time only | Only option that keeps staff calling from their own handsets on the move. |

If the requirement "staff keep using their personal phones and SIMs on the move"
is firm, the on‑device plan is the right one and the gateway is the escape hatch
for audio. If it is negotiable, the gateway route removes every risk in §5 except
the legal one.

### 6.1 A cheaper single‑seat version: a SIM‑card desk phone with built‑in recording

The owner already has a **YINGXIN GSM‑3G desk phone** ("录音固话") — a SIM‑card‑operated
landline‑style handset with a dedicated **REC** button, caller‑ID, redial and an
attached cordless handset. This is the same idea as the GSM‑gateway row above,
scaled down to one desk and one SIM, with **no PBX, no Asterisk, and no Android
app** for that line at all. It is also architecturally a different, easier problem
than the mobile‑phone routes in §2.3: the SIM plugs directly into this device and
it *is* the telephone, so there is no OS security boundary between an app and the
call — the firmware has direct, unrestricted access to both sides of the audio.
"Automatic recording" here is a manufacturer feature switch, not a workaround.

- **Recording:** the owner reports this unit records automatically, and that
  matches the product line — **automatic recording (自动录音)** is explicitly
  advertised across multiple YINGXIN SIM‑card desk‑phone listings (e.g. the
  sibling model "YINGXIN 238": "自动录音・答录・专业录音・行政律师电话"), as
  a standard feature, not a manual‑REC‑only device. Could not locate the manual
  for this exact "GSM‑3G" nameplate, so **confirm on the unit itself**: press
  **菜单 MENU** and look for a recording‑settings submenu (Off / Manual /
  Auto‑all‑calls) — if it is currently on Manual, switching to Auto is a menu
  toggle, no hack or firmware change needed.
- **Getting recordings out:** the same product line commonly stores recordings on
  a **removable SD/TF memory card** (up to 32 GB on sibling models, sometimes
  bundled with the phone) — check for a card slot on this unit. If confirmed,
  export is simply: pop the card out, read it on any computer or card reader, no
  proprietary software or USB pairing needed. This is the best case of the three
  export methods considered and would make the "Import mobile recordings" screen
  below a plain file upload.
- **CRM integration (small build, not yet started):** because there is no API,
  recordings arrive as a batch of audio files, not a live webhook. A short admin
  **"Import mobile recordings"** screen would let staff upload a pulled batch,
  showing each file's timestamp; staff pick the matching caller from the number
  (visible on the phone's caller‑ID log) and the student/lead, same
  `resolveIdentity` linking as everywhere else, then hand off into the existing
  `calls` → `process-call-recording` pipeline unchanged. Materially smaller than
  building `mobile-call-ingest` and a Kotlin plugin — no foreground service, no
  accessibility hacks, no OEM battery‑killer fight.
- **Limitation:** it only covers calls taken **at that desk**, on that one SIM. It
  is a strong complement to, not a replacement for, the mobile Call Sync plan in
  §3 for staff who take calls away from a desk.

Worth doing regardless of the mobile‑app decision: it is the fastest way to get
one line's calls reliably recorded and searchable today, and the import screen it
needs is a natural first slice of Phase 2's upload/matching UI.

---

## 7. Decisions needed before Phase 1

1. **Which phone(s) first?** Model and Android version of the owner's phone (and
   whether its dialer already has "record calls"). This decides the adapter order.
2. **Personal SIM stays personal?** Confirm the app must ignore the second SIM
   completely (planned) rather than offering a per‑number choice.
3. **Recording announcement:** on for outbound calls, or notice‑only? Uzbek and
   Russian text needed.
4. **Separate APK or flavor** of the staff app (recommendation: flavor, same code,
   different manifest).
5. **Retention on the phone** after successful upload (recommendation: 7 days).
6. Whether to price the GSM‑gateway option in parallel as the audio fallback.

---

## Sources

Android platform
- Sharing audio input (who may capture during a call): https://developer.android.com/media/platform/sharing-audio-input
- Foreground‑service types (`microphone`, `phoneCall`, Android 14/15 rules): https://developer.android.com/develop/background-work/services/fgs/service-types
- Exemptions for starting a foreground service from the background (battery‑optimisation opt‑out, `SYSTEM_ALERT_WINDOW`): https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- `TelephonyCallback.CallStateListener` (replaces `PhoneStateListener`, API 31): https://developer.android.com/reference/android/telephony/TelephonyCallback.CallStateListener
- Default dialer / `InCallService`: https://developer.android.com/develop/connectivity/telecom/dialer-app
- `CallScreeningService` (metadata only, no audio): https://developer.android.com/reference/android/telecom/CallScreeningService
- Capacitor custom native code: https://capacitorjs.com/docs/android/custom-code

Vendors and community
- Google Play accessibility‑API call‑recording ban (May 2022): https://9to5google.com/2022/04/21/google-will-block-all-third-party-call-recording-apps-on-play-store-from-may-11/
- NLL (ACR Phone) on Android 10+ and the Shizuku method: https://nllapps.com/apps/acr/support.htm and https://nllapps.com/android11/
- Cube ACR audio‑source guidance per Android version: https://cubeacr.app/faq.html
- BCR (root call recorder, `VOICE_CALL` as a system app): https://github.com/chenxiaolong/BCR
- Samsung One UI 7 native recording (region‑gated): https://www.notebookcheck.net/One-UI-7-finally-brings-native-call-recording-to-Galaxy-phones-in-the-US.930801.0.html
- Xiaomi recordings folder: https://www.mi.com/global/support/faq/details/KA-541461/
- Google Phone app recordings kept in‑app: https://support.google.com/phoneapp/thread/266153829/call-recording-storage-location-folder

Telephony alternatives
- UzCloud virtual PBX: https://uzcloud.uz/en/business/vpbx
- Zadarma cloud PBX: https://zadarma.com/en/services/pbx/
- Yeastar TG gateway with FreePBX: https://support.yeastar.com/hc/en-us/articles/115011635787-How-to-Connect-FreePBX-to-Yeastar-TG-Gateway

Speech to text (already in use)
- ElevenLabs Scribe, Uzbek: https://elevenlabs.io/speech-to-text/uzbek

Legal (Uzbekistan, unverified for one‑party recording)
- Criminal Code (art. 143, secrecy of communications): https://www.vertic.org/media/National%20Legislation/Uzbekistan/UZ_Criminal_Code.pdf
