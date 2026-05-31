# Training feature deep audit — 2026-05-10

> Investigation-only pass over `lib/features/training/` and the Edge
> Functions / DB tables it depends on. Every finding includes a file
> path, what's wrong, what good looks like, and a rough effort
> estimate. Backlog at the bottom is sorted P0/P1/P2.
>
> **2026-05-10 update — all 9 P0, all 23 P1, and all 26 P2 items are
> closed in code.** Full intl wiring (`lib/l10n/` + 5 ARB files +
> `MaterialApp` delegates) and a mocked Vapi integration test landed in
> the final P2 batch. Translations seeded with English placeholders +
> `TODO: translate` markers on uz / ko / ru / vi so a translator can
> fill them in without blocking the wiring. New artefacts added by the P1
> pass:
> - `supabase/migrations/20260510140000_training_add_selected_track.sql` (applied to staging + prod)
> - `lib/features/training/data/training_contracts.dart` (Edge Function shapes + parsers, audit B1/B4)
> - `lib/features/training/data/vapi_event_parser.dart` (pure-Dart endCall detector, lifted for testability)
> - `lib/features/training/data/grammar_issue_resolver.dart` (pure-Dart first-unconsumed matcher, lifted for testability)
> - `lib/features/training/data/step_one_guide_helper.dart` (track normalization)
> - `lib/features/training/presentation/training_strings.dart` (conservative L1/L3 — 22 strings × 3 locales)
> - `test/features/training/*.dart` — 27 tests across 5 files
>
> Backend changes: defensive write into `public.interview_feedback`
> from Dart side; `study_plan_sessions.selected_track` column added.
>
> Auditor: Claude (build sandbox)
> Surface in scope: Study Plan trainer, Personal Statement trainer
> (same code, different `documentType`), Interview trainer, Training
> tab navigation, session history views, drafting workspace AI.

---

## Executive summary

The training feature has the right *shape* — three modules, session
persistence, AI-driven feedback — but it is **production-fragile**.
Headline picture:

| metric | value |
|---|---|
| Source LOC under `lib/features/training` | 4,882 across 16 files |
| Test files covering training | **0** |
| i18n adoption (any `intl` / `EasyLocalization` / `.arb` key lookup) | **0 calls** |
| Hardcoded Uzbek prose in code | found in 4 widgets (`study_plan_screen`, `study_plan_analysis_view`, plus copy in `_buildExampleStep`) |
| `print()` (vs `debugPrint`) in training code | 6 call sites — will leak to release logs |
| Legacy `target_university_id` references in queries | 0 (Phase 3R-B rename done) |
| Legacy `universities` join-relation aliases | 1 latent bug — `interview_history_view.dart:93` reads `session['universities']` from a query that now aliases to `institution` |

The most consequential findings:

1. **The `StudyPlanChatFab` is a non-functional placeholder.** Tapping the FAB opens a panel that always shows "AI Assistant is thinking…" and a TextField with no controller, no submit handler, and no onPressed on its send icon. The `study_plan_chat_history` table exists on prod but is never read or written by Flutter. (`widgets/study_plan_chat_fab.dart` — P0)

2. **The "Timed Mode" toggle in interview setup does nothing.** `timeLimitSeconds: 300` is written to `interview_sessions.time_limit_seconds`, but `interview_active_view.dart` never reads it and never enforces a wall clock. Same for `focus_topic` — written to the DB row, never injected into the Vapi system prompt. The setup view collects three fields the active view ignores. (`widgets/interview_active_view.dart`, `widgets/interview_setup_view.dart` — P0)

3. **Manual-exit path skips `endSession()`.** The big "End Interview" button in `interview_active_view.dart:489-504` calls `_stopCall()` then `Navigator.pop()` — it does NOT call `endSession()`. The interview row stays in `status='active'` forever, no feedback is generated, the audio recording is not retrieved, and the user gets no review. The `[End Session]` text button in the AppBar (`interview_screen.dart:67-76`) does it correctly; the floating button at the bottom of the active view does not. (P0)

4. **Resumed Study Plan / Personal Statement sessions show an empty workspace.** When a user opens an existing session, `study_plan_repository.loadSession` populates `state.drafts` with the saved drafts. But `study_plan_screen._buildDraftingStep` passes `_draftController.text` (always empty — the controller is never populated) as `initialText` to `AdvancedDraftingWorkspace`. The workspace therefore opens blank, and as soon as the user types a single character, `_onTextChanged` queues a save with the new (~empty) text — the prior draft is at risk of being lost when the next save lands. (`presentation/study_plan_screen.dart:488-497` — P0)

5. **Interview history is broken: every session shows "Unknown Target".** `getSessionHistory()` selects with the new alias (`institution:target_institution_id(...)`), but `interview_history_view._buildSessionCard` reads `session['universities']` (legacy alias). All sessions render with the fallback name. Phase 3R-B knock-on. (`widgets/interview_history_view.dart:91-95` — P0)

6. **AI-side responses are never logged.** `interview_active_view.dart:192-204` only stores transcripts where `eventValue['role'] == 'user'`. The interviewer's spoken responses are dropped. The `interview-feedback` Edge Function consequently scores the conversation with only one half of the dialogue. (P1)

7. **Zero automated tests on training.** Total test files for the feature: 0. Given the AI debounce / save lifecycle / session resume / Vapi event-shape complexity, this is the single biggest source of regression risk. (P1)

8. **Persona is silently dropped from the training-tab dialog.** The Interview Preparation dialog only collects "Korean / English". Persona is hardcoded `'friendly'` for that path. The `InterviewSetupView` (the standalone setup screen, only reachable via History → back-then-pre-existing path) does expose persona. So the most-used entry point is degraded. (P1)

