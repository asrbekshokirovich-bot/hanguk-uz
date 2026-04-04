# Plan: CRM University Pipeline Harmonization

## Summary
The CRM currently mixes two concepts: "University Suggestions" and "Applications", causing confusion for staff and leading to out-of-sync lists between the CRM and the Student Mobile App. This plan resolves the confusion by restructuring the CRM to strictly separate and visualize both systems identically to the mobile app, and removing the ambiguous "Add Application" shortcut.

## User Story
As a CRM Staff Member, I want to see exactement what the student sees in their "Suggested Universities" feed, so that I can remove accidental suggestions (like Gwangju) and ensure the student application pipeline is clear, linear, and 1-to-1 sync'ed.

## Problem → Solution
[Confusing Mixed UI with hidden suggestions] → [Strict separation: "Suggested Universities" (with Delete) and "Active Applications" flowing linearly]

## Metadata
- **Complexity**: Medium
- **Source PRD**: User Audio Transcript
- **Estimated Files**: 2

---

## UX Design

### Before
```
┌──────────────────────────────────────────────┐
│  TAB: Applications                           │
│  [Suggest University]  [Add Application]     │
│                                              │
│  (List of Active Applications ONLY)          │
│  - Seoul National (Status: Processing)       │
│                                              │
│  *Note: Suggested universities (like Gwangju)│
│   are completely invisible on this page!     │
└──────────────────────────────────────────────┘
```

### After
```
┌──────────────────────────────────────────────┐
│  TAB: Universities                           │
│  [Suggest University]                        │
│                                              │
│  SECTION: Suggested For Student (Pending)    │
│  - Gwangju University [REMOVE BUTTON]        │
│  - Inha University    [REMOVE BUTTON]        │
│                                              │
│  SECTION: Active Applications (In Progress)  │
│  - Seoul National (Status: Processing)       │
└──────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Add Application Button | Staff could bypass suggestions | Removed | Staff must suggest; student accepts (or it's all unified). |
| Viewing Suggestions | Hidden inside the Suggest Dialog | Explicitly listed | Staff sees EXACTLY what student sees, preventing hallucination fears. |
| Removing Suggestions | Impossible without DB access | "Remove" button | 1-click removal of old/mistaken suggestions. |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/components/crm/StudentDetail.tsx` | 1060-1150 | Contains the current 'Applications' tab layout that will be overhauled. |
| P1 | `src/components/crm/AddApplicationDialog.tsx` | all | Will likely be deprecated/removed to eliminate pipeline confusion. |

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/components/crm/StudentDetail.tsx` | UPDATE | Overhaul the Applications tab UI, add `suggestedUniversities` fetching and rendering, remove `AddApplicationDialog`. |
| `src/components/crm/AddApplicationDialog.tsx` | DELETE | Remove the direct application creation feature to enforce the Suggest -> Apply pipeline. |

## Step-by-Step Tasks

### Task 1: Fetch and State Management for Suggestions
- **ACTION**: Modify data fetching in `StudentDetail.tsx`.
- **IMPLEMENT**: Expand `fetchSuggestions` to pull `university:universities(id, name_en, name_uz)` and store in a new state `suggestedUniversitiesList`.

### Task 2: UI Overhaul of the Tab
- **ACTION**: Rename and restructure the "Applications" tab contents in `StudentDetail.tsx`.
- **IMPLEMENT**: Create two sections: "Suggested Universities" (mapping over `suggestedUniversitiesList` with a Remove button) and "Active Applications". 

### Task 3: Remove Confusing Direct "Add Application" Flow
- **ACTION**: Strip the `Add Application` button.
- **IMPLEMENT**: Remove the `AddApplicationDialog` and its trigger button from `StudentDetail.tsx` to ensure staff don't confuse the two systems.

---

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Staff might need to push an application manually without student app input | Medium | High | Discuss with stakeholder: If staff physically need to add applications, we can keep the Add Application button but keep the lists visually separated. |

## Notes
This perfectly addresses the "hallucination/mistaken system" request. The DB isn't hallucinating; the CRM was just blind to the `student_suggestions` table. By making it explicit, staff can immediately click 'Remove' on Gwangju and restore perfect sync!
