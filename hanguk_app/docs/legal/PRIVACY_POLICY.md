<!-- REVIEW: lawyer must vet before launch. Drafted by build sandbox
     2026-05-12; covers Hanguk's actual data practices but has not been
     reviewed by Korean or Uzbek counsel. PIPA, GDPR, COPPA, and Apple
     App Store / Google Play disclosure requirements all apply. -->

# Hanguk — Privacy Policy

**Effective date:** 2026-05-12
**Last updated:** 2026-05-12
**Controller:** Hanguk (operator of the Hanguk Student App and `hanguk.uz`)
**Contact:** privacy@hanguk.uz

This Privacy Policy explains what information Hanguk collects from you
when you use the Hanguk Student App (the "App") and the `hanguk.uz`
website (the "Service"), how we use it, who we share it with, how long
we keep it, and the rights you have over it.

## 1. Who we are

Hanguk operates the Hanguk Student App, a Korean-university application
platform built for Uzbek students preparing to study at Korean
universities. The Service helps you:

- Track applications to Korean institutions
- Browse a map of Korean universities
- Upload application documents (passport scans, transcripts,
  certificates, personal statements)
- Build a study plan with AI guidance
- Draft and refine personal statements with AI feedback
- Practice mock admissions interviews with an AI voice agent
- Message your assigned consultant or the Hanguk team

## 2. Information we collect

We only collect information that is necessary to run the Service.

### 2.1 Information you give us at sign-up

- **Full name** — to address you and personalize your dashboard
- **Phone number** — used as your account identifier and login credential
- **Password** — stored only as a salted hash by our authentication provider
- **Magic access code** (CRM-onboarded students only) — issued by your
  consultant and exchanged for an authenticated session

### 2.2 Information you give us while using the Service

- **Application data** — the universities you intend to apply to, the
  programs / majors, deadlines, and progress checkboxes you tick
- **Documents** — files you upload to the documents tab (typically
  passport scans, transcripts, certificates, personal statements). These
  are stored in a Supabase Storage bucket scoped to your user ID.
- **Personal statement drafts** — every typed draft is saved per-version
  in `study_plan_drafts` for the study-plan + personal-statement trainer.
- **AI chat history** — messages exchanged with the in-app AI assistant
  are stored in `study_plan_chat_history` and visible only to you.
- **Mock interview transcripts** — both your spoken answers and the AI
  interviewer's responses are stored in `interview_messages`.
- **Audio recordings** — when you run a mock interview, your microphone
  audio is streamed to Vapi (see § 4) for live transcription. Recordings
  may be retained briefly by Vapi for transcript replay and are deleted
  per Vapi's retention policy.
- **AI-generated feedback** — scores, grammar issues, content notes
  produced by our trainer AI on your drafts and interviews.

### 2.3 Information collected automatically

- **App version, OS, model** — sent as a single telemetry ping
  (`app_version_pings`) per launch so we can track which versions of the
  App are in use. No personally-identifiable information is in the ping.
- **Device language and locale** — used to pick an appropriate UI
  language.
- **IP address** — observed by our authentication provider (Supabase)
  for abuse detection; not stored long-term by Hanguk.

We do **not** use third-party analytics SDKs, ad networks, or
fingerprinting libraries. We do **not** track you across other apps or
websites.

## 3. How we use your information

We use your information solely to:

- Authenticate you and keep your session secure
- Sync your applications, documents, and drafts across devices
- Generate AI feedback on your study plan, personal statement, and mock
  interview performance
- Display universities, programs, and deadlines relevant to you
- Allow your assigned consultant to message you (CRM-onboarded students
  only)
- Investigate and fix bugs reported by you or surfaced by version
  telemetry
- Comply with legal obligations (e.g. responding to a subpoena from
  Korean or Uzbek authorities)

We do **not** use your information for advertising. We do **not** sell
or rent your information to anyone.

## 4. Who we share information with

We share information only with the following sub-processors, each of
whom processes data on our behalf under a data-processing agreement:

| Sub-processor | Purpose | Data shared |
|---|---|---|
| **Supabase** (Supabase Inc., USA) | Authentication, database, file storage, edge functions | Account credentials, application data, documents, drafts, transcripts |
| **Vapi** (Vapi Inc., USA) | Real-time voice transcription + LLM inference for mock interviews | Microphone audio (during a call), session metadata |
| **ElevenLabs** (ElevenLabs Inc., USA) | Text-to-speech fallback for the AI interviewer voice | Text strings to be spoken (no user audio) |
| **Kakao Corp.** (Republic of Korea) | Map tiles + roadview imagery for the universities map | Anonymous map-tile requests; no user data |
| **Sentry** (Functional Software Inc., USA) | Crash reporting and error diagnostics (only when a Sentry DSN is configured for the release build) | Stack traces, OS/device model, build version; no user-supplied content |

### What each sub-processor does, in plain terms