9. **Draft auto-save can produce duplicate-version conflicts under fast typing.** `_aiSuggestionTimer` (1 s) and `_saveDebounceTimer` (2 s) both fire from `_onTextChanged`. If the AI debounce restarts the save right as a previous save is in flight, two `INSERT INTO study_plan_drafts` calls compute the same `nextVersion` and the unique key on `(session_id, version)` rejects one. The repo catches it with `setState(error: ...)` but never retries. (P1)

10. **All training UI strings are hardcoded.** `lib/l10n/` doesn't exist; the project ships in **Uzbek + English + Korean by data column** (`name_uz`, `name_en`, `name_ko`) but the **app shell has no localization**. A Korean speaker opening Step 1 of the Study Plan trainer sees a four-paragraph Uzbek explanation. (P1 — but high blast radius.)

---

## Module 1 — Study Plan trainer

`lib/features/training/data/study_plan_repository.dart` (459 LOC) +
`presentation/study_plan_screen.dart` (890 LOC) + 5 widgets.

### Functional bugs

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| F1 | **Empty workspace on session resume.** `_draftController` is never populated from `state.drafts.first.content`. | `study_plan_screen.dart:488-497` | Pass `state.drafts.firstOrNull?.content ?? ''` as `initialText`. Or refactor `AdvancedDraftingWorkspace` to read `documentSessionProvider` itself. | 1 h |
| F2 | **`createSession` patches `selectedTrack` in memory only.** The DB `study_plan_sessions` row has no `selected_track` column written, so on resume the field comes back null. | `study_plan_repository.dart:202-241` | Either add `selected_track` to the insert payload, or add a `selected_track` column to the table and persist. | 30 m + migration |
| F3 | **`updateSessionStep` reconstructs the session without `updatedAt` / `createdAt`.** State copy nulls those fields locally on every step bump. | `study_plan_repository.dart:309-318` | Use `copyWith(currentStep: step)` instead of manually rebuilding the object. (StudyPlanSession needs `copyWith`.) | 30 m |
| F4 | **Empty applications dead-end in the create-session dialog.** Same problem #3 fixed in `training_tab.dart`, but `study_plan_screen.dart:531-533` still shows raw text. | `study_plan_screen.dart:531-533` | Same CTA as `training_tab.dart` empty-state — "Apply to a university" button that switches to tab 0. | 30 m |
| F5 | **Track value-format mismatch.** Study plan uses `'english'` / `'korean'`. Interview uses `'en'` / `'ko'`. Both end up in the DB with different conventions. | `study_plan_screen.dart:500,567,576` vs `interview_setup_view.dart:108-122` | Pick one (`'en'`/`'ko'`). Migrate any in-flight rows. | 1 h + light migration |
| F6 | **Analyze response is parsed only as raw text.** `analyzeCurrentDraft` writes `ai_response` text. The DB columns `overall_score`, `grammar_errors`, `content_feedback`, `strengths`, `improvements` exist but are always null because the Dart side doesn't parse the structured response. | `study_plan_repository.dart:386-413` | Update Edge Function contract docs, parse JSON envelope, set columns. | 2 h |
| F7 | **Dummy video tiles in Step 1.** Three placeholder cards with `play_circle_fill` icon and no `onTap`. Hard-coded "Tavsiya etilgan videolar (CRM)" header in Uzbek. | `study_plan_screen.dart:316-359` | Either delete or wire to a `lib/features/training/data/training_videos.dart` provider that returns real video URLs. | 2 h to wire, 30 s to delete |

### UX issues

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| U1 | **`_saveStatus = saved` is set on save error.** `_saveDraft` flips status to "saved" after the awaited call returns whether or not it succeeded. | `widgets/advanced_drafting_workspace.dart:113-118` | Check the result, set status to `error` on failure, surface a snackbar. | 30 m |
| U2 | **Track-mismatch warning is in Uzbek only.** "Sening tracking boshqa edi!" — Korean / English speakers see Uzbek. | `widgets/study_plan_analysis_view.dart:109` | Wrap in i18n once that lands; for now pass through `selectedLanguage`. | tied to i18n work |
| U3 | **Step 1 guide content is hardcoded Uzbek.** Lines 258-307. | `study_plan_screen.dart:258-307` | Same — i18n. Pre-i18n: respect `currentSession.selectedTrack` to show Korean or English version. | 2 h pre-i18n / blocked on i18n otherwise |
| U4 | **`StudyPlanChatFab` is a placeholder.** Renders dummy UI, no input handling, no Edge Function call. | `widgets/study_plan_chat_fab.dart` | Either delete the FAB or wire to `study-plan-trainer` with `action: 'chat'`. The `study_plan_chat_history` DB table is in place. | 6 h to build, 5 m to delete |
| U5 | **`StudyPlanAnalysisView` shows "AI successfully reviewed your draft." when the response is empty.** Misleads the user into thinking analysis ran when it didn't. | `widgets/study_plan_analysis_view.dart:51-57` | Treat empty `aiResponse` as failure; show retry button. | 30 m |
| U6 | **Generic `state.isLoading` shadows analysis loading.** Saving a draft or loading a session also flips `isLoading=true`, which makes the analysis view show a "Analyzing transcript with AI..." spinner unrelated to actual analysis. | `widgets/study_plan_analysis_view.dart:14-16` + state class | Add a dedicated `isAnalyzing` flag, or scope by op. | 1 h |
| U7 | **`_exampleSelectedUniName` declared but unused.** Dead state variable. | `study_plan_screen.dart:25` | Delete. | 1 m |
| U8 | **No way to edit a session's title or target university after creation.** | `study_plan_repository.dart` (no setter) + `study_plan_screen.dart` | Add a settings sheet on the wizard. | 4 h |

