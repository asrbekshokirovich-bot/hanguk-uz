# Handoff: Uni DB Review — Redesign (hanguk-uz CRM)

**Target codebase:** `hanguk-uz` (Vite + React + TypeScript, shadcn/ui, Tailwind, Supabase, react-query)
**Target page:** `/crm/admin/uni-db-review` — `src/components/crm/pages/UniDbReviewContent.tsx` and its children.

## Overview

Redesign of the university-data review page. Today the "Awaiting approval" queue renders every extracted field in a flat grid (many italic "Not specified" rows, raw reliability JSON, Korean-heritage tracks inline), so reviewers can't quickly separate what matters. The redesign:

1. Splits the queue into a **left triage rail** (one item per university/guideline, sorted red → amber → green → done) and a **right detail panel** (the selected university's sections).
2. Shows **only decision-critical information prominently** per section — deadlines & application fee, TOPIK/IELTS/GPA/interview as stat tiles, per-faculty tuition table, document checklist with apostille/deadline chips, scholarship tiers.
3. Keeps missing/secondary fields visible but **visually muted** ("Ko'rsatilmagan", italic, `--ink-3`-grade color).
4. Collapses each section to a slim green/red result strip after Approve/Reject (with Undo), and tracks per-university progress.
5. UI language: **Uzbek** (add strings to the locale files; do not hardcode).

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly**. The task is to **recreate this design inside the existing hanguk-uz environment** (React + TS + shadcn/ui + Tailwind + react-query + Supabase RPCs), reusing its established components (`Card`, `Badge`, `Button`, `Select`, `Tabs`, `ScrollArea`, `Input`, lucide-react icons) and its Tailwind token classes. Keep all existing data plumbing (`useReviewQueue`, `useReviewActions`, `useNeedsAttention`, `fn_review_accept` / `fn_review_reject` / `fn_flag_source_wrong`, `CrawlTargetPanel` logic) — this is a **UI restructure, not a backend change**.

- `Uni-DB-Review-Preview.html` — **self-contained interactive prototype**; open in any browser. This is the source of truth for look & behavior.
- `reference/Uni DB Review Redesign.dc.html` — prototype source (template + logic + demo data), useful for reading exact style values and copy.
- `reference/tokens/*.css` — the Hanguk design tokens the prototype uses. Map them to the codebase's existing Tailwind/shadcn tokens (see Design Tokens).

## Fidelity

**High-fidelity.** Colors, spacing, typography, states and copy in the prototype are intentional. Recreate faithfully, but *express values through the codebase's existing Tailwind/shadcn tokens and components* rather than hardcoding hex values.

## Page Structure (top to bottom)

Container: max-width 1240px, centered, padding `26px 28px 64px`, vertical gap 16px, on the CRM's canvas background.

1. **Page header** — title "Universitet bazasi — tekshiruv" (23px/700, -0.02em) + one-line helper (13px, muted): "Avto-yig'ilgan qabul yo'riqnomalari talabalarga chiqishidan oldin shu yerda tasdiqlanadi. Hech narsa sizning ruxsatingizsiz e'lon qilinmaydi." Right: outline **Yangilash** button (RefreshCw icon; icon spins while refetching).
2. **Crawl-target bar** (keep existing `CrawlTargetPanel` behavior, restyle): white card, 38px calendar icon tile (soft blue bg `tint-blue`, info color), label "Avto-skaner mavsumi" + current-target pill (e.g. "Bahor 2027 · 2027학년도 1학기"), helper text 12.5px muted; right side: the existing intake `Select` (admins only; non-admins keep the "faqat egalar o'zgartira oladi" note).
3. **Tabs** — pill segmented control (bg `surface-3`, radius 999, active = white + shadow): "Tasdiqlash navbati" with solid primary count badge; "E'tibor kerak" with warning count badge. These map to the existing `approval` / `flags` tabs.
4. **Tab 1: Approval queue** — grid `318px minmax(0,1fr)`, gap 16px (rail sticky top 16px).
5. **Tab 2: Needs attention** — max-width 880px; warning note banner + one card per institution (read-only), replacing the current `NeedsAttentionView` list styling.

## Screens / Views

### A. Triage rail (left, 318px)

- Header row: overline "NAVBAT — {n} UNIVERSITET" (11px/600, +0.06em, uppercase, muted) and three dot+count pairs (red/amber/green pending counts).
- One card per **guideline group** (existing `groupRows()` by `guideline_document_id`): white, 1px border, radius 14px, padding `12px 14px`, gap 6px, cursor pointer.
  - Row 1: institution name (13.5px/600, ellipsis) + 8px status dot (worst reliability color among *open* sections; hidden when done, replaced by a green check icon).
  - Row 2: Korean name · city (12px, tertiary).
  - Row 3: status chip ("Tuzatish kerak" / "Tekshiring" / "Tayyor" in the matching bg/fg pair, 11px/600, pill) + "{k} bo'lim · min. ishonch {p}%" (11.5px, tertiary). When all sections decided: single green "Yakunlandi" chip.
  - Selected: border `blue-400` + 3px focus-ring shadow. Hover: border `blue-400`.
- Sort: red(0) → amber(1) → green(2) → done(last); stable within a color (keep the view's priority/created_at order).

### B. Detail panel (right)

**University header card** — white card, padding 18px:
- Name (18px/700) + intake pill ("Bahor 2027 · 2027학년도", blue tint); below: Korean name · city (13px muted).
- Right: ghost "Manba sahifa" (ExternalLink icon → `source_url_ko`) and outline "PDF ochish" (FileText icon → existing `openPdf()` signed-URL flow).
- Progress row: 6px rounded track (`line-2`) with fill (`blue-500`; `success` when complete) + "{decided}/{total} hal qilindi" (12px/600).
- When all sections decided: green banner "Bu universitet bo'yicha barcha bo'limlar hal qilindi." + primary "Keyingisi →" (selects next pending university).

**Section cards** — one per queue row (`field_group`), white card, padding `16px 18px`, gap 12px:

*Header row:* 30px icon tile (`surface-3` bg; lucide: Calendar, GraduationCap, a currency icon, FileText, Award) + section title (14.5px/600) + reliability pill with dot ("Tuzatish kerak" danger / "Diqqat bilan tekshiring" warning / "Tekshiruvlar o'tdi" success) + "ishonch {p}%" (11px mono, tertiary; from existing `itemConfidence`) + spacer + actions when undecided: primary **Tasdiqlash** (check icon, 32px, tooltip "Tasdiqlash va talabalarga e'lon qilish") and outline **Rad etish** (hover turns danger-soft).

*Reliability note strip* (red/amber only, undecided only): tinted strip (danger-bg or warning-bg), AlertTriangle icon, one-line human reason (12.5px/500). This replaces the current `<details><pre>` JSON dump — derive the line from `parseReliability().detail` (first meaningful line, not the raw block).

*Reject flow (inline, replaces per-card dialogs):* danger-bg strip with "Rad etish sababi:" + `Select` of the existing `REVIEW_REJECTION_REASONS` (Uzbek labels: "Noto'g'ri yil / mavsum", "Noto'g'ri hujjat turi", "Xato / to'qilgan ma'lumot", "OCR matni buzilgan", "Manba ochilmadi", "Boshqa") + danger "Rad etishni tasdiqlash" + X cancel; below, a small ghost link "Manba noto'g'ri — bu PDFdagi barcha bo'limlarni rad etish" → `fn_flag_source_wrong`.

*Decided states:* body collapses; slim strip remains — success-bg "Tasdiqlandi — talabalarga e'lon qilindi" or danger-bg "Rad etildi — {sabab}", each with a ghost "Bekor qilish" (in production, Undo can simply refetch/queue-invalidate if a true undo RPC doesn't exist — then omit Undo and keep the strip until refetch).

*Bodies per `field_group`* (only these fields, in this order; anything absent renders muted italic "Ko'rsatilmagan"):

- **calendar → "Muddatlar va ariza to'lovi":** 2-col auto-fit grid of label/value rows (label 13px `ink-2`; value mono 12.5px; deadlines `apply_close` + `documents_deadline` bold 700; tentative dates suffixed "(taxminiy)"). Below: inset row (bg `surface-2`, radius 10) "Ariza to'lovi (전형료)" + amount mono 700. Dates format `DD.MM.YYYY · HH:mm KST`.
- **requirements → "Kirish talablari":** per foreign track: overline category ("XORIJIY FUQAROLAR (외국인전형) — BAKALAVR"), then stat tiles grid `repeat(auto-fill,minmax(140px,1fr))` — TOPIK / IELTS·ingliz / GPA / Suhbat (+ Amaliy imtihon when present): tile bg `surface-2`, radius 10, label 10.5px uppercase muted, value 15px/700 ("Talab qilinmaydi" renders as a normal definite value; `not_stated` renders muted). Then "Yo'nalishlar: …" line and eligibility prose in an inset box (12.5px, `ink-2`). **Korean-heritage tracks** (existing `classifyTrack`) collapse behind a chevron toggle "Ko'rsatish: {n} ta koreys-diaspora yo'nalishi (xorijliklarga tegishli emas)" → dashed-border muted rows.
- **tuition → "Fakultetlar va kontrakt":** bordered table, header row (bg `surface-2`, 10.5px uppercase muted): Fakultet | Kontrakt / semestr | Kirish to'lovi. Money right-aligned mono 600, formatted `4 779 000 KRW` (space thousands). A consensus-flagged row gets an AlertTriangle next to the faculty name and warning-colored amount.
- **documents_required → "Kerakli hujjatlar":** checklist rows (divided by `line-2`): name 13px/600 (optional docs muted) + optional helper note 11.5px; chips right: "Majburiy" (blue tint) / "Ixtiyoriy" (neutral), "Apostil" (lime tint) when `is_apostille_required`, deadline mono 12px (or muted "muddat: ko'rsatilmagan").
- **scholarships → "Stipendiyalar":** rows: name 13.5px/600 + award pill (success tint, e.g. "Kontraktgacha 70% chegirma"); tier chips (mono, bordered, `TOPIK 4 → 50% chegirma`) built from `topik_tier_table` / `ielts_tier_table`; optional note 12px muted.

### C. "E'tibor kerak" tab (auto-published flags)

- Warning banner: AlertTriangle + "Bu yozuvlar avto-e'lon qilingan, lekin skaner ishonchi past bo'lgani uchun belgilangan. Ular allaqachon talabalarga ko'rinadi — faqat ko'zdan kechirish uchun."
- One card per institution (existing `groupByInstitution`): name + Korean name + "{n} ta bayroq" warning pill; rows: AlertTriangle, section label 13px/600, reason 12.5px `ink-2`, date mono 11.5px right. Keep the existing search `Input` + refresh if desired (filter by institution/section/reason).

## Interactions & Behavior

- Rail click → selects guideline; detail re-renders. Keep selection in component state; re-sort of the rail on decisions is fine.
- Approve → `useReviewActions().accept.mutate`; on success: toast "Tasdiqlandi — {Uni}: {bo'lim}" (sonner), card collapses to success strip, progress/rail counts update via query invalidation.
- Reject → inline reason strip → `reject.mutate({reason})`; toast "Rad etildi — …".
- Flag source → `flagSourceWrong.mutate`; toast "{n} ta bo'lim rad etildi — manba xato deb belgilandi".
- Pending mutation: disable that card's buttons + Loader2 spinner (existing `acting` pattern).
- Refresh button → `refetch()`, icon `animate-spin` while `isRefetching`.
- Crawl select → existing default-intake update + toast.
- Transitions: result strips/banners fade-slide in ~250ms ease-out (matches CRM `fadeIn`/`slideUp`); progress fill `width .3s ease`. No bounce.
- Loading/error/empty states: keep the existing three (Loader2 center; error + Retry; "Nothing awaiting approval" card) — restyle copy to Uzbek.
- Access control unchanged (`useCanReviewUniDb` forbidden card).

## State Management

Local UI state only: `selectedGuidelineKey` (default: first after sort), `rejectingRowId: string | null`, `rejectReason` (default `hallucinated_field`), `heritageOpen: Record<rowId, boolean>`. Server state stays in react-query exactly as today.

## Design Tokens (map to existing Tailwind/shadcn tokens in `src/index.css`)

- Primary royal blue `#1A3A6C` (`bg-primary text-primary-foreground`); progress/info blue `#2E5FA8`; blue tint chip `#EEF3FB` / `#2E5FA8`.
- Text: ink `#0C1B33`, secondary `#43526B` (`text-muted-foreground`-grade), tertiary `#74829A`; hairlines `#E5EAF1` / `#EEF1F6`; inset surfaces `#FBFCFE` / `#F0F3F8`; canvas `#F6F8FB`.
- Semantic pairs: success `#15A05A`/`#E5F6EC`, warning `#E08600`/`#FCF1DC`, danger `#E0463C`/`#FCE9E7`, lime chip `#F2F7D6`/`#A8C014`.
- Radii: cards 14px, inner boxes/strips 10px, buttons 8–10px, chips 999px. Shadows: existing card shadow (`0 1px 2px rgba(12,27,51,.05)`); focus ring `rgba(46,95,168,.35)` 3px.
- Type: Inter; mono (JetBrains Mono stack) for dates, money, confidence %. Sizes as listed per element above.
- Full token sheets in `reference/tokens/`.

## Assets

No new images. Icons: existing **lucide-react** — RefreshCw, CalendarClock/Calendar, GraduationCap, FileText, ExternalLink, AlertTriangle, CheckCircle2/Check, X, Flag, ChevronDown, Award, Loader2, ShieldAlert. Currency icon: any lucide money glyph consistent with the CRM (e.g. `Banknote`).

## i18n

All new strings go to `src/locales/uz.json` (+ mirror keys in `en/ru/ko`). The prototype's Uzbek copy is final for `uz`; translate equivalents for the other locales. Section labels: calendar "Muddatlar va ariza to'lovi", requirements "Kirish talablari", tuition "Fakultetlar va kontrakt", documents_required "Kerakli hujjatlar", scholarships "Stipendiyalar".

## Files

- `Uni-DB-Review-Preview.html` — open in browser; interactive reference (demo data: Kyung Hee red tuition-consensus case, Sogang amber GPA case, Chung-Ang/Hanyang green).
- `reference/Uni DB Review Redesign.dc.html` — prototype source with exact inline style values and all Uzbek copy.
- `reference/tokens/colors_and_type.css`, `reference/tokens/theme.css` — Hanguk token sheets.
- `KICKOFF_PROMPT.md` — paste into Claude Code to start implementation.
