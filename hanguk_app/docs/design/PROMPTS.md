# Seoul Night — Implementation Prompts (Flutter, hanguk_app)

Copy-paste these into Claude Code (or any AI coding agent) inside the hanguk_app repo.
Attach DESIGN_SPEC.md (and ideally the HTML prototype) with every prompt.

---

## PROMPT 0 — Initialization

You are implementing the "Seoul Night" redesign of hanguk_app (Flutter, Material 3, Riverpod, Supabase).
DESIGN_SPEC.md in this folder is the binding design language. Read it fully first.

Task — build the design foundation only, no screens yet:
1. In lib/design_system/, replace/extend the theme with a SeoulNight token set:
   colors (royalBlue #1A3A6C, lime #D4E94C, limeBright #E2F26A, limePressed #C7E04A, ink #0A1A34,
   glass rgba(255,255,255,0.07), glassBorder rgba(255,255,255,0.12), text opacities), radii (14/16/18/22/24),
   shadows (card, hero, limeGlow), gradients (appBackground 150deg 4-stop, heroCard 140deg, limeButton 145deg),
   durations + curves (0.3s, Curves.easeOutBack-like for dial, easeOut for fades).
2. Fonts: Inter (400–900), Noto Sans KR (500/700/900), JetBrains Mono (600) via google_fonts or bundled assets.
   TextTheme per spec §1 Type.
3. Core widgets in lib/design_system/widgets/:
   - SeoulNightScaffold: gradient background + the two ambient glow blobs, behind a SafeArea child.
   - GlassCard(radius, padding, onTap): glass fill, hairline border, shadow, BackdropFilter blur 12.
   - HeroCard: hero gradient, inset highlight, optional lime glow blob + hangul watermark param.
   - LimeButton / OutlineButton: per spec, press scale 0.97, min height 52.
   - HangulTag(en, ko): EN title + small lime Noto Sans KR label row.
   - StatusChip(label, tone): lime/warning/info/neutral pill.
   - GlowProgressBar and ConicProgressRing(percent, label).
4. A debug gallery screen (behind a dev flag) rendering every token + widget for visual QA.
Do NOT touch feature screens yet. Keep all existing routes working. When done, list every file you created/changed.

---

## PROMPT R — Roadmap (paste after PROMPT 0 is merged)

Using the SeoulNight design system already in lib/design_system/, migrate the app screen-by-screen.
Work strictly in this order — one phase per PR, each phase must build, pass analysis, and keep old flows working:

Phase 1 — Navigation shell. Remove the bottom NavigationBar. Add HanOrb: 62px lime-gradient FAB
(bottom-right, 한 glyph, 2.6s pulse) that opens a speed-dial overlay (blur+dim scrim, 5 staggered items:
Home 홈, Applications 지원, Map 지도, Documents 서류, AI Interview 면접; active item lime).
Selecting an item switches the shell's IndexedStack. Non-home sections get a header: glass back-circle → Home,
title + small hangul label. Orb overlays every section.

Phase 2 — Welcome + Magic Code login restyle (spec §3.1–3.2). Keep existing auth logic/validation untouched;
swap only presentation. Input: JetBrains Mono, 0.3em tracking, lime border+glow when valid.

Phase 3 — Home dashboard (spec §3.3): greeting header with 좋은 저녁, hero Journey card with ConicProgressRing
+ Continue Journey → Applications, next-step to-do GlassCard (할 일 chip) → Documents, 2 application previews → Applications.
Wire to real Riverpod providers (journey step, next task, applications).

Phase 4 — Applications (spec §3.4): journey segment bar + application GlassCards (hangul glyph tile,
status chip mapping: Submitted=lime, In Review=warning, Docs=info; GlowProgressBar).

Phase 5 — University Map (spec §3.5): keep Kakao/OSM map logic; restyle to dark card with glow pins
(selected lime + pulse), 대한민국 chip, selectable list rows (selected = lime-tinted glass + 선택).

Phase 6 — Documents (spec §3.6): hero collected card (ConicProgressRing 3/6 style from real data),
doc rows with hangul glyph tiles, 완료/대기/잠김 status words, locked rows 45% opacity.

Phase 7 — AI Interview + Hanguk AI (spec §3.7): header card with lime 한 avatar + Live chip,
chat bubbles (glass AI / lime student), lime mic circle wired to the existing Vapi/ElevenLabs flow.

Phase 8 — Guest Explorer (spec §3b): public mode, no auth. Welcome gains "Explore Universities" glass button.
GuestShell with its own orb dial (Explore 탐색, Map 지도, Compare 비교, Join Hanguk 가입) and header
(exit tile, "Guest Explorer · 탐색 모드", lime Join pill → Magic Code). Screens: Explore (search + city/faculty
chip filters over the university catalog from Supabase, open/closed chips, compare toggle max 2),
Guest Map (all-universities pins: open bright / closed dim / selected lime+pulse, synced list),
Compare (2-col spec cards: city, rank, tuition, TOPIK, deadline, status; empty dashed slot; "Apply with Hanguk" CTA).
Guest mode is read-only; all CTAs deep-link to Magic Code login.

Phase 9 — Sweep: delete dead glassmorphism-era styles, hide scrollbars, verify 44px hit targets,
OLED check (gradient bottoms near-black), motion timings per spec §1, and a final pass that no screen
still shows a tab bar. Verify guest mode never exposes student data or authed routes.

After each phase: screenshot the affected screens and compare against the HTML prototype before moving on.

---

## Per-screen fix prompt (template)

On [screen], compare against DESIGN_SPEC.md §[n] and the prototype. Fix only: [issues].
Do not restyle other screens; do not change business logic.
