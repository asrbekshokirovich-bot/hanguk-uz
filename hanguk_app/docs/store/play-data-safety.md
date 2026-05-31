# Play Data Safety questionnaire — answer sheet

This document is a worksheet to copy-paste into the Play Console's
"Data safety" form. Last updated 2026-05-12.

Sources cross-referenced:
- `lib/features/auth/data/auth_repository.dart` (account creation flow)
- `lib/features/applications/data/*` (applications, suggestions)
- `lib/features/documents/data/documents_repository.dart` (upload bucket)
- `lib/features/training/data/study_plan_repository.dart` (drafts, analyses)
- `lib/features/training/data/interview_repository.dart` (audio, transcripts)
- `lib/features/updater/data/update_telemetry.dart` (version pings)
- `docs/legal/PRIVACY_POLICY.md`

## Section 1 — Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes.** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — Supabase, Vapi, and ElevenLabs all use TLS; Kakao Maps requests are HTTPS. |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app via the Account screen → Delete account (calls `fn_delete_my_account`). Email fallback `privacy@hanguk.uz`. |

## Section 2 — Data types collected

For each data type below, fill the row into the Play form. "Collected"
means "sent off the device to a server we operate or to a
sub-processor". "Shared" means "sent to a third party for their own
use" — for us, that's **None** in all cases (sub-processors are
contractually bound to use the data only for the service we ordered).

### Personal info

| Data type | Collected | Shared | Optional/Required | Why? |
|---|---|---|---|---|
| Name | Yes | No | Required | Account management, App functionality |
| Email address | Yes | No | Optional | Account management (set automatically by Supabase if you use email magic links; not collected at sign-up if user uses phone) |
| User IDs | Yes | No | Required | Account management, App functionality |
| Phone number | Yes | No | Required (at sign-up) | Account management |
| Address | No | — | — | — |
| Race and ethnicity | No | — | — | — |
| Political or religious beliefs | No | — | — | — |
| Sexual orientation | No | — | — | — |
| Other info | No | — | — | — |

### Financial info

All "No" — Hanguk does not charge users and does not collect any
payment info.

### Health and fitness

All "No".

### Messages

| Data type | Collected | Shared | Optional/Required | Why? |
|---|---|---|---|---|
| Emails | No | — | — | — |
| SMS or MMS | No | — | — | — |
| Other in-app messages | **Yes** | No | Required (if chat tab is used) | App functionality. Stored in `channel_messages`. |

### Photos and videos

| Data type | Collected | Shared | Optional/Required | Why? |
|---|---|---|---|---|
| Photos | **Yes** | No | Optional | App functionality — users upload passport scans, transcripts, certificates as part of their applications. Stored in the `student-documents` Supabase bucket scoped to user ID. |
| Videos | No | — | — | — |

### Audio files

| Data type | Collected | Shared | Optional/Required | Why? |
|---|---|---|---|---|
| Voice or sound recordings | **Yes** | No | Optional | App functionality — mock interview audio is streamed live to Vapi for transcription. Recordings may be briefly retained by Vapi for replay (see Privacy Policy § 4). Hanguk does not persist raw audio. |
| Music files | No | — | — | — |
| Other audio | No | — | — | — |

### Files and docs

| Data type | Collected | Shared | Optional/Required | Why? |
|---|---|---|---|---|
| Files and docs | **Yes** | No | Optional | App functionality — application document uploads (PDFs, scans). |

### Calendar

All "No".

### Contacts

All "No".

### App activity

| Data type | Collected | Shared | Optional/Required | Why? |
|---|---|---|---|---|
| App interactions | No | — | — | — — no analytics SDK is wired today. |
| In-app search history | No | — | — | — |
| Installed apps | No | — | — | — |
| Other user-generated content | **Yes** | No | Optional | App functionality — personal-statement drafts, mock interview transcripts. Stored in `study_plan_drafts`, `interview_messages`. |
| Other actions | No | — | — | — |

### Web browsing

All "No".

### App info and performance

| Data type | Collected | Shared | Optional/Required | Why? |
|---|---|---|---|---|
| Crash logs | No | — | — | — — no crash reporting SDK is wired today. Will be Yes once Sentry / Crashlytics lands (P1 item Q4). |
| Diagnostics | No | — | — | — |
| Other app performance data | **Yes** | No | Required | App functionality — version distribution telemetry (`app_version_pings`: app name, version, OS, model). No PII. |

### Device or other IDs

| Data type | Collected | Shared | Optional/Required | Why? |
|---|---|---|---|---|
| Device or other IDs | No | — | — | — — `app_version_pings` uses a stable but non-identifying device fingerprint string derived from `appName + version`; we do not collect Android Advertising ID, IDFA, or any device identifier that survives reinstall. |

## Section 3 — Data usage and handling per type

For each "Yes" row above, in the Play form choose:
- **Data is processed ephemerally** = No (we persist most of it).
- **Data is required to use this app** = depends; documents/audio/etc. are Optional.

Standard purposes used across our "Yes" rows:
- **App functionality** — store applications, render drafts, score interviews.
- **Account management** — auth & sign-in.

Purposes we do **NOT** select:
- Advertising or marketing
- Fraud prevention
- Personalization (the AI feedback is per-user but it's App functionality, not Personalization in Play's taxonomy)
- Analytics
- Developer communications

## Section 4 — Third-party sub-processors

In the "Data shared" portion of each data type, list NONE. Sub-processors
acting on our behalf under a DPA do NOT count as "sharing" in Google
Play's terminology (per Play's Help Center).

The full sub-processor list is in the Privacy Policy § 4. For Play
reviewer reference:

- **Supabase Inc.** — auth, database, file storage, edge functions
- **Vapi Inc.** — real-time voice transcription, LLM inference
- **ElevenLabs Inc.** — text-to-speech for the AI interviewer
- **Kakao Corp.** — map tiles, roadview imagery (no user data sent)

## Section 5 — Children's data

We don't target children under 13. Our intended audience is 14–19 year-
old Korean-university applicants. Until the age-gate sign-up flow ships
(P1 C1), counsellors verify age before issuing magic access codes for
younger users.

Answer in the Play form:
- "Target audience" → 13+ (we may select 18+ in jurisdictions where
  PIPA's <14 rule is strict; revisit when the age-gate lands).
