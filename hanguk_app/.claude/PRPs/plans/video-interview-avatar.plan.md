# Plan: Video Interview with Real-Time AI Avatar

## Summary
Upgrade the audio-only Vapi interview module into a face-to-face video interview where the candidate speaks to a photorealistic AI interviewer with natural facial micro-movements, eye contact, and accurate Korean lip-sync. Replace the current Vapi WebRTC pipeline with **Tavus CVI** (Conversational Video Interface) running its **Phoenix-4** generative-video model, while keeping the existing Supabase-backed session/feedback architecture, ElevenLabs Korean voices, and the just-shipped fixes from `interview-training-fixes.plan.md`.

## User Story
As a Korean-university applicant practising in the Hanguk app,
I want to see and speak to a lifelike AI interviewer on video — with natural eye contact, facial expressions, and lip-sync to my chosen interviewer persona —
so that practice sessions accurately simulate the high-pressure visual environment of a real on-camera Zoom/in-person admissions interview, not just a phone call.

## Problem → Solution
**Current state.** Audio-only WebRTC via Vapi. Candidate sees a static "psychology" icon. No eye contact, no body language, no visual feedback — students who practise here are still surprised by the visual pressure of real interviews.

**Desired state.** Full-screen real-time video of a Korean-appropriate avatar that:
- Maintains eye contact via gaze-tracking
- Speaks Korean with accurate lip-sync (Phoenix-4 supports phoneme-level alignment for Korean)
- Shows facial micro-expressions matched to interviewer persona (friendly smile, strict frown, impatient eyebrow raise)
- Responds with sub-600ms latency end-to-end (Phoenix-4 SLA)
- Records both sides of the conversation for replay
- Falls back to audio-only if the device or network can't sustain 30fps video

## Metadata
- **Complexity**: Large — provider replacement + new Flutter video rendering + DB schema changes + UI redesign
- **Source PRD**: User voice request ("very advanced tool for natural video avatar with all correct natural movements and mimics")
- **PRD Phase**: Major feature upgrade
- **Estimated Files**: ~10 Dart + 1 Edge Function + 1 SQL migration
- **Estimated Effort**: 18–28 hours of focused work, plus avatar selection/training time
- **Out of scope**: Drafting workspace, Study Plan trainer, Updater feature

## Decisions You Need to Make Before Build (BLOCKING)

### A. Provider — recommend **Tavus CVI** with Phoenix-4 (you must confirm)

| Provider | Latency | Korean lip-sync | Bring-your-own LLM | Bring-your-own voice | Mobile WebRTC |
|---|---|---|---|---|---|
| **Tavus CVI (Phoenix-4)** | sub-600ms | yes (Phoenix-4 multilingual) | yes | yes (ElevenLabs supported) | yes (Daily.co stack) |
| HeyGen Interactive Avatar | ~1–2s | yes | partial | partial | yes (LiveKit) |
| Simli | ~500ms | partial | yes | yes | yes |
| D-ID Agents | ~1s | yes | yes | yes | yes |

I recommend Tavus because: the existing Vapi stack also runs on Daily.co, so the Flutter WebRTC plumbing is the same shape we already understand; Phoenix-4 explicitly markets emotional-intelligence + sub-600ms; and "Bring-Your-Own-LLM" lets us keep the existing `interview-ai` Edge Function and prompt logic — no rewrite of the AI brain.

### B. Replace vs. augment — recommend **replace Vapi entirely**
Augmenting (running Vapi audio + video avatar separately, syncing two streams) is fragile and doubles costs. Tavus's CVI delivers audio AND video on a single Daily room, calls our LLM and ElevenLabs TTS internally. Confirm you're OK retiring the Vapi dependency.

### C. Avatar selection — you must pick
You need to choose one of:
1. **Stock replicas** — Tavus library has Korean/East-Asian-appearing stock avatars (no training cost, instant). I recommend starting here.
2. **Personal replicas** — Train a custom replica on a 2-min video of a real Korean professor (one-time cost, ~24h training, more authentic but slow to iterate).
3. **Per-persona replicas** — friendly/strict/impatient each get their own avatar (3× the cost/setup of option 1).

