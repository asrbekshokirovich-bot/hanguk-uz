# Plan: Advanced AI Interview Capabilities

## Summary
Upgrade the `Interview Practice` module to provide a highly interactive, realistic, and deeply supportive mock interview experience. Specifically, we will move beyond standard conversational ping-pong by introducing live coaching overlays, conversational rescue lifelines, dynamic interviewer personas, and granular post-interview corrections.

## User Story
As an international student preparing for my Korean university admission interview,
I want an AI that not only asks questions but coaches my pacing, rescues me when I freeze, and realistically simulates different types of professors,
So that I feel completely confident and over-prepared for the real, high-pressure environment.

## Problem → Solution
Current state is a generic "warm and encouraging" back-and-forth bot without awareness of the student's delivery pacing or struggle. → Desired state introduces real-time Speech-to-Text coaches, AI hints when the user freezes, dynamic personas, and granular "Tap-to-fix" transcript feedback at the end.

## Metadata
- **Complexity**: Large
- **Source PRD**: User Audio Request
- **PRD Phase**: N/A
- **Estimated Files**: ~6-8 (Flutter views & Edge Functions)

---

## 🚀 Proposed Advanced Features (User Selection Required)

Below are the suggested advanced AI features you can choose to implement to make the interview module "really good equipped". **Please review and let me know which ones you want me to build:**

### Option 1: Live "Lifeline" Hints (Anti-Freeze Rescue)
**How it works:** If the microphone has been listening for 5+ seconds without recognizing a completed thought (meaning the student froze or forgot their words), the Flutter UI automatically detects the silence and triggers a hidden API call. A floating "Hint" bubble appears containing 3 short, contextually correct bullet points of what they could say next to rescue the conversation.
**Value:** Prepares students on how to smoothly recover from memory lapses during high-pressure interviews.

### Option 2: Live Pacing & Filler Word Coach
**How it works:** As the `SpeechToText` plugin streams text locally, a UI monitor actively scans for excessive filler words (e.g., "um", "uh", "gonna", "geunyang (그냥)") or an excessively fast/slow speaking pace. Warning badges (like a speedometer or a red counter) flash on screen: *"Slow down!"* or *"Avoid using 'um' repeatedly!"*
**Value:** Fixes the *delivery* of the speech, not just the content.

### Option 3: Dynamic AI Personas (Good Cop / Bad Cop)
**How it works:** In the `InterviewSetupView`, the student can select the Interviewer's Persona: *Strict Professor*, *Friendly Admissions Officer*, or *Impatient Visa Officer*. This alters the `systemPrompt` in the backend to change the AI's question difficulty and tone, AND we swap the ElevenLabs `voiceId` to match the character (e.g., a deep, strict voice for the strict professor).
**Value:** Simulates the unpredictable behavioral variations of real human interviewers.

### Option 4: Mix-Language Fallback & Correction
**How it works:** We modify the AI rules so if a student interviewing in Korean forgets a word and naturally substitutes an English native word (e.g., "저는 computer science를 전공하고 싶어요"), the AI understands it fluidly in real-time, but during the final feedback stage, it specifically targets that mixed sentence and provides the correct Korean business vocabulary.
**Value:** Encourages students to keep the interview flow going even if their vocabulary drops momentarily.

### Option 5: Granular Transcript Replay ("Tap-to-Fix")
**How it works:** At the end of the interview (`InterviewFeedbackView`), the screen displays the entire transcript timeline. The student can click on ANY of their spoken answers and hit a "How would a native speaker reply?" button. The AI instantly generates a polished, native-level rewrite of their specific answer.
**Value:** Deep, actionable feedback rather than a generic summary.

> **USER ACTION REQUIRED:** Please reply with your chosen feature numbers (e.g., "Let's do 1, 3, and 5" or "All of them").

---

## UX Design

### After (Assuming Options 1 & 2 are selected)
```text
┌─────────────────────────────────────────────────┐
│ Interview Practice             [⏲ 03:45]        │
│                                                 │
│             [!] Try to speak slower.            │
│                                                 │
│               [ AI AVATAR ]                     │
│                                                 │
│  "Why did you choose this university?"          │
│                                                 │
│       ┌───────────────────────────────┐         │
│       │ 💡 Lifeline Hints:            │         │
│       │ • Mention the curriculum      │         │
│       │ • Note a specific professor   │         │
│       └───────────────────────────────┘         │
│                                                 │
│ [Listening: "Um, I think um because..."]        │
└─────────────────────────────────────────────────┘
```

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `liberal/features/training/presentation/widgets/interview_active_view.dart` | 68-111 | Where `_startListening` and `SpeechToText` handle the active session words. Re-engineering this is essential for Live Coaching and Lifeline Hints. |
| P1 | `supabase/functions/interview-ai/index.ts` | 338-395 | The monolithic `systemPrompt`. Needs altering to support dynamic personas and mixed language tolerance. |
| P2 | `liberal/features/training/data/interview_repository.dart` | 239-281 | ElevenLabs TTS handling, requiring new `voiceId` injections for different personas. |

---

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Flutter Speech to Text | pub.dev/speech_to_text | Documentation regarding confidence scores and partial result streaming needed to accurately measure pacing locally. |

---

## Step-by-Step Framework (Pending Selection)

### Task 1: UI Pre-Requisites & Provider Upgrades
- **ACTION**: Add state variables to `InterviewSessionState` (e.g., `interviewerPersona`, `liveHints`).
- **IMPLEMENT**: Pass selected values down to edge functions.

### Task 2: Edge Function Modifications
- **ACTION**: Update `interview-ai` and `interview-feedback` endpoints.
- **IMPLEMENT**: Modify prompt blocks based on persona flags, return hints if a separate `action: get_hint` is fired.

### Task 3: Local Device Analysis (Pacing & Fillers)
- **ACTION**: Hook into the `onResult` callback of `SpeechToText`.
- **IMPLEMENT**: Parse `result.recognizedWords` every 1 second to count filler density and word-per-minute (WPM) rating. Flash UI warnings via setState if threshold exceeded.

---

## Next Steps

Waiting for user to choose the desired AI advanced interview features!
