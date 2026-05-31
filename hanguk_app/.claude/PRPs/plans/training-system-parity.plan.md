# Plan: Training System Parity

## Summary
Replicate the fully-featured Study Plan Trainer, Personal Statement Trainer, and Interview Practice modules from the React web app into the Flutter mobile application, matching the UI structure, wizards, session history management, and advanced configuration options precisely.

## User Story
As a student using the Flutter app, I want full access to the AI training pipelines with session histories, advanced settings (timed modes, topics), and rich analytics, so that I have the same high-quality preparation experience as the web platform.

## Problem → Solution
Current Flutter state: Barebones API hooks with simple text areas. No session memory, advanced settings, or analytics view.
Desired state: Fully featured, stateful Flutter views mimicking the React architecture (`StudyPlanTrainer.tsx` and `InterviewPractice.tsx`) including database integration.

## Metadata
- **Complexity**: Large
- **Source PRD**: Voice Note
- **PRD Phase**: Standalone Feature Copy
- **Estimated Files**: 15+

---

## UX Design

### Before
- `StudyPlanScreen`: Simple 3-step timeline (Guide, Draft, Feedback). No session saving.
- `InterviewScreen`: Simple tap-to-talk mic interface. No analytics, transcripts, or advanced settings.

### After
- `StudyPlanScreen`: 4-step wizard, floating chat integration, historical session list, saved drafts.
- `InterviewScreen`: Setup View (Topic, Language Track, Timed Mode switches) → Active Session (avatar, animations, TTS) → Feedback Sheet (scores) → Transcript Review & Analytics dashboard.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `hanguk_app/lib/features/training/presentation/interview_screen.dart` | all | Current starting point for Interview |
| P0 | `Hanguk/src/pages/InterviewPractice.tsx` | 1-800 | Target feature architecture for Interview |
| P1 | `Hanguk/src/pages/StudyPlanTrainer.tsx` | 1-667 | Target feature architecture for Study Plan |
| P2 | `hanguk_app/lib/features/training/data/study_plan_repository.dart` | all | Existing provider to attach sessions to |

---

## Patterns to Mirror

### REACT REPOSITORY PATTERN (Hooks -> Providers)
// SOURCE: `Hanguk/src/hooks/useInterviewSession.ts:1-200`
Will be translated to Riverpod Notifier classes mapping to Supabase select/insert calls. Flutter must save state inside the db equivalent arrays so users see cross-platform parity.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `interview_screen.dart` | UPDATE | Expand from stateless mock to 5-view controller |
| `interview_setup_view.dart` | CREATE | Contains dropdowns tracking language/topics |
| `interview_feedback_view.dart` | CREATE | Detailed chart display for scores |
| `study_plan_screen.dart` | UPDATE | Expand to map React 4-step structure |
| `study_plan_session_repository.dart`| CREATE | DB persistence for drafts |

---

## Step-by-Step Tasks

### Task 1: Data Architecture
- **ACTION**: Build Riverpod Notifiers bridging Supabase sessions.
- **IMPLEMENT**: Create `study_plan_session_repository.dart` querying `study_plan_sessions`. Update `interview_repository.dart` to insert into `interview_sessions`.
- **VALIDATE**: Ensure Riverpod models align 1:1 with Supabase schemas.

### Task 2: Study Plan Reconstruction
- **ACTION**: Re-write `study_plan_screen.dart`.
- **IMPLEMENT**: Add `SessionHistoryList`, step tracking state, and a floating Chat FAB overlay.
- **MIRROR**: Web's 4-step structure logic.
- **VALIDATE**: Sessions accurately save drafts to Supabase in real-time.

### Task 3: Interview UI Extensibility
- **ACTION**: Expand `interview_screen.dart`.
- **IMPLEMENT**: Split the monolithic file into `interview_setup_view.dart`, `interview_active_view.dart`, etc. Add timed mode switches parsing to backend context.
- **VALIDATE**: App compiles and TTS continues functioning flawlessly.

---

## Testing Strategy

### Edge Cases Checklist
- [x] Network failure during AI stream
- [x] Timed mode expiring (auto-submit empty context)
- [x] Resuming an abandoned draft session

---

## Validation Commands
```bash
flutter analyze
flutter build apk
```
EXPECT: Zero type errors, successful build.

## Acceptance Criteria
- [ ] Both systems match Web feature completeness.
- [ ] Cross-platform session compatibility (a session started on web can be viewed on app).