### D. Cost ceiling — you must set
Tavus CVI is per-minute-of-conversation. Phoenix-4 is the premium tier. Without a quota, a single student could rack up real money. Recommend a hard per-student daily quota (e.g. 30 minutes/day) enforced server-side.

### E. Network/device fallback policy — you must pick
- **Strict**: video required; fail with a clear message if WebRTC/30fps is not viable.
- **Graceful** (recommended): try video first; on RTC failure, downgrade to the existing Vapi audio-only path so practice still works on poor networks.

## Risk Register

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Just-fixed audio interview regressed by replacing Vapi** | We literally shipped the audio fix this session (`interview-training-fixes.plan.md`). Ripping out Vapi could re-introduce all 5 bugs | Keep Vapi code path intact behind a feature flag; new video path is additive. Only flip the default once video has equal-or-better behaviour on every Task 1–5 acceptance criterion |
| **Per-minute pricing surprises** | Phoenix-4 is premium; uncapped student usage = invoice shock | Server-side daily/monthly quota in `interview-feedback` Edge Function; client-side soft limit shown in UI; abandon-session detection so paused calls don't bill silently |
| **Korean lip-sync quality varies by phoneme** | Korean has tense consonants and complex vowel coarticulation; not every avatar model handles them well | Lock to Phoenix-4 (current most accurate); test on a Korean phrase set (한국대학교, 안녕하세요, 진학하고 싶습니다, etc.) before shipping |
| **Mobile battery / data cost** | 30fps video at 1Mbps = ~7MB/min downlink + heavy GPU on phone | Show data-usage banner before session start. Default to 480p instead of 720p on cellular. Monitor `connection-quality` event from Daily and offer downgrade to audio. |
| **Mic/camera permission collisions** | We had Vapi mic only; now adding camera permission too. Permission denial flows must be re-tested | Use `permission_handler` (already in pubspec) for both `microphone` and `camera` upfront. Surface clear "permission needed" UI before starting the call |
| **Stock Tavus replica may not feel "Korean enough"** | Tavus stock library is global; Korean students may find a generic Asian replica off-putting | Plan a Phase-2 task to train a personal replica from a Korean voice actor; Phase 1 ships with stock to get the feature out |
| **Recording storage doubled** | Now we have audio + video. Storage cost rises | Tavus stores recordings on its infra (same as Vapi did). Persist `tavus_conversation_id` like we just did `vapi_call_id`. No Supabase Storage bucket needed. |
| **Latency regression vs. audio-only** | Audio-only Vapi was ~300ms; video is ~600ms even at SLA. Some students may notice | Phoenix-4 is the lowest-latency video option in 2026. If 600ms is unacceptable, the only alternative is dropping back to audio. We can A/B with a small panel before global rollout. |
| **WebRTC on Flutter Web** | Flutter web rendering of Daily.co video has historically had quirks | Phase 1 ships Android-only (where most users are anyway). Web/iOS in Phase 2 |

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | [`lib/features/training/presentation/widgets/interview_active_view.dart`](../../../lib/features/training/presentation/widgets/interview_active_view.dart) | all | Current Vapi WebRTC active view — the entire file is being replaced (or feature-flagged) |
| P0 | [`lib/features/training/data/interview_repository.dart`](../../../lib/features/training/data/interview_repository.dart) | 13–23, 129–200, 294–331, 466–480 | Voice config, session lifecycle, `endSession`, `fetchRecordingUrl` — all need Tavus equivalents |
| P0 | [`lib/core/config/app_config.dart`](../../../lib/core/config/app_config.dart) | all | Add Tavus credentials and replica IDs |
| P1 | [`lib/features/training/presentation/widgets/interview_analytics_view.dart`](../../../lib/features/training/presentation/widgets/interview_analytics_view.dart) | 192–244 | `_AudioPlayerWidget` currently plays Vapi audio; needs to handle Tavus video recording URL too |
| P1 | [`.claude/PRPs/plans/interview-training-fixes.plan.md`](interview-training-fixes.plan.md) | all | Acceptance criteria from this plan are STILL REQUIRED in the video version |
| P2 | [`packages/vapi/`](../../../packages/vapi/) | scan | Reference for how WebRTC was wrapped — Tavus uses Daily.co similarly |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Tavus CVI overview | [docs.tavus.io/sections/conversational-video-interface/overview-cvi](https://docs.tavus.io/sections/conversational-video-interface/overview-cvi) | Conversation = persona + replica + LLM; runs on Daily.co WebRTC |
| Phoenix-4 model | [marktechpost.com — Phoenix-4 launch Feb 2026](https://www.marktechpost.com/2026/02/18/tavus-launches-phoenix-4-a-gaussian-diffusion-model-bringing-real-time-emotional-intelligence-and-sub-600ms-latency-to-generative-video-ai/) | Sub-600ms end-to-end; Gaussian-diffusion architecture; emotional response |
| Tavus "Bring your own LLM" | docs.tavus.io (Personas → Custom LLM) | Lets us keep our `interview-ai` Edge Function as the brain |
| Tavus "Bring your own voice" | docs.tavus.io (Personas → TTS) | Plug in ElevenLabs voice IDs we just configured |
| Daily.co Flutter SDK | docs.daily.co | Flutter package `daily_flutter` renders the WebRTC video stream |
| Sparrow-0 turn-taking | docs.tavus.io (Conversation → Turn-taking) | Fixes the awkward interruption problem from voice-only Vapi |

## Patterns to Mirror

### TAVUS CONVERSATION LIFECYCLE
```
1. POST /v2/conversations  → returns { conversation_id, conversation_url }
2. Open conversation_url in Daily.co Flutter renderer
3. Listen to Daily events: 'joined-meeting', 'participant-joined', 'app-message' (for transcripts), 'left-meeting'
4. POST /v2/conversations/{id}/end  → graceful end
5. GET /v2/conversations/{id}  → recording URL + transcript
```
Mirror this in a new `TavusRepository` analogous to current `InterviewRepository.setVapiCallId / fetchRecordingUrl`.

### PERSONA → REPLICA + VOICE MAPPING (already established in this codebase)
We already map persona → ElevenLabs voice ID via `InterviewPersonaConfig.getVoiceId()`. Extend it: persona → (replica_id, voice_id). Keep it as the single source of truth.

### FEATURE FLAG (new pattern, but standard)
```
AppConfig.useVideoInterview  // defaults true on android, false on web/ios for Phase 1
```
Drive routing in `InterviewScreen._buildCurrentView` — when active, pick `InterviewActiveVideoView` (new) vs `InterviewActiveView` (existing Vapi audio).

## Files to Change

| File | Action | Why |
|---|---|---|
| `lib/core/config/app_config.dart` | UPDATE | Add `tavusApiKey`, `tavusReplicaIdKoFriendly`, `tavusReplicaIdKoStrict`, `tavusReplicaIdKoImpatient`, `tavusPersonaIdKo`, `useVideoInterview` flag |
| `lib/features/training/data/tavus_repository.dart` | CREATE | New repository: `createConversation`, `endConversation`, `fetchRecording` (REST calls to Tavus API) |
| `lib/features/training/data/interview_repository.dart` | UPDATE | Add `tavusConversationId` to `InterviewSessionState`; persist on session start; new `setTavusConversationId()` |
| `lib/features/training/presentation/widgets/interview_active_video_view.dart` | CREATE | New active view rendering Daily.co video stream with avatar |
| `lib/features/training/presentation/interview_screen.dart` | UPDATE | Route to video view or audio view based on `AppConfig.useVideoInterview` flag |
| `lib/features/training/presentation/widgets/interview_setup_view.dart` | UPDATE | Add visual avatar preview; show data-usage warning |
| `lib/features/training/presentation/widgets/interview_analytics_view.dart` | UPDATE | `_AudioPlayerWidget` becomes `_RecordingPlayerWidget`: detects audio-vs-video URL and renders the right player |
| `pubspec.yaml` | UPDATE | Add `daily_flutter` (or `livekit_client` if Tavus uses LiveKit) and `video_player` |
| `supabase/migrations/<ts>_interview_sessions_tavus_conversation_id.sql` | CREATE | `add column tavus_conversation_id text` plus index |
| `supabase/functions/tavus-create-conversation/index.ts` | CREATE (in functions repo) | Server-side conversation creation that holds Tavus API key + applies user quota |
| `supabase/functions/tavus-fetch-recording/index.ts` | CREATE (in functions repo) | Mirror of existing `vapi-fetch-recording` but for Tavus |
| `supabase/functions/interview-quota/index.ts` | CREATE (in functions repo) | Per-user daily/monthly Tavus minute quota check |

## NOT Building
- **Custom replica training** in Phase 1 — use stock Tavus replicas. Custom training is a Phase 2 follow-up requiring a real Korean voice actor recording session.
- **iOS support** in Phase 1 — Android only. iOS Phase 2 once Android is proven.
- **Web support** in Phase 1 — Flutter web video reliability is shaky.
- **Removing Vapi code** — keep it as fallback/feature-flagged audio path. Can delete in a later cleanup PR after video is stable.
- **A new feedback rubric** — keep the existing 5-score rubric (overall/communication/confidence/content/language). The interview-feedback Edge Function still works on transcripts, which Tavus also produces.
- **Multi-person interviews** (panel of 3 professors) — single avatar per session.
- **Avatar customization by student** — students can't pick their own avatar; the persona setting decides.

---

## Step-by-Step Tasks

### Task 1 — Tavus account + replica/persona setup (MANUAL, you do this)
**ACTION**: Create a Tavus account, generate an API key, pick three stock replicas matching the friendly/strict/impatient personas, create a Tavus "persona" wired to call our `interview-ai` Edge Function as its custom LLM.

**IMPLEMENT (manual, in Tavus dashboard)**:
1. Sign up at tavus.io → grab API key.
2. Browse Replica Library, audition Korean/East-Asian replicas. Pick three:
   - friendly (warm, female or male, smile-prone)
   - strict (older male, formal)
   - impatient (sharp delivery, less smile)
3. Create one Persona per language (start with `ko`):
   - Set `system_prompt` to mirror the prompt in `interview_active_view.dart` lines 60–83
   - Configure `llm.model` = `custom`, `llm.url` = our Supabase `interview-ai` Edge Function URL with appropriate auth header
   - Configure `tts.provider` = `elevenlabs`, `tts.voice_id` = our existing ElevenLabs Korean IDs from `AppConfig`
   - Enable `recording_enabled = true`, `transcription_enabled = true`
4. Note the persona_id and replica_ids — these go into `AppConfig`.

**GOTCHA**: Tavus's "Custom LLM" feature requires the LLM endpoint to speak OpenAI-compatible chat completions. Our `interview-ai` function may need a thin adapter shim. Verify by calling it with a Tavus test message before going further.

**VALIDATE**: Use Tavus dashboard's built-in test conversation to verify the persona speaks Korean with the chosen voice and answers correctly through your LLM.

---

### Task 2 — Wire Tavus credentials & feature flag in `AppConfig`
**ACTION**: Add Tavus identifiers to `AppConfig` with environment overrides, plus a `useVideoInterview` feature flag.

**IMPLEMENT** in [`app_config.dart`](../../../lib/core/config/app_config.dart):
- `tavusApiKey` from `String.fromEnvironment('TAVUS_API_KEY')` — but **do NOT default** the key in source; force `--dart-define`. The existing `vapiPublicKey` is hardcoded because Vapi public keys are intentionally public; Tavus keys are not.
- `tavusPersonaIdKo`, `tavusReplicaIdKoFriendly`, `tavusReplicaIdKoStrict`, `tavusReplicaIdKoImpatient`, all env-overridable like the voice IDs.
- `useVideoInterview` bool — default `true` only on Android in release builds; `false` elsewhere for Phase 1.

**GOTCHA**: Even with `--dart-define`, the API key ends up in the compiled binary. The clean answer is *never put the key in the client* — keep it server-side in the new `tavus-create-conversation` Edge Function (Task 5). The `tavusApiKey` constant exists only as an emergency override for local dev.

**VALIDATE**: `flutter analyze`. No missing-import errors.

---

### Task 3 — `TavusRepository` (REST + state)
**ACTION**: Create a thin Tavus REST wrapper plus Riverpod state.

**IMPLEMENT** in [`lib/features/training/data/tavus_repository.dart`](../../../lib/features/training/data/tavus_repository.dart) (new):
- `createConversation({personaId, replicaId, conversationContext})` — hits our **server-side** Edge Function `tavus-create-conversation` (NOT Tavus API directly). Returns `{conversationId, conversationUrl}`.
- `endConversation(conversationId)` — hits Edge Function.
- `fetchRecording(conversationId)` — hits `tavus-fetch-recording` Edge Function.

Add `tavusConversationId` to `InterviewSessionState` and a `setTavusConversationId()` notifier method (mirror the just-added `setVapiCallId`).

**GOTCHA**: Don't call `api.tavus.io` directly from the Flutter client. Always go through Supabase Edge Functions so the Tavus API key never ships in the binary, and so per-user quotas can be enforced server-side.

**VALIDATE**: Unit tests with `mocktail` mocking the HTTP layer — happy path, network failure, 4xx from Tavus.

---

### Task 4 — `InterviewActiveVideoView` Flutter widget
**ACTION**: Build the new full-screen video view that renders the Tavus avatar via Daily.co.

**IMPLEMENT** in [`lib/features/training/presentation/widgets/interview_active_video_view.dart`](../../../lib/features/training/presentation/widgets/interview_active_video_view.dart) (new):
- On `initState`: request `microphone` AND `camera` permissions via `permission_handler`. Block until granted; show `InterviewSetupView`-style "permissions required" UI on denial.
- Call `tavusRepository.createConversation(...)` → get `conversationUrl`.
- Render the Daily.co video using `daily_flutter`:
  - Full-screen avatar tile
  - Picture-in-picture self-view (camera, draggable)
  - Mute/end controls
  - Connection-quality indicator
- Listen to Daily events:
  - `joined-meeting` → mark `_callActive = true`
  - `participant-joined` → mark `_avatarReady = true`
  - `app-message` with `event_type=conversation.utterance` → log transcript via `logTranscript()`
  - `app-message` with `event_type=conversation.respond` and `tool=endCall` → trigger `_completeAutoEnd()` (mirror Task 3 of the audio plan)
  - `connection-quality-change` → if poor, show banner "Switching to audio-only" and fall back to `InterviewActiveView`
  - `left-meeting` → `_stopCall()` then `endSession()`
- Reuse `_didEndSession`, `_aiRequestedEnd`, `_forceEndTimer` guards from the audio view (literally copy the logic — the auto-end flow is identical).

**GOTCHA**: Daily Flutter's video rendering needs the right Android `<application>` `android:hardwareAccelerated="true"` and Camera2 permissions in `AndroidManifest.xml`. Check before assuming "it just works".

**VALIDATE**: On a real Android device, you should see a Korean avatar greet you in Korean within ~3 seconds of starting a session. Hang up, end-call function, transcript logging, recording reference all working.

---

### Task 5 — Server-side: Edge Functions for Tavus + quota
**ACTION**: Three new Edge Functions in your `supabase/functions/` repo.

**IMPLEMENT (in functions repo, not this repo)**:
1. **`tavus-create-conversation`** — receives `{sessionId, personaId, replicaId, language}` from app. Looks up the user from JWT. Calls the quota function. If allowed: POSTs to `https://tavusapi.com/v2/conversations` with the Tavus API key (held as a Supabase secret). Returns `{conversationId, conversationUrl}`. Also writes `tavus_conversation_id` to `interview_sessions` (mirrors the `vapi_call_id` persistence we just shipped).
2. **`tavus-fetch-recording`** — receives `{conversationId}`. Verifies that conversation belongs to the calling user (RLS-style check on `interview_sessions`). Calls Tavus GET endpoint. Returns `{recordingUrl, transcript}`.
3. **`interview-quota`** — receives `{userId}`. Queries `interview_sessions` for total minutes consumed in the current rolling 24h window. Compares to a configurable cap (default: 30 min). Returns `{allowed: bool, remaining_minutes}`.

**GOTCHA**: The Tavus API key MUST be a Supabase secret (`TAVUS_API_KEY` in the function's env), NEVER in the client binary. Set via `supabase secrets set TAVUS_API_KEY=...`.

**VALIDATE**: `curl` each function locally against `supabase functions serve`. Verify quota blocks correctly when synthetically over-limit.

---

### Task 6 — DB migration for `tavus_conversation_id`
**ACTION**: Add nullable column.

**IMPLEMENT** new migration (mirroring the `vapi_call_id` migration we just ran):
```
alter table public.interview_sessions
  add column if not exists tavus_conversation_id text;

create index if not exists interview_sessions_tavus_conversation_id_idx
  on public.interview_sessions (tavus_conversation_id);
```

Run via Supabase SQL Editor or `supabase db push`.

**VALIDATE**: `select column_name from information_schema.columns where table_name='interview_sessions' and column_name='tavus_conversation_id';` returns one row.

---

### Task 7 — Wire `InterviewScreen` routing & feature flag
**ACTION**: Branch on `AppConfig.useVideoInterview` to pick the new vs. old active view.

**IMPLEMENT** in [`interview_screen.dart`](../../../lib/features/training/presentation/interview_screen.dart):
```dart
} else {
  return AppConfig.useVideoInterview && Platform.isAndroid
      ? const InterviewActiveVideoView()
      : const InterviewActiveView();
}
```
Default the flag `true` on Android release; `false` everywhere else for Phase 1.

**VALIDATE**: Flip flag at runtime on a debug build. Confirm both paths work.

---

### Task 8 — Recording playback in `InterviewAnalyticsView`
**ACTION**: Make the analytics audio player aware that recordings can now be video.

**IMPLEMENT** in [`interview_analytics_view.dart`](../../../lib/features/training/presentation/widgets/interview_analytics_view.dart):
- Replace `_AudioPlayerWidget` with a `_RecordingPlayerWidget` that:
  - Accepts both `vapiCallId` and `tavusConversationId`
  - Prefers `tavusConversationId` if present (it's the newer recording with video)
  - Renders `video_player` for `.mp4` URLs, `audioplayers` for `.mp3`/`.wav`
- Pass `overrideTavusConversationId` through history → analytics like we did for `vapi_call_id`.

**VALIDATE**: Complete a video session, open from history, click play → see + hear the recorded interview. Open an old audio-only session → audio still plays.

---

### Task 9 — Setup view: avatar preview + data warning
**ACTION**: Update setup view to make the new feature legible.

**IMPLEMENT** in [`interview_setup_view.dart`](../../../lib/features/training/presentation/widgets/interview_setup_view.dart):
- Show a static preview thumbnail of each persona's avatar next to the persona dropdown.
- Show a one-line warning: "Video interviews use ~7 MB/min. Use Wi-Fi for best quality."
- Add a small toggle: "Audio-only mode" (forces `useVideoInterview=false` for the next session — useful when the user's data is metered).

**VALIDATE**: Visual sanity check on device.

---

### Task 10 — Permissions, manifest, and graceful fallback
**ACTION**: Make sure the permission and fallback paths are airtight.

**IMPLEMENT**:
- `android/app/src/main/AndroidManifest.xml`: add `<uses-permission android:name="android.permission.CAMERA"/>`, `<uses-feature android:name="android.hardware.camera" android:required="false"/>`.
- iOS (Phase 2): `ios/Runner/Info.plist` keys `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`.
- In `InterviewActiveVideoView.initState`, request both permissions with `permission_handler`. On denial of camera-only, fall through to audio-only `InterviewActiveView`. On denial of mic, error out cleanly.
- Network downgrade: subscribe to Daily.co's `connection-quality-change`. If poor for >5 seconds, end the Tavus call and resume in the audio path with the same `sessionId` (so the user's transcript & feedback are still tied to one DB row).

**VALIDATE**:
- Deny camera → audio-only session starts.
- Deny mic → clear "mic required" message, no session.
- Toggle airplane mode mid-session → graceful fallback or end with feedback view.

---

## Testing Strategy

### Manual matrix (real Android device, Wi-Fi + cellular)

| Scenario | Expected |
|---|---|
| KO + friendly stock replica, Wi-Fi | Korean female avatar greets, eye contact, lip-sync clean |
| KO + strict, cellular 4G | Avatar greets, may downgrade resolution, still functional |
| KO + impatient, poor network | Auto-fallback to audio-only after 5s of poor quality |
| Camera permission denied | Falls back to audio-only path (existing) |
| Mic permission denied | Clear error; no session |
| Quota exhausted | "You've used your daily 30 min — try tomorrow" |
| 4-phase complete → endCall | Avatar says closing line → call ends → feedback shows |
| History → tap completed video session | Video player loads & plays |
| History → tap pre-video audio session | Audio player loads & plays (regression check) |

### Automated tests
- `tavus_repository_test.dart`: HTTP-mocked happy + error paths
- `interview_active_video_view_test.dart`: widget test for the auto-end flow guards (mocking Daily events)
- Integration smoke: Edge Function quota check

### Korean lip-sync calibration set
Test phrases the avatar must speak before sign-off:
- 안녕하세요, 만나서 반갑습니다.
- 한국대학교에 지원해 주셔서 감사합니다.
- 지원 동기에 대해 말씀해 주시겠어요?
- 졸업 후 어떤 진로를 계획하고 계십니까?
- 면접에 응해 주셔서 감사합니다. 좋은 결과 있으시기를 바랍니다.

Score 1–5 on lip-sync accuracy and emotional appropriateness per phrase. Fail the rollout if average <4.

## Validation Commands
```bash
# Static
dart format --set-exit-if-changed lib/features/training/ lib/core/config/ lib/features/training/data/
dart analyze lib/features/training/ lib/core/config/ --fatal-infos

# Tests
flutter test test/features/training/

# Build with Tavus key (debug)
flutter run -d <android-device> \
  --dart-define=TAVUS_API_KEY=<dev-key> \
  --dart-define=TAVUS_PERSONA_ID_KO=<id>

# Release build
flutter build apk --release \
  --dart-define=TAVUS_PERSONA_ID_KO=<id> \
  --dart-define=TAVUS_REPLICA_ID_KO_FRIENDLY=<id> \
  --dart-define=TAVUS_REPLICA_ID_KO_STRICT=<id> \
  --dart-define=TAVUS_REPLICA_ID_KO_IMPATIENT=<id>
```

## Acceptance Criteria
- [ ] Starting a Korean interview shows a video avatar greeting the candidate within 3 seconds of session start.
- [ ] Lip-sync calibration score ≥ 4/5 average across the 5 test phrases.
- [ ] Avatar persona changes (friendly/strict/impatient) are visually distinct (different replica or expression set).
- [ ] Sub-1-second perceived turn-taking on Wi-Fi (Phoenix-4 sub-600ms target).
- [ ] On poor network, the session gracefully falls back to audio-only without losing the transcript/session row.
- [ ] All five fixes from `interview-training-fixes.plan.md` (Korean accent, AI greets first, auto-end, recording stored, post-session feedback) still pass on the new video path.
- [ ] Tavus API key is NEVER present in the released APK (`unzip -p app.apk classes.dex | strings | grep tavus` returns no key).
- [ ] Per-user daily quota of 30 minutes is enforced server-side; UI shows remaining minutes in setup view.
- [ ] No regression in audio-only history sessions: opening a pre-migration session in History still plays its Vapi audio recording.
- [ ] `flutter analyze` and `dart format --set-exit-if-changed` pass with zero warnings.