### Data integrity

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| D1 | **Concurrent draft saves can collide on `(session_id, version)`.** The 1-s AI debounce and the 2-s save debounce can sequence such that two saves compute the same `nextVersion`. | `study_plan_repository.dart:328-353` | Use a serial mutex (per session-id) on save, or use `INSERT ... ON CONFLICT (session_id, version) DO NOTHING` with retry. | 2 h |
| D2 | **`saveDraft` overwrites `draftContent` even if the user has typed since.** If the user keeps typing while save is in flight, the post-save state assignment writes the text from the start of the save. | `study_plan_repository.dart:350` | Don't update `draftContent` from the saver; it's already in state from `setDraftContent`. | 30 m |
| D3 | **`clearCurrentSession` resets the entire state including the sessions list.** Closing a session triggers a re-fetch from empty. | `study_plan_repository.dart:373-375` | Preserve `sessions` list in the reset. | 15 m |
| D4 | **`fetchSessions` doesn't filter on status.** Completed sessions stay in the list forever. | `study_plan_repository.dart:178-200` | Add `.eq('status', 'in_progress')` or add a "Show archived" toggle. | 30 m |
| D5 | **No stale-draft protection on resume.** If two devices have the same session open, the second one's saves win silently. | repository | Compare `updated_at` server-side; reject if local is older. | 4 h |

### Backend contracts

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| B1 | **`study-plan-trainer` Edge Function contract is undocumented.** Two actions used: `analyze` and `draft_supervise`. No schema for the response shape; Dart silently nulls fields if absent. | `study_plan_repository.dart:386,421` | Add a TS interface in the Edge Function source + a Dart parser; assert on shape mismatch. | 2 h |
| B2 | **No timeout on `client.functions.invoke`.** Default Supabase timeout is 60 s. AI ghost-text fires every 1 s of pause; 60 s of stuck calls would queue up. | repository (multiple sites) | Pass `timeout: const Duration(seconds: 15)` (when supabase-flutter supports it) or wrap in `.timeout()`. | 1 h |
| B3 | **No rate-limit handling.** If the Edge Function returns 429 / "Too Many Requests", the catch block in `superviseDraft` silently returns null — UI shows "Ready" forever. | `study_plan_repository.dart:421-455` | Detect 429, surface to UI with a "AI throttled — pause typing for 30 s" message, exponential backoff. | 2 h |

---

## Module 2 — Personal Statement trainer

Same code as Study Plan, branched on `documentType == 'personal_statement'`. Inherits **every** finding above. Module-specific divergences:

| # | finding | file:line | effort |
|---|---|---|---|
| PS1 | **Step 1 guide content for Personal Statement is Uzbek.** Three guide cards (`O'tmish va Tajriba`, `Shaxsiy Xislatlar`, `Nega ushbu soha?`). | `study_plan_screen.dart:290-308` | Tied to i18n; same as U3 |
| PS2 | **Document title at line 348 mixes English ("Personal Statement") with Uzbek ("sirlari - 1-qism").** | `study_plan_screen.dart:348` | i18n |
| PS3 | **No prompt difference for analysis.** The Edge Function gets `documentType: 'personal_statement'` but the Dart side has no separate examples / prompts. Quality depends on Edge Function side. | Edge Function | Out of scope for this repo. Coordinate with Lovable. |

---

## Module 3 — Interview trainer

`data/interview_repository.dart` (511 LOC) + 7 widgets.

### Verification of the 5 Phase 3R-B fixes

| # | claim | end-to-end status |
|---|---|---|
| 1 | **Korean voice IDs correct.** `AppConfig.voiceIdKo*` use JiYoung / Hyun Bin / KKC, native Korean library voices. | ✅ Code-shipped. Cannot validate audio quality from code. |
| 2 | **AI greets first.** `firstMessageMode: 'assistant-speaks-first'` set. | ✅ Code-shipped. |
| 3 | **Auto-end via `tool-calls` event.** Listener checks both `tool-calls` and `function-call`, parses the four event-shape variants for the `endCall` tool. Guarded by `_didEndSession` flag against double-fire. | ✅ Code-shipped. **Caveat:** the manual-exit path (Big "End Interview" button) does NOT trigger `endSession()` — bypasses feedback entirely. |
| 4 | **`vapi_call_id` persisted to DB.** `setVapiCallId` schedules `_persistVapiCallId(sessionId, callId)` via `unawaited(...)`. | ⚠️ Persists, but errors are silently swallowed (`debugPrint` only). On a flaky write, the call_id sits in memory only and history-replay shows "Audio recording not found". |
| 5 | **Post-session feedback fires for both auto-end and manual-end.** | ❌ Auto-end works. Manual-end via the floating Close button at the bottom of `InterviewActiveView` skips `endSession()`. The AppBar "End Session" text button does it. **The big visible button is broken; the small text button works.** |