- **Supabase** stores everything that makes the app work: your account
  (phone/email), your application drafts, your documents, your interview
  transcripts, your study plans. It also runs the server-side `export-my-data`
  and `delete-my-account` endpoints. We use Supabase's US infrastructure.
- **Vapi** is the real-time voice infrastructure for mock interviews. When
  you start an AI interview, your microphone audio is streamed to Vapi for
  transcription and LLM-based response generation. Vapi's own retention
  is on the order of days; we do not store the audio after the call ends.
- **ElevenLabs** synthesises the AI interviewer's spoken voice. We send
  only the *text* the AI should speak; we never send your audio or PII to
  ElevenLabs. (ElevenLabs is engaged via Vapi or directly, depending on
  the configured voice.)
- **Kakao** powers the campus-location map and street-view embed. The
  WebView calls Kakao's `dapi.kakao.com` and `map.kakao.com` with map
  coordinates only; your account / phone / email never leaves the app
  toward Kakao.
- **Sentry** is engaged only if the founder enables crash reporting for
  a release. When enabled, the SDK uploads stack traces and device
  metadata on errors. We have set `sendDefaultPii=false` so user
  identifiers are stripped before transmission.

All sub-processors are bound to use the data only for the listed purpose
and not for their own. Vapi, ElevenLabs, Supabase, and Sentry are based
in the United States and may transfer data internationally; we rely on
Standard Contractual Clauses (SCCs) for these transfers.

We may also disclose information if compelled by valid legal process
(subpoena, court order) or to protect the safety or rights of users.

## 5. How long we keep your information

| Category | Retention |
|---|---|
| Account credentials | Until you delete your account (see § 7) |
| Application data, documents, drafts | Until you delete your account, or until you delete the specific record |
| Mock interview audio (Vapi-side) | Per Vapi's policy; typically <30 days |
| Mock interview transcripts | Until you delete your account |
| AI feedback / scores | Until you delete your account |
| Version telemetry (`app_version_pings`) | Aggregated indefinitely; no PII |
| Support email correspondence | 2 years after the last reply |

## 6. How we protect your information

- All network traffic uses TLS (HTTPS, WSS).
- Your password is never stored in plaintext; only a salted hash is held
  by Supabase's authentication service.
- Database tables enforce row-level security: you can only read or
  modify rows you own.
- Backups are encrypted at rest.
- The App's source code is audited before each public release.

No system is perfectly secure. If we ever experience a breach that
affects your data, we will notify you per applicable law (PIPA Art. 34
in Korea, GDPR Art. 34 in the EU).

## 7. Your rights and how to exercise them

You have the right to:

- **Access** the data we hold about you
- **Correct** inaccurate data
- **Delete** your account and all associated data
- **Export** your data in a machine-readable format
- **Withdraw consent** at any time (sign out and delete your account)
- **Object** to specific processing (e.g. analytics; Hanguk currently
  does no third-party analytics)
- **Lodge a complaint** with your local data-protection authority
  (Korea: PIPC at `https://www.pipc.go.kr/eng/`; EU: your national DPA)

### How to delete your account

In the App: open the **Account** screen (link in the home tab settings),
tap **Delete account**, type `DELETE` to confirm, and re-authenticate.
Your profile, applications, study plans, personal-statement drafts,
mock interview sessions and transcripts will be permanently deleted.
Documents in storage will be deleted within 30 days; backups age out
within 90 days.

If you cannot access the App, email `privacy@hanguk.uz` from the email
or phone number associated with your account, and we will action your
request within 30 days.

### How to export your data

Currently available by emailing `privacy@hanguk.uz`. An in-app export
button is planned.

## 8. Children's data

The Hanguk Student App is intended for users aged **14 and over**. We
do not knowingly collect data from children under 14 without verifiable
parental consent. If you are a parent or guardian and believe your
child has provided data without your consent, please email
`privacy@hanguk.uz` and we will delete the account.

Per Korea's PIPA Article 22-2, users under 14 require parental consent
to use the Service. An age-gate is planned for sign-up; until it lands,
counsellors are instructed to verify age before issuing magic access
codes to younger applicants.

## 9. International transfers

Hanguk operates from Uzbekistan. Data is stored on Supabase
infrastructure in the United States (region: `us-east-1`). Vapi and
ElevenLabs also process data in the United States. By using the
Service, you consent to your data being transferred to and processed in
the United States. For EU/EEA / UK users we rely on Standard Contractual
Clauses for these transfers. For Korean users, we comply with PIPA's
cross-border-transfer requirements (Article 28-8 of PIPA, as amended in
2026).

## 10. Changes to this policy

If we change this Privacy Policy materially, we will (a) update the
"Last updated" date above and (b) notify you via the App or by email at
least 14 days before the change takes effect. Trivial wording changes
(typo fixes, link updates) may be made without notice.

## 11. Contact

For any privacy question, request, or complaint:

- Email: `privacy@hanguk.uz`
- Postal: please request via email

If we cannot resolve your complaint, you may lodge it with the
appropriate data-protection authority.
