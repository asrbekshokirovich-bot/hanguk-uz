# Plan: Flutter Native Training Pipeline

## Summary
Port the web-based PWA "Study Plan Trainer", "Personal Statement Trainer", and "Interview Practice" modules directly into the Flutter mobile application's natively available `TrainingTab`. This integration allows VIP students to draft/revise admissions documents via LLM tutors and undergo interactive oral interview practices with STT/TTS directly inside the app.

## User Story
As a VIP Student, I want to access interactive document trainers and interview coaching directly on my mobile phone, so that I can prepare for my university/visa applications efficiently without logging back onto the web portal.

## Problem → Solution
The Hanguk mobile application previously featured a stagnant `TrainingTab` containing mock UI routes to empty placeholder features while the web application CRM possessed highly complex Edge Function-backed Trainer APIs. 
**Solution**: Synchronize the Flutter app with the Supabase Edge infrastructure (e.g., `study-plan-trainer`, `interview-ai`, `interview-feedback`) using Riverpod Providers, introducing step-by-step document editing and simulated dialogue systems to mobile users exactly matching the React counterparts.

## Metadata
- **Complexity**: Large
- **Source PRD**: N/A
- **PRD Phase**: Standalone Migration Request 
- **Estimated Files**: ~15 files (UI features + Riverpod Data Repositories)

---

## UX Design

### Before
`TrainingTab` acts as a static list. Tapping "Study Plan Builder", "Personal Statement", or "Interview Preparation" does absolutely nothing. No functionality is exposed to the mobile user.

### After
Tapping a module spawns a dedicated native interactive flow: 
1. **Document Trainers**: An interactive multi-step wizard (1. Get Instructions -> 2. See AI Example -> 3. Draft/Edit Document -> 4. Obtain Analytical Edge Function score/Grammar Corrections). Includes floating Chat AI bot over the native text editor.
2. **Interview Practice**: A dialogue session configuration interface routing the user to a recording/listening loop where AI speaks via `elevenlabs-tts` Edge routing and records student strings locally via Speech-to-Text. Finishes with an analytical scoreboard mapping strength areas vs improvements.

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Native `TrainingTab` taps | Do nothing | Route to specialized Trainer | Requires new `go_router` route logic mapping nested tabs |
| Trainer Editor | N/A | Multi-stage document workspace | Allows text drafting while interacting contextually with a Chat bubble |
| Spoken Interview | N/A | Mic/Play STT/TTS Interface | Interfaces with native device Microphone |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `lib/features/chat/data/chat_repository.dart` | 48-100 | Defines the absolute exact correct exception handling wrapper syntax used for calling Supabase `.functions.invoke` in this native app. |
| P1 (important) | `Hanguk/src/hooks/useStudyPlanTrainer.ts` | 17-68 | Outlines the exact endpoint signatures `study_plan_trainer` requires natively `(action, documentType, content, language)`. |
| P1 (important) | `Hanguk/src/pages/InterviewPractice.tsx` | 227-320 | Demonstrates how TTS and AI text logic interplay using `interview-ai` and `elevenlabs-tts`. |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Supabase Functions | Supabase SDK Docs | Always cast response directly from `response.data as Map<String, dynamic>?` catching `FunctionException` specifically |
| Speech-To-Text Flutter | `speech_to_text` pub.dev | We must install and authorize native Apple/Android permissions within iOS `Info.plist` and Android `AndroidManifest.xml` before voice interaction occurs. |

---

## Patterns to Mirror

### EDGE_FUNCTION_INVOKE
// SOURCE: lib/features/chat/data/chat_repository.dart:59
```dart
      final response = await client.functions.invoke(
        'study-plan-trainer',
        body: {
          'action': action,
          'documentType': documentType,
          'content': content,
          'language': language,
        },
      );
```