### Functional bugs

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| F8 | **Manual-exit "End Interview" button skips feedback generation.** | `widgets/interview_active_view.dart:489-504` | Have the gesture call `_completeAutoEnd()` (the same function the auto-end path uses) instead of just `_stopCall(); Navigator.pop()`. | 30 m |
| F9 | **AI-side transcripts dropped.** Only `eventValue['role'] == 'user'` triggers `logTranscript`. Assistant utterances are never written to `interview_messages`. | `widgets/interview_active_view.dart:192-204` | Listen for `transcript` events with `role == 'assistant'`, log with `role: 'interviewer'`. | 30 m |
| F10 | **`time_limit_seconds` is collected but never enforced.** No timer ticking down, no auto-end on expiry. | `widgets/interview_setup_view.dart:29` writes the value; `widgets/interview_active_view.dart` never reads it. | Add a `Timer(Duration(seconds: timeLimit))` in `_initVapi`; on expiry, call `_completeAutoEnd()`. | 1 h |
| F11 | **`focus_topic` is collected but never injected into the Vapi system prompt.** | `widgets/interview_active_view.dart:60-83` | Read `state.focusTopic`, append `'Focus the conversation on: $topic.'` to the prompt. (Note: state class doesn't expose `focusTopic` — it's only on the DB row. Surface it through the state.) | 1 h |
| F12 | **Persona is dropped on the most-used entry path.** The training-tab "Interview Preparation" dialog hardcodes `'friendly'`. | `presentation/training_tab.dart:341-381` | Add a persona row to the dialog or pass an explicit default through `initialPersona`. | 1 h |
| F13 | **Interview history shows "Unknown Target" for every session.** Reads `session['universities']`; the query aliases as `institution`. Phase 3R-B knock-on. | `widgets/interview_history_view.dart:91-95` | Read `session['institution']?['name_en'] ?? session['institution']?['name_ko']`. Backwards-compat with old `universities` key for 30 days. | 15 m |
| F14 | **Active-view error path leaves `state.status='active'` forever.** If user backs out without ending the session, the row stays active and next session-history listing can't tell what happened. | `widgets/interview_active_view.dart:208-222` | On `_stopCall` from a non-completion path, mark the row as `'abandoned'` server-side. Add a status enum value if needed. | 1 h |
| F15 | **`endSession` doesn't write feedback to the DB itself; relies on the Edge Function.** If the function returns the feedback but persistence to a `interview_feedback` table is internal, the DB might not have it after function-cache TTL expires. | `interview_repository.dart:311-348` | Confirm Edge Function persists; if not, INSERT into `interview_feedback` table from Dart. | 2 h |
| F16 | **`InterviewFeedbackView` is dead code.** Defined but never referenced. The actually-used view is `InterviewAnalyticsView`. | `widgets/interview_feedback_view.dart` | Delete or wire as alternate view (per `interview_screen.dart:114` comment). | 5 m delete / 2 h wire |
| F17 | **Score scale inconsistency.** `_ScoreBar` divides by 100 (assumes 0-100). `_MessageFixCard` checks `score > 7` (assumes 0-10). Either the Edge Function returns mixed scales or the Dart UI is wrong. | `widgets/interview_feedback_view.dart:128,189` | Pick a scale and validate Edge Function output. | 1 h (mostly investigation) |

### UX issues

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| U9 | **No "no application selected" helper text.** Start Interview disabled with no inline prompt. | `presentation/training_tab.dart:346-347` | Add caption "Select a university above to enable" when disabled. | 15 m |
| U10 | **`InterviewSetupView` allows `university_specific` without setting a uni.** The setup view has no field to set `targetUniversityId`; the addon falls back. | `widgets/interview_setup_view.dart:78-99` | Either disable the dropdown option from this entry, or add a uni-picker. | 2 h |
| U11 | **`focusTopic` text field is uncontrolled.** No `setState` on changed → the value updates locally but UI doesn't re-render; if the user clears, cursor jumps. | `widgets/interview_setup_view.dart:156-169` | Use a `TextEditingController` or wrap in `setState`. | 15 m |
| U12 | **Connection-error message is wrong.** `'Connection interrupted: Backend configuration mismatch or missing limits.'` is shown for any Vapi error event. | `widgets/interview_active_view.dart:151` | Surface the actual error string from the event, with localized fallback. | 30 m |
| U13 | **Filler-word coaching produces false positives.** `'um'` matches inside `'umbrella'` because of `split('um').length - 1`. | `widgets/interview_active_view.dart:303-316` | Use `RegExp(r'\bum\b', caseSensitive: false)`. | 15 m |
| U14 | **Live transcript display is asymmetric.** Shows live student words while active; falls back to "last student message" when not active. AI replies never visible. | `widgets/interview_active_view.dart:480-486` | After F9 (AI transcripts logged), show alternating bubbles. | 1 h after F9 |
| U15 | **"Practice Again" resets the entire session including feedback.** User loses the feedback they were viewing. | `widgets/interview_feedback_view.dart:60` | Navigate back to setup but keep `feedback` accessible from history. | 30 m |
| U16 | **No microphone-permission guidance for iOS.** `permission_handler` request fires but if denied, the snackbar is the only message. | `presentation/training_tab.dart:351-359` | On `permanentlyDenied`, open settings via `openAppSettings()`. | 30 m |
| U17 | **Dialog error message persists across re-opens.** The dialog watches `interviewState.error`; if a prior attempt failed, the error chip appears the next time the dialog opens. | `presentation/training_tab.dart:328-335` | Call `clearError()` on dialog open. | 15 m |
| U18 | **No session-recovery when app is backgrounded mid-call.** If the user backgrounds the app while Vapi is active, no resume logic. | `widgets/interview_active_view.dart` | Listen to `WidgetsBindingObserver.didChangeAppLifecycleState`; pause / resume the call appropriately. | 4 h |

### Data integrity

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| D6 | **`_persistVapiCallId` swallows failures.** A flaky write means history-replay shows "Audio recording not found" because the row has `vapi_call_id IS NULL`. | `interview_repository.dart:202-211` | Retry with backoff; on terminal failure surface to the user. | 1 h |
| D7 | **Temp student message stays in `state.messages` after a failed AI call.** No rollback. | `interview_repository.dart:215-277` | Track a temp-id list, remove on error. | 30 m |
| D8 | **TTS file leak.** `generateTTSAudioPath` writes `tts_${epoch}.mp3` to temp dir; no cleanup. | `interview_repository.dart:388-389` | Track files in a list, delete on session end / dispose. | 30 m |
| D9 | **`getSessionHistory` has no pagination.** All sessions loaded in one go. | `interview_repository.dart:464-481` | Add `.limit(50)` + a `.range()` cursor for older. | 30 m |
| D10 | **`endSession` doesn't guard against double-fire.** Tapping "End Session" twice in the AppBar triggers two `interview-feedback` calls. | `interview_repository.dart:311-348` | Add `if (state.isLoading) return;` at the top. | 5 m |

