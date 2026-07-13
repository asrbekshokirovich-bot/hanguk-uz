# Kickoff prompt — paste this into Claude Code (run from the hanguk-uz repo root)

---

Implement the redesigned **Uni DB Review** page from the design-handoff bundle at `<PATH-TO-UNZIPPED-FOLDER>/design_handoff_uni_db_review/` (adjust the path to wherever you unzipped it).

## Read first
1. `design_handoff_uni_db_review/README.md` — complete spec (layout, states, tokens, copy). Treat it as the source of truth.
2. Open `design_handoff_uni_db_review/Uni-DB-Review-Preview.html` in a browser to see the interactive prototype; `reference/Uni DB Review Redesign.dc.html` has exact style values and Uzbek copy.
3. The current implementation you are replacing: `src/components/crm/pages/UniDbReviewContent.tsx`, `ReviewApprovalQueue.tsx`, `ReviewParsedOutput.tsx`, `CrawlTargetPanel.tsx`, plus `src/hooks/useReviewQueue.ts`, `src/components/crm/pages/reviewLogic.ts`, `reliability.ts`.

## Ground rules
- This is a **UI restructure only**. Do NOT change Supabase RPCs, hooks, react-query keys, or `reviewLogic.ts` semantics (`itemConfidence`, `classifyTrack`, `mapCalendarEvents`, `parseReliability`, `groupRows` grouping by `guideline_document_id`). Reuse them.
- Rebuild the page as: left triage rail (guidelines sorted red→amber→green→done) + right detail panel (header card with progress + one card per section showing ONLY the decision-critical fields per the README; missing values muted "Ko'rsatilmagan", never dropped).
- Replace the raw reliability `<details><pre>` dump with a one-line tinted note strip; replace reject dialogs with the inline reason strip; keep `fn_flag_source_wrong` as the "Manba noto'g'ri" link inside the reject strip.
- Use existing shadcn/ui components (Card, Badge, Button, Select, Tabs, ScrollArea, Input, Tooltip) and lucide-react icons; style with the existing Tailwind tokens — no new hex values, no new CSS files, no new dependencies.
- All user-facing strings via i18n: add keys to `src/locales/uz.json` first (Uzbek copy from the prototype is final), then mirror in `en.json`, `ru.json`, `ko.json`.
- Keep access control (`useCanReviewUniDb`), loading/error/empty states, 60s refetch, and the crawl-target admin gating exactly as they are.
- Split into sensible components (e.g. `ReviewTriageRail.tsx`, `ReviewGuidelineDetail.tsx`, `ReviewSectionCard.tsx`, per-field-group body components) under `src/components/crm/pages/uni-db-review/` if that matches repo conventions.

## Verify
- `npx tsc --noEmit` and `npm run build` pass clean; `npm run lint` if configured.
- Manually check: tab switching, rail selection + sorting, approve/reject/flag-source flows (optimistic UI + toasts), heritage-track toggle, empty queue state, all four locales render, dark mode (`.dark`) still looks correct.

## Commit & ship — do this properly
1. Start from up-to-date main: `git fetch origin && git switch -c feat/uni-db-review-redesign origin/main`.
2. Copy the handoff bundle into the repo at `design_handoff/uni_db_review/` (including README, preview HTML, reference/) so the design reference lives with the code, and commit it FIRST as its own commit:
   - `docs(uni-db-review): add design handoff bundle for review-page redesign`
3. Implement in small, logical commits (Conventional Commits), each building green — suggested sequence:
   - `feat(i18n): add uni-db-review redesign strings (uz/en/ru/ko)`
   - `feat(uni-db-review): triage rail + guideline detail layout`
   - `feat(uni-db-review): section cards with field-group bodies (calendar/requirements/tuition/documents/scholarships)`
   - `feat(uni-db-review): inline reject flow, reliability note strip, decided-state strips`
   - `refactor(uni-db-review): restyle crawl-target panel + needs-attention tab`
4. Before each commit: `git status` and `git add` the specific files (never `git add .` blindly); confirm nothing unrelated (lockfiles, .env, build output) is staged; run typecheck/build.
5. Push and open a PR: `git push -u origin feat/uni-db-review-redesign`, then `gh pr create --fill --base main` with a summary linking to `design_handoff/uni_db_review/README.md` and before/after notes. Do not merge — leave it for review on the Vercel preview.

---
