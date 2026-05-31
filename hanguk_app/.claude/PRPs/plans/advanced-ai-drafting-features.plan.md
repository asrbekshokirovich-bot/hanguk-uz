# Plan: Advanced AI Drafting Features

## Summary
Upgrade the currently mocked AI capabilities in the `AdvancedDraftingWorkspace` to powerful, real-time AI analysis tools. This feature will monitor the student's typing process for Study Plans and Personal Statements and use actual LLM integration (via Supabase Edge Functions) to offer context-aware suggestions, semantic grammar correction, and structural supervision.

## User Story
As a university applicant drafting my Study Plan or Personal Statement,
I want very advanced, real-time AI supervision and suggestions as I type,
So that I can produce a highly professional, uniquely tailored, and native-sounding application document.

## Problem → Solution
Current state uses hardcoded string matching and fake grammar rules (`"lots of"` -> `"a significant amount of"`) → Desired state uses deep LLM integration for live ghost text prediction, semantic analysis, tone enhancement, and contextual awareness.

## Metadata
- **Complexity**: Large (Requires both Flutter UI state machine updates and Supabase Edge Function logic)
- **Source PRD**: User Audio Request
- **PRD Phase**: N/A
- **Estimated Files**: ~8-10

---

## 🚀 Proposed Advanced Features (User Selection Required)

As requested, here are highly advanced AI features that can be implemented to monitor the writing process. **Please review and let me know which ones you want me to build:**

### 1. Context-Aware Predictive Ghost Text (Tab to autocomplete)
**How it works:** When you pause typing for 1 second, the app sends the last few sentences + context (Target University, Track) to the AI. The AI streams the most logical next 5-15 words natively in the text field as grey "ghost text".
**Value:** Cures writer's block and naturally guides the student towards professional phrasing.

### 2. Live Rubric & Goal Tracker (Gamified Progress)
**How it works:** A live checklist visualizer (e.g., [ ] Academic Background, [ ] Future Goals in Korea, [ ] Motivation). As the student types, the AI continuously scans the text and automatically "checks off" rubric requirements when it detects they have been fulfilled in the essay.
**Value:** Ensures the essay meets the strict structural expectations of South Korean universities.

### 3. Highlight-to-Rewrite (Floating AI Toolbar)
**How it works:** Selecting text pops up an AI Magic Menu with options like: *Make more Academic*, *Make more Confident*, *Fix Grammar*, or *Expand*.
**Value:** Gives the student granular control over their tone without needing to rewrite entire paragraphs manually.

### 4. Plagiarism / Template-Dependency Alert
**How it works:** The AI actively monitors if the student's text is too similar (over 70% match) to the generic AI Examples provided in Step 2 of the wizard. It flashes an orange warning if they are submitting something an admissions officer might flag as AI-generated/copied.
**Value:** Guarantees originality and prevents automatic rejections.

> **USER ACTION REQUIRED:** Please reply with your chosen feature numbers (e.g., "Let's do 1 and 3" or "All of them").

---

## UX Design

### Before
```text
┌─────────────────────────────────────────────────┐
│ Workspace                                 [AI]  │
│ [Red Action Chips for generic words]            │
│ I wanna go to korea cause it is really good.    │
└─────────────────────────────────────────────────┘
```

### After (Assuming we select Options 1 & 3)
```text
┌─────────────────────────────────────────────────┐
│ Workspace                    [Target: Seoul Uni]│
│ I wish to study in Korea because of its...      │
│ [ghost text: advanced technological landscape]  │
│                                                 │
│ [Highlight text] -> [ ⭐ Make Academic ]         │
└─────────────────────────────────────────────────┘
```

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/features/training/presentation/widgets/advanced_drafting_workspace.dart` | 130-230 | Where the current mock AI (`_generateAiSuggestion`) triggers on debounce timers. |
| P1 | `lib/features/training/presentation/widgets/ai_highlighting_text_controller.dart` | All | How ghost text and grammar spans are currently rendered in the TextField. |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Supabase Edge Functions | Supabase Docs | Needed for securely calling Claude/Gemini APIs without exposing keys in Flutter. |
| Flutter Ghost Text | StackOverflow | Validating `TextSpan` architecture used in `ai_highlighting_text_controller.dart` |

---

## Patterns to Mirror

### DEBOUNCER_PATTERN
// SOURCE: `advanced_drafting_workspace.dart:88`
```dart
    _aiSuggestionTimer?.cancel();
    _aiSuggestionTimer = Timer(const Duration(milliseconds: 1000), () {
      _generateAiSuggestion(text);
    });
```
We will retain this pattern to avoid spamming the LLM API on every single keystroke.

### HIGHLIGHT_CONTROLLER
// SOURCE: `ai_highlighting_text_controller.dart`
The `TextSpan` composition used for ghost text must remain intact to ensure seamless UI rendering of predictive texts.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `advanced_drafting_workspace.dart` | UPDATE | Remove mock logic, integrate actual API call for AI features based on user selection. |
| `study_plan_repository.dart` | UPDATE | Add new API requests to Supabase Edge Functions (e.g. `generateGhostText`, `evaluateRubric`). |
| `supabase/functions/drafting-ai/index.ts` | CREATE | New edge function to securely handle the LLM prompts (Claude or Gemini) for real-time analysis. |
| *Additional files based on selected features* | CREATE | Floating menu widgets, rubric tracker widgets. |

## NOT Building

- Full document auto-generation in one click (The goal is to *supervise* and *assist* the student writing it, not write it for them instantly).
- Video calling features.

---

## Step-by-Step Tasks

*(Note: These tasks will be highly refined once the user selects the preferred features. Below is the framework for integrating Edge Functions and replacing the mock logic)*

### Task 1: Setup Supabase Edge Function (`drafting-ai`)
- **ACTION**: Create edge function to handle LLM requests.
- **IMPLEMENT**: Write Deno TS script taking `text`, `context`, `actionType` (e.g. 'ghost_text', 'grammar_check').
- **VALIDATE**: Ensure local Supabase `serve` returns expected JSON.

### Task 2: Update Repository Layer
- **ACTION**: Add `analyzeDraftStream` and `getGhostText` methods in `StudyPlanRepository`.
- **IMPLEMENT**: Use `supabase.functions.invoke`.
- **VALIDATE**: Methods return strongly typed responses without throwing exceptions.

### Task 3: Rip Out Mock Logic & Connect Workspace
- **ACTION**: Refactoring `_generateAiSuggestion` in `AdvancedDraftingWorkspace`.
- **IMPLEMENT**: Await the new repository methods and map responses to `_activeIssues` and `ghostText`.
- **GOTCHA**: Ensure we handle race conditions (if user types while the API is mid-flight, discard the old API response!).

### Task 4: UI Implementation of Chosen Features
- **ACTION**: Build the UI components for the features selected by the user from the top list.

---

## Next Steps

Waiting for user to choose the desired AI supervision features!