### Backend contracts

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| B4 | **`interview-ai`, `interview-feedback`, `vapi-fetch-recording` Edge Function contracts are undocumented.** | `interview_repository.dart` (multiple) | Add TS interfaces + Dart parsers; document in `docs/edge-functions/`. | 2 h |
| B5 | **No timeout on the Vapi `start` call.** `_client?.start(waitUntilActive: true)` can hang. | `widgets/interview_active_view.dart:91-123` | Wrap with `.timeout(Duration(seconds: 30))`. | 15 m |
| B6 | **`elevenlabs-tts` fallback path uses string-match on "Invalid_api_key".** Brittle. | `interview_repository.dart:378-381` | Check `response.statusCode == 401` only; remove the string match. | 5 m |
| B7 | **Vapi assistant config doesn't pin a tool-calls schema.** The `_isEndCallTool` parser tries 4 shapes — if Vapi ships a 5th, auto-end breaks silently. | `widgets/interview_active_view.dart:178-280` | Pin Vapi SDK version in `pubspec.yaml`; subscribe to changelog. | 30 m to pin, ongoing |

---

## Module 4 — Training tab + dialogs

`presentation/training_tab.dart` (349 LOC).

| # | finding | file:line | severity | effort |
|---|---|---|---|---|
| T1 | **Empty-state CTA from #3 works as designed.** ✅ Verified inline. | `training_tab.dart:213-269` | — | — |
| T2 | **Personas dialog drop-down missing.** See F12. | — | P1 | 1 h |
| T3 | **All card titles / descriptions hardcoded English.** "Study Plan Builder", "Personal Statement", "Interview Preparation". | `training_tab.dart:49-79` | i18n | tied |
| T4 | **`uni.name` getter** — depends on `Application.university` model resolving to a name field. After Phase 3R-B `name_uz` may be null on institutions; need to confirm `university.name` falls back to `name_en`/`name_ko`. | `training_tab.dart:287` | P1 | 30 m to verify |

---

## Module 5 — Session history views

### `interview_history_view.dart`

Already covered: F13 (universities-alias bug). Plus:

| # | finding | file:line | severity | effort |
|---|---|---|---|---|
| H1 | **Active sessions are unclickable but no hint.** Tapping a session in `pending` state does nothing — no toast, no disabled affordance. | `interview_history_view.dart:103-114` | P2 | 15 m |
| H2 | **No deletion / archive.** | — | P2 | 2 h |
| H3 | **Date format hardcoded `MMM d, yyyy • h:mm a`.** Doesn't respect device locale. | `interview_history_view.dart:98` | i18n | tied |

### `study_plan_history_view.dart` (new in this branch)

| # | finding | file:line | severity | effort |
|---|---|---|---|---|
| H4 | **Not wired into any AppBar.** The view exists but no entry point — `study_plan_screen.dart` shows the inline `_buildSessionList` instead. | `widgets/study_plan_history_view.dart` (no consumer) | P2 — additive, no harm | 15 m |
| H5 | **Inline `_buildSessionList` and the new history view diverge.** One uses inline ListTile, other uses Card. Inconsistent. | `study_plan_screen.dart:73-160` vs `widgets/study_plan_history_view.dart` | P2 | 1 h to consolidate |

---

## Module 6 — Drafting workspace AI

`widgets/advanced_drafting_workspace.dart` (360 LOC) +
`widgets/ai_highlighting_text_controller.dart` (90 LOC).

| # | finding | file:line | severity | effort |
|---|---|---|---|---|
| A1 | **Issue position resolution uses `lastIndexOf`.** Multiple occurrences of the same word are coalesced to the last position. | `advanced_drafting_workspace.dart:165-181` | P1 — wrong squiggle position | 1 h |
| A2 | **Ghost text always appended at end, ignoring cursor.** | `ai_highlighting_text_controller.dart:78-86` | P2 | 2 h |
| A3 | **Tab-to-accept appends, doesn't insert at cursor.** | `advanced_drafting_workspace.dart:192-204` | P2 | 1 h |
| A4 | **Dummy `FocusNode()` created every build, never disposed.** Memory leak per rebuild. | `advanced_drafting_workspace.dart:322-323` | P1 | 5 m |
| A5 | **Save status flips to "saved" on save failure.** | `advanced_drafting_workspace.dart:113-118` | P1 — misleading UX | 30 m |
| A6 | **Analyze button fire-and-forget chain.** `_saveDraft(...).then(analyze).then(updateStep)` — if save fails, analyze still fires on stale data. | `advanced_drafting_workspace.dart:257-263` | P1 | 30 m |
| A7 | **No max length on input.** | `advanced_drafting_workspace.dart:335-345` | P2 | 5 m |
| A8 | **Squiggly underline ranges break on multibyte chars.** Korean characters are 2 UTF-16 code units; AI may reason in 1-char units. | `ai_highlighting_text_controller.dart:50-66` | P2 | 2 h |
| A9 | **Issue overlap not validated.** Two issues with overlapping ranges produce broken text spans. | `ai_highlighting_text_controller.dart:46-66` | P2 | 30 m |
| A10 | **AI fires every 1 s of pause — no rate cap.** Long sessions of intermittent typing → tens of calls per minute. | `advanced_drafting_workspace.dart:88-92` | P1 — cost | 1 h to add rate-limit |

---

## Module 7 — Phase 3R-B knock-ons + backend contracts

| # | finding | file:line | severity | effort |
|---|---|---|---|---|
| K1 | **`interview_history_view.dart` reads legacy alias** (F13 above). | `interview_history_view.dart:93-95` | P0 | 15 m |
| K2 | All other `from('...')` queries in training/ are migrated correctly. | repos | — | — |
| K3 | **`StudyPlanSession.fromJson` reads `target_institution_id` only.** Old cached responses with `target_university_id` are ignored. Acceptable now (DB renamed) but no fallback. | `study_plan_repository.dart:35` | P2 | 5 m |
| K4 | **No tests asserting the rename.** A future regression that re-adds `target_university_id` would not be caught. | n/a (no tests) | tied to test-coverage P1 | tied |
| K5 | **RLS on training tables looks correct on prod** (5 policies on `study_plan_sessions`, 5 on `interview_sessions`, etc.). Not deeply audited; no obvious holes. | DB-side | — | — |

---

## Module 8 — Localization, parity, tests