### EXCEPTION_HANDLING
// SOURCE: lib/features/chat/data/chat_repository.dart:82
```dart
    } on FunctionException catch (e) {
      final errDetail = (e.details is Map) ? (e.details as Map)['error'] : e.details;
      state = state.copyWith(error: 'Edge error: ${errDetail ?? e.toString()}');
    } catch (e) {
      state = state.copyWith(error: 'Could not reach Server. Check your connection.');
    }
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `lib/features/training/data/study_plan_repository.dart` | CREATE | Houses Document Edge functional queries |
| `lib/features/training/data/interview_repository.dart` | CREATE | Houses `interview-ai`, `interview-feedback`, & `audio` generation endpoints |
| `lib/features/training/domain/training_models.dart` | CREATE | Parses Feedback arrays (`grammar_errors`, `strengths`) safely |
| `lib/features/training/presentation/training_tab.dart` | UPDATE | Attach `onTap` Navigators into new routes |
| `lib/features/training/presentation/study_plan_screen.dart` | CREATE | Wizard builder UI for drafting and grading docs |
| `lib/features/training/presentation/interview_screen.dart` | CREATE | Speaking/listening simulated interaction UI |
| `android/app/src/main/AndroidManifest.xml` | UPDATE | Microphone network permissions |
| `ios/Runner/Info.plist` | UPDATE | Microphone network permissions |
| `pubspec.yaml` | UPDATE | Integrate `speech_to_text` / `just_audio` playback libs |

## NOT Building
- Fully offline STT parsing caching systems (Relies on network exactly like Web PWA)
- Automatic Document Upload Parsing (Users must type / copy-paste inside the mobile editor natively)

---

## Step-by-Step Tasks

### Task 1: Scaffolding Dependencies & API Framework
- **ACTION**: Incorporate native audio/mic packages.
- **IMPLEMENT**: Add `speech_to_text: ^6.1.1`, `just_audio: ^0.9.36` to `pubspec.yaml`. Add Audio Android and Microphone iOS usage descriptors locally.
- **VALIDATE**: `flutter pub get` must install correctly.

### Task 2: Study Plan & Personal Statement Repository Layer
- **ACTION**: Write standard Data repositories.
- **IMPLEMENT**: Build `StudyPlanRepository` connecting the `study-plan-trainer` Edge function mimicking the `callTrainer()` logic (actions: teach, generate_example, analyze, chat).
- **MIRROR**: Edge Function Invoke & Exception Handling
- **GOTCHA**: Supabase Edge responses require explicit JSON Map casting on successful resolution. Check if `.data` maps directly to String for the analysis component or raw Map.

### Task 3: Document Editing Workspace UI (Flutter)
- **ACTION**: Implement an interactive step-by-step document builder pipeline.
- **IMPLEMENT**: Establish 4 tabs/steps (Instructions -> Generate AI Blueprint -> Text Editor -> View Extracted Analysis).
- **VALIDATE**: Validate the TextField expands cleanly upon keyboard initialization without obscuring the action buttons natively.

### Task 4: Interview Networking Interceptors
- **ACTION**: Map Interview AI logic.
- **IMPLEMENT**: Map `/functions/v1/interview-ai` and `/functions/v1/interview-feedback` under an `InterviewRepository` class. Tie STT transcripts into `interview-ai` queries, feeding the response to ElevenLabs API endpoints to harvest playable Audio Bytes natively into `just_audio`.
- **GOTCHA**: Ensure audio buffers play seamlessly via direct stream feeding rather than forced static file caching if possible, to lower ping delays. Handle timeouts natively within 60s frames.

### Task 5: Mobile Voice Chat UI
- **ACTION**: Build the simulator environment.
- **IMPLEMENT**: Build a visually clean speaking interface showcasing a pulsating AI avatar while TTS plays back. Provide explicit language toggling buttons.
- **VALIDATE**: Device screen prevents locking (`wakelock_plus`) while interview executes inside session dynamically.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| StudyPlan Analysis Mock | `{'grammar_errors': [...]}` | Repository safely parses JSON strings vs Map responses appropriately from the AI model output. | Handles malformed JSON safely bypassing crash. |

### Edge Cases Checklist
- [ ] iOS Microphone Denied condition gracefully handles fallback routing.
- [ ] Network timeout when waiting for ElevenLabs TTS Audio.
- [ ] Supabase Token Refreshing during an active 15 minute interview session does not crash authorization parameters mid-call.

---

## Validation Commands

### Flutter Build Verification
```bash
flutter build apk --debug
```
EXPECT: Builds perfectly with updated Android Microphone Manifest settings

### Linting
```bash
flutter analyze
```
EXPECT: Zero unused parameter warnings within complex repositories.

## Acceptance Criteria
- [ ] 3 Main Training Modules cleanly route to internal application states.
- [ ] LLM AI connections hit proper Edge Functions avoiding static API keys natively in app.
- [ ] Text-editing workspace replicates Web-features natively storing Draft text variables safely.
- [ ] Spoken Interview captures physical microphone outputs and natively plays back requested AI language audio payloads seamlessly.
