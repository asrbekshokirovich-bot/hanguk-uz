# Seoul Night — Hanguk Student App Design Language

Premium dark redesign of the Hanguk student app (hanguk_app, Flutter).
Keeps brand colors (Royal Blue #1A3A6C + Vibrant Lime #D4E94C), removes the bottom tab bar,
adds depth (layered glow), and a subtle Korean voice (small hangul accents).

Reference prototype: `Hanguk Seoul Night App v2.dc.html` (interactive, includes Guest Explorer) · v1: `Hanguk Seoul Night App.dc.html` · vibe sample: `Seoul Night Vibe.dc.html`.

---

## 1. Foundations

### Background (every screen)
- Diagonal gradient, 150deg: `#1A3A6C 0% → #132A4D 38% → #0F213D 66% → #0A0A1A 100%`
- Ambient glow blobs (pure decoration, pointer-events none):
  - top-left: 380px radial, `rgba(64,110,190,0.5) → transparent 70%`
  - bottom-right: 360px radial, `rgba(212,233,76,0.14) → transparent 70%`

### Color tokens
| Token | Value | Use |
|---|---|---|
| royalBlue | #1A3A6C | brand, gradients |
| lime | #D4E94C | THE action color, active states, glow |
| limeBright | #E2F26A | lime gradient top stop |
| limePressed | #C7E04A | lime gradient bottom stop |
| ink | #0A1A34 | text on lime |
| glass | rgba(255,255,255,0.07) | card fill |
| glassBorder | rgba(255,255,255,0.12) | card hairline |
| heroGrad | 140deg #2A4E8C → #1A3A6C 55–60% → #142E56 | hero cards |
| textPrimary | #FFFFFF | |
| textSecondary | rgba(255,255,255,0.5–0.55) | |
| textFaint | rgba(255,255,255,0.35–0.45) | |
| warning | #F59E0B (chip text #FFC966 on rgba(245,158,11,0.16)) | In Review |
| info | #7CA3D9 (chip text #9FC0EA on rgba(124,163,217,0.18)) | Docs stage |

### Surfaces
- **Glass card**: fill `glass`, 1px `glassBorder`, radius 18–24, shadow `0 12px 28px rgba(0,0,0,0.3)`, backdrop blur 12.
- **Hero card**: `heroGrad` fill, 1px `rgba(255,255,255,0.16)`, radius 22–24, shadow `0 24px 48px rgba(0,0,0,0.45)` + inset top highlight `rgba(255,255,255,0.2)`; a lime radial glow blob top-right; optional hangul watermark (한국) at `rgba(255,255,255,0.05)`, 96px, weight 900.
- **Lime primary button**: gradient 145deg `#E2F26A → #C7E04A`, ink text w700, radius 14–16, glow shadow `0 14px 32px rgba(212,233,76,0.28)`, press scale 0.97–0.98.
- **Outline button**: transparent, 1px `rgba(255,255,255,0.25)`, white/70 text.

### Type
- **Inter** 400–900 everywhere (tight -0.02em on display). Headline 32–40 w800, section title 16–23 w800, body 14–15, caption 11–12.
- **Noto Sans KR** w500–900 for hangul accents only.
- **JetBrains Mono** w600, letter-spacing 0.3em for Magic Code.

### Korean voice (subtle — accents, never walls of hangul)
- Small lime hangul label next to EN titles: Applications · 지원 현황, Map · 대학 지도, Docs · 서류 목록, Interview · 면접 연습.
- Status words: 완료 done · 대기 pending · 잠김 locked · 선택 selected · 할 일 to-do.
- Glyph avatars: first hangul syllable of a university in a glass tile (서 / 연 / 고).
- Brand 한 mark: welcome tile, AI avatar, nav orb. Watermark 한국 on hero card.

### Motion
- 0.3s, `cubic-bezier(0.2, 0.9, 0.3, 1.2)` for nav/dial; 0.3s ease-out for fades; 40ms stagger on dial items; slow 2.6s glow pulse on orb; no bounce elsewhere.

---

## 2. Navigation — the 한 Orb (replaces the bottom tab bar)
- 62px lime-gradient circle, bottom-right (right 22, bottom 34), 한 glyph (Noto Sans KR 900, ink), continuous soft lime pulse ring.
- Tap → orb glyph crossfades to ✕ and rotates 90°; screen dims under `rgba(4,8,18,0.6)` + blur 10 scrim.
- Speed-dial fans upward with stagger: 5 items (Home 홈 · Applications 지원 · Map 지도 · Documents 서류 · AI Interview 면접).
- Item = white label pill (glass) + 52px rounded-square (18r) hangul tile; active section tile is lime with ink glyph.
- Tap scrim or ✕ to close. Sections get a glass back-circle (←) to Home in the header.

## 3. Screens (as prototyped)
1. **Welcome** — centered 한 tile (navy gradient, lime halo ring), "Welcome to Your Journey", faint 한국으로 가는 길, lime CTA "I Have a Magic Code" + outline "Learn More".
2. **Magic Code** — key icon in lime glass tile, mono input (lime border + glow when 8 chars valid), "Use demo code", "Login to System" enables with glow.
3. **Home** — greeting header (좋은 저녁 · Good evening), hero Journey card (Step 4 of 7, 57% conic progress ring, Continue Journey), next-step to-do card (할 일 chip), 2 application preview cards.
4. **Applications** — journey segment bar (lime done + glow, current at 35% lime), full application cards: glyph tile, name, city, status chip, progress bar (lime gradient + glow).
5. **University Map** — dark map card (navy landmass #16305A on #0C1830), glow pins (lime selected + pulse), 대한민국 · 38 universities chip, selectable uni list (selected = lime-tinted glass + 선택).
6. **Documents** — hero collected card (3/6 conic ring), doc rows with hangul glyph tiles (lime when done), status words 완료/대기/잠김, locked at 45% opacity.
7. **AI Interview** — Hanguk AI header card (lime 한 avatar, Live chip), chat (glass = AI, lime = student), input + lime mic circle.

### 3b. Guest Explorer mode (external, non-contract students)
Entry: Welcome screen secondary button "Explore Universities" (glass, 탐색 chip) — no code needed.
Guest header: 한 tile (tap = exit to Welcome), "Guest Explorer · 탐색 모드" eyebrow, section title + hangul label, lime "Join Hanguk 가입" pill (→ Magic Code).
Guest orb dial (4 items): Explore 탐색 · Map 지도 · Compare 비교 · Join Hanguk 가입 (lime tile).

8. **Explore (guest home)** — display headline "Find Your University" + 나의 대학 찾기, count line ("38 universities · 24 open for Spring 2027"), glass search field, two chip filter rows (도시 city: All/Seoul/Daejeon/Busan; 학부 faculty: All/Engineering/CS/Business/Medicine/Arts — active chip lime w/ ink text), result count + "Compare n/2 · 비교 →" link. University result cards: hangul glyph tile, name, meta (city · rank · tuition), Open 모집 중 (lime chip) / Closed 마감 (neutral chip), faculty tag line, Compare toggle pill (+ → lime ✓ when selected, max 2, oldest evicted).
9. **Guest Map** — same dark Korea map card but ALL 38 pins visible: open unis = brighter blue pins, closed = dim, selected = lime + pulse; "All 38 universities" + "Open now" legend chips. Full scrollable list below: status dot (lime glow = open), name, city · rank, 모집 중/마감 status word. Pins and rows are selectable and synced.
10. **Compare** — 2-column grid of glass cards: glyph + name + remove ✕, then keyed rows (City 도시, Rank 순위, Tuition 등록금, TOPIK, Deadline 마감일, Status 상태 — status value lime when open). Empty slot = dashed border card "+ Add from Explore 탐색에서 추가". Below: lime CTA "Apply with Hanguk 가입" + one-line reassurance caption.

Guest rules: read-only catalog — no journey, docs, or interview; every conversion moment (header pill, dial item, compare CTA) routes to Magic Code login. Filters combine (AND). Search matches name or city.

## 4. Rules
- No bottom tab bar, ever. Orb is the only global nav.
- Lime is rare: one primary action per screen + active/selected states + glows. Never body text on lime except ink.
- Depth comes from gradient + glow + layered glass; no pure-black flat panels.
- Min hit target 44×44. Hide scrollbars. OLED-friendly (gradient bottoms out near black).