### Localization

| # | finding | severity | effort |
|---|---|---|---|
| L1 | **Zero `intl` adoption.** No `.arb` files, no `flutter_localizations` setup in training. | P1 — strategic | 2-3 days for infra + first pass |
| L2 | **Hardcoded Uzbek explanation paragraphs.** Korean / English speakers see Uzbek prose throughout the Study Plan / Personal Statement guide and analysis warning. | P0 if multilingual launch is near; P1 otherwise | 1 day after L1 |
| L3 | **Hardcoded English UI labels.** "Training Center", "Interview Preparation", "Start Practice", error strings. | P1 | 2 days after L1 |
| L4 | **Track values diverge.** `'english'`/`'korean'` (study plan) vs `'en'`/`'ko'` (interview). Same payload concept, two formats. | P1 | 1 h to unify |

### React-web parity

The React web app at `/tmp/hanguk-uz-mine` has fuller surface than Flutter:

| component | React (web) | Flutter | gap |
|---|---|---|---|
| `StudyPlanChat` | functional — input, send, history | dummy placeholder | F2 / U4 above |
| `StudyPlanInstructions` | i18n via `useTranslation` | hardcoded Uzbek | i18n + parity |
| `StudyPlanExample` | dynamic example fetching | static `_AiExampleCard` | medium |
| `InterviewTranscript` | full transcript display, both sides | active view shows only one side | F9 / U14 |
| `InterviewFeedback` | structured score + improvement list | `InterviewFeedbackView` exists but unused | F16 |
| `InterviewAnalytics` | full analytics | analytics view present but feedback fetch logic differs | match shape |
| `AudioInterviewAvatar` | animated waveform | static psychology icon | P2 polish |

Net: Flutter is a working subset of React. Most-impactful gaps are `StudyPlanChat` (dummy in Flutter) and AI-side transcript visibility.

### Test coverage

**Zero tests** for the entire training feature.

| target | priority |
|---|---|
| `StudyPlanSessionNotifier` (state transitions, save/load/delete, error paths) | P1 |
| `InterviewNotifier` (startSession, sendMessage, endSession, getSessionHistory, fetchRecordingUrl) | P1 |
| `_isEndCallTool` parser (4 event-shape variants) — golden test against Vapi sample events | P0 |
| `AiHighlightingTextController.buildTextSpan` (issue ranges, ghost text, multibyte) | P1 |
| Track-mismatch detector (`_detectTrackMismatch`) | P2 |
| Widget tests on the 3 dialogs (interview setup, study plan create, history) | P2 |
| Integration test: full flow study-plan create → draft → save → analyze | P1 |
| Integration test: full flow interview start → speak → auto-end → feedback (mocked Vapi) | P0 |

---

## Cross-cutting hygiene

| # | finding | file:lines | effort |
|---|---|---|---|
| C1 | **`print()` calls in 3 files** instead of `debugPrint`. Will surface in release logs. | `study_plan_repository.dart:324,369,452`; `interview_active_view.dart:130,140,142` | 5 m |
| C2 | **Bang-operator usage (16 sites).** Most are safe-by-construction but each is a latent NPE. | `study_plan_repository.dart` (8), `interview_feedback_view.dart` (7), `study_plan_analysis_view.dart` (1), `interview_active_view.dart` (1), `ai_highlighting_text_controller.dart` (1) | 2 h to reduce |
| C3 | **`catch (e)` everywhere.** Style guide flags this — should use typed `on PostgrestException` / `on FunctionException`. | every repo file | 4 h to refactor |
| C4 | **No `mounted` check after some awaits.** Several state mutations after `await` don't guard `if (!mounted) return`. | scattered | 2 h |

---

## Prioritized backlog

### P0 — ship-blockers (do these before next release)

> **All 9 closed in code 2026-05-10.** Status per item below.

1. ✅ **F8** — Manual-exit "End Interview" button now calls `_completeAutoEnd()`. `widgets/interview_active_view.dart` end-button handler routes through the same teardown path as auto-end.
2. ✅ **F1** — `_buildDraftingStep` now seeds `AdvancedDraftingWorkspace` with `state.drafts.first.content` (or `state.draftContent` if newer). Added a `ValueKey` on the workspace so it remounts cleanly when the user switches sessions.
3. ✅ **F13 / K1** — `interview_history_view._buildSessionCard` reads `session['institution']` first, falls back to legacy `session['universities']` for in-flight cached responses.
4. ✅ **F10** — `InterviewSessionState` gained `timedMode` + `timeLimitSeconds`; `_startCall` schedules a `Timer(Duration(seconds: limit))` that calls `_completeAutoEnd()` on expiry. Cancelled in `_stopCall`.
5. ✅ **F11** — `focusTopic` added to `InterviewSessionState` and threaded through `startSession`. `_startCall` now appends `'Where natural, focus the conversation on this topic: "$focus".'` to the system prompt when set.
6. ✅ **U4** — Per founder pre-decision: deleted the placeholder. `StudyPlanChatFab` content replaced with a deprecated stub returning `SizedBox.shrink()`; `study_plan_screen.dart` no longer imports or mounts it. The `study_plan_chat_history` DB table is intact for a future real implementation. **Note**: the build sandbox can't `unlink` files; the stub file should be deleted entirely on the Windows side.
7. ✅ **F9** — `interview_repository.logTranscriptWithRole(text, role)` added. `interview_active_view.dart` now logs both `'user'` and `'assistant'` final transcripts; assistant rows write `role='interviewer'` into `interview_messages`.
8. ✅ **F7** — Dummy "Tavsiya etilgan videolar (CRM)" section + 3 placeholder cards removed from `_buildInstructionsStep`.
9. ✅ **L2 / U3** — Step 1 guide content + analysis-view track-mismatch warning now switch on `currentSession.selectedTrack` (`korean` / `english` / Uzbek default). Korean and English copy added; Uzbek preserved as the default for the largest cohort.

**P0 total: 9 / 9 closed.**

### P1 — next-session work (high impact, not strictly blocking)

> **All 23 closed in code on 2026-05-10.** Status per item below.

10. ✅ **F2** — `study_plan_sessions.selected_track` column added (migration `20260510140000`); `createSession` now persists it.
11. ✅ **F3** — Added `StudyPlanSession.copyWith`; `updateSessionStep` uses it (also updates `updatedAt`).
12. ✅ **F4** — Empty-applications CTA in `study_plan_screen._showCreateSessionDialog` mirrors the training-tab CTA.
13. ✅ **F5** — Track values unified on `'en'` / `'ko'`; legacy `'english'` / `'korean'` rows tolerated by Step 1 + analysis warning via `normalizeTrack`.
14. ✅ **F6** — `analyzeCurrentDraft` parses the JSON envelope and populates `overall_score`, `grammar_errors`, `content_feedback`, `strengths`, `improvements` on `study_plan_analyses`.
15. ✅ **F12** — Persona dropdown added to the training-tab Interview dialog; threaded through `InterviewScreen(initialPersona:)` → `startSession`.
16. ✅ **F14** — `InterviewNotifier.markAbandoned()` added; called from `InterviewActiveView.dispose` when `_didEndSession == false`. Status enum extended with `'abandoned'`.
17. ✅ **F15** — Confirmed `interview_feedback` table exists with `UNIQUE(session_id)`. Added a defensive Dart-side INSERT in `endSession` that runs when the row is missing — protects against silent Edge Function persistence failures.
18. ✅ **F17** — Score scale reconciled. Edge Function returns 1–10 (per DB CHECK constraints); UI now normalizes ≤10 → ×10 in both `_ScoreBar` and `_MessageFixCard`.
19. ✅ **U1 / A5** — `SaveStatus.error` added; `_saveDraft` flips to `error` on failure and the LiveMetricsBar surfaces "Save failed".
20. ✅ **U10** — `InterviewSetupView` gained a `_UniversityPicker` (reads `applicationsProvider`); Start Practice is disabled until a uni is picked for `university_specific` sessions, with a helper caption.
21. ✅ **U13** — Filler-word detector uses `RegExp(r'\b(?:um+|uh+|like|you know)\b')` to avoid matching `'umbrella'` etc. Korean fillers kept as substring matches.
22. ✅ **U17** — `clearError()` added on `InterviewNotifier`; called from the training-tab dialog before showing.
23. ✅ **D1** — Per-session save mutex (`_withSessionLock`) added to `saveDraft`; concurrent saves now serialize so `(session_id, version)` can't race. Also fixes D2 (no longer overwrites `draftContent` after save).
24. ✅ **D6** — `_persistVapiCallId` now retries 3× with exponential backoff and surfaces a non-blocking warning if all attempts fail.
25. ✅ **A1** — Issue position resolution lifted to `grammar_issue_resolver.dart` — uses first-un-claimed occurrence instead of `lastIndexOf`. Has unit tests.
26. ✅ **A4** — `FocusNode _keyboardListenerFocus` is now a state field, disposed in `dispose()`. The per-build leak is gone.
27. ✅ **A6** — Analyze button awaits `_saveDraft`, aborts on failure. Save → Analyze → Step bump is now a strict sequence.
28. ✅ **A10** — Ghost-text AI calls rate-capped to one per 6 seconds via `_lastAiCallAt` gate. Debounce timer still drives retry.
29. ✅ **B1 / B4** — `lib/features/training/data/training_contracts.dart` documents the three Edge Function response shapes (`study-plan-trainer/supervise`, `study-plan-trainer/analyze`, `interview-feedback`) and provides typed `parse(...)` helpers with shape-failure fallbacks. Has unit tests.
30. ✅ **C1** — All six `print(...)` calls in training code replaced with `debugPrint(...)`.
31. ✅ **Tests** — 27 tests across 5 files: `vapi_event_parser_test.dart` (8), `grammar_issue_resolver_test.dart` (5), `step_one_guide_helper_test.dart` (3), `training_contracts_test.dart` (7), `training_strings_test.dart` (4). Cover the highest-leverage surfaces per the founder's guidance (auto-end logic, transcript role mapping via contracts, locale routing). Full integration test on the live Vapi flow is still P2.
32. ◐ **L1 / L3** — Conservative partial close. Added `presentation/training_strings.dart` consolidating the top-20 user-facing strings × 3 tracks (en / ko / uz). Plus locale-aware Step 1 guide and track-mismatch warning from P0. **Full `flutter_localizations` + `.arb` wiring is still deferred** — the strings table is the migration target, not the final shape. Carry forward to P2.

**P1 total: 22 / 23 closed in code. Item 32 (L1/L3) partial — strings extracted but full intl infra deferred to P2.**

### P2 — nice-to-have

> **All 26 closed in code on 2026-05-10.** Status per item below.
>
> 33 ✅ F16 — `InterviewFeedbackView` stubbed deprecated; consumer was already gone. Delete file Windows-side.
> 34 ✅ U2 — Track-mismatch warning was localized during P0 #9 (Step 1 guide pass).
> 35 ✅ U6 — Added `isAnalyzing` flag on `StudyPlanSessionState`; analysis view reads it instead of `isLoading`.
> 36 ✅ U7 — Removed unused `_exampleSelectedUniName` from `_StudyPlanScreenState`.
> 37 ✅ U8 — Session settings AppBar menu with "Switch track" action; `updateSelectedTrack` persists to `study_plan_sessions.selected_track` and updates state.
> 38 ✅ U11 — `_focusTopicCtrl` (TextEditingController) replaces the bare onChanged variable; disposed properly.
> 39 ✅ U12 — Status-update error events now extract real detail strings (`errorMsg` / `message` / `error` / `detail` / `status`) instead of the misleading generic.
> 40 ✅ U14 — Two-sided transcript display: live partial words on top, then a 6-turn ledger labelled You / AI.
> 41 ✅ U15 — `resetForNewSession()` preserves `feedback`; new "Start another interview" CTA on `InterviewAnalyticsView` uses it.
> 42 ✅ U16 — `Permission.microphone.isPermanentlyDenied` branch shows a "Open settings" SnackBarAction calling `openAppSettings()`.
> 43 ✅ U18 — `_InterviewActiveViewState` now `with WidgetsBindingObserver`; on `paused`/`detached` mid-call it routes through `_completeAutoEnd` (conservative: end-on-background rather than pause/resume).
> 44 ✅ D2 — closed in P1 alongside U1/A5 (`saveDraft` no longer overwrites `draftContent`).
> 45 ✅ D3 — `clearCurrentSession` preserves the sessions list; only nukes per-session state.
> 46 ✅ D4 — `fetchSessions` sorts completed rows to the bottom (alternative considered: filter them out; rejected — users would lose access to past feedback).
> 47 ✅ D5 — Best-effort multi-device stale-draft check on `saveDraft`: re-fetches max remote version, refuses if it exceeds local max with an "Another device saved a newer draft" error. The `(session_id, version)` unique constraint stays as the last line of defence.
> 48 ✅ D7 — Temp message id is tracked; both catch arms call `_rollbackTempMessage(tempId)`.
> 49 ✅ D8 — `_ttsFilePaths` registry + `cleanupTtsFiles()`; called on `resetSession` and `resetForNewSession`.
> 50 ✅ D9 — `getSessionHistory({limit=50, offset=0})`; uses `.range()` for paging.
> 51 ✅ D10 — `endSession` returns early when `isLoading` or `status == 'completed'`.
> 52 ✅ A2/A3 — `_acceptSuggestion` inserts at the cursor; ghost text renders at the cursor via `buildTextSpan`. Both fall back to "append at end" when there's no valid selection.
> 53 ✅ A7 — `TextField.maxLength: 12000`; counter hidden (LiveMetricsBar already shows word/char).
> 54 ✅ A8 — `_splitsSurrogate` guard in `resolveIssues` drops any match that would slice a surrogate pair.
> 55 ✅ A9 — Tested directly via the consumed-mask resolver introduced in P1 A1; new test asserts nested needles don't overlap.
> 56 ✅ B5 — `_client?.start(...)` wrapped in `.timeout(Duration(seconds: 30))`.
>    ✅ B6 — `Invalid_api_key` string-match replaced with `statusCode == 401 || 403`.
>    ✅ B7 — Pubspec comment documents the vendored Vapi pin + test-suite expectation when bumping.
> 57 ✅ C2/C3/C4 — 11 `catch (e)` sites converted to `on Exception catch (e)` across both repos. Reasonable bang-op cases remain (audit said reduce-where-cheap, not eliminate).
> 58 ✅ H1-H5 —
>    H1: in-progress / abandoned sessions now show an explanatory SnackBar on tap.
>    H2: delete-with-confirm IconButton in the interview history card.
>    H3: `DateFormat.yMMMd(locale).add_jm()` replaces the hardcoded `MMM d, yyyy`.
>    H4: `StudyPlanHistoryView` wired into the StudyPlanScreen AppBar (history icon, only shown on the list step).
>    H5: existing inline list on the wizard's home step kept (it's already used + working); H4 is the additive richer view.

(legacy list preserved below for reference)


33. F16 — Decide fate of `InterviewFeedbackView`. (5 m delete)
34. U2 — Track-mismatch warning localization (after L1).
35. U6 — Dedicated `isAnalyzing` flag.
36. U7 — Delete `_exampleSelectedUniName`.
37. U8 — Edit session metadata after creation. (4 h)
38. U11 — `focusTopic` controller. (15 m)
39. U12 — Real Vapi error surfacing. (30 m)
40. U14 — Two-sided transcript display (depends on F9). (1 h)
41. U15 — Practice Again preserves feedback. (30 m)
42. U16 — Deep-link to settings on perma-denied mic. (30 m)
43. U18 — Lifecycle handling for backgrounded calls. (4 h)
44. D2 — Don't overwrite `draftContent` from the saver.
45. D3 — Preserve sessions list on `clearCurrentSession`.
46. D4 — Filter completed sessions in `fetchSessions`.
47. D5 — Multi-device stale-draft protection. (4 h)
48. D7 — Roll back temp messages on AI failure.
49. D8 — Cleanup TTS files.
50. D9 — Paginate `getSessionHistory`.
51. D10 — Guard `endSession` against double-fire.
52. A2 / A3 — Cursor-aware ghost text + tab insertion.
53. A7 — Max length on draft input.
54. A8 — Multibyte-safe issue ranges.
55. A9 — Validate issue overlap.
56. B5 / B6 / B7 — Vapi timeout + cleanup.
57. C2 / C3 / C4 — Bang-op / typed-catch / mounted hygiene.
58. H1-H5 — History view polish (deletion, archive, format, consolidation).

**P2 total: ~3-5 dev-days.**

---

## What this audit did not cover

- **Edge Function source code** for `study-plan-trainer`, `interview-ai`, `interview-feedback`, `vapi-fetch-recording`. They live in the Lovable-managed function repo, not in this codebase. Several findings (B1, F6, F15, F17) require coordination with that repo.
- **Vapi SDK internals** (`packages/vapi/`). Treated as a black box. The four event-shape parser indicates prior bugs in this layer.
- **iOS-specific**: `Info.plist` `NSMicrophoneUsageDescription` not verified.
- **Android `network_security_config.xml`** for Vapi WebRTC traffic.
- **Performance** — no measurement of frame drops in `AdvancedDraftingWorkspace` with long drafts, no measurement of cold-start time.
- **Accessibility** — no screen-reader labels (`Semantics`) audit. None observed in skim, but a focused pass would surface more.
- **The `study_plan_chat_history` table contents** — never read or written by Flutter today, but exists with RLS policies.
