# Hanguk Consulting — Design System

> Brand & UI system for **Hanguk Consulting** (hanguk.uz) — a platform that helps
> students in Uzbekistan apply to **South Korean universities**. "Hanguk" (한국)
> means *Korea*. The Korean syllable mark **핫 / 한** sits above the **Hanguk** wordmark.

This folder is a self-contained design system: brand foundations (color, type, spacing),
real visual assets (logos, app icons, screenshots), and high-fidelity **UI kits** that
recreate the two shipping products. Use it to design on-brand interfaces, mockups, slides,
or production code for Hanguk.

---

## 1. Product context

Hanguk Consulting is a **study-abroad agency + software platform**. It guides a student
from first inquiry through to enrolment at a Korean university: lead intake, document
collection, translation & apostille, application submission, interviews, visa, flights &
housing. The platform spans **two products that share one brand**:

| Product | Repo | Stack | Audience | Theme |
|---|---|---|---|---|
| **Student mobile app** | `hanguk_app` | Flutter (Material 3 + Cupertino), Riverpod, Supabase | Students (consumers) | **Dark / OLED**, glassmorphism, navy→black gradient |
| **Admin / CRM web** | `hanguk-uz` | Vite + React + TypeScript, shadcn/ui, Tailwind, Supabase | Staff: owners, consultants, call ops, university staff | **Light** default (+ OLED dark), white surfaces |

**Roles** in the system: Owner, Staff/Consultant, Call Operator, Document Handler,
University Staff, and Student. The admin app (`hanguk-uz`) also embeds the public landing,
student portal, university-staff portal, and the full CRM (`/crm/*`).

**Signature features:** Magic-Code student login, Application Tracker, University Map
(Korean universities with Kakao Map), AI Interview Practice (voice avatar via Vapi +
ElevenLabs), Study-Plan Trainer, Hanguk AI assistant, Leads intelligence, Finance module.

**Languages:** Uzbek (primary, `lang="uz"`), English, Russian, Korean. Pricing shown in
both **UZS** (Uzbek som) and **USD** (plans: Standard 5M UZS, Premium 10M UZS, No-Risk $5,000).

### Sources (the reader may not have access — recorded for provenance)
- **Logo:** user-supplied transparent PNG (navy mark + wordmark) → `assets/logo-hanguk-navy.png`
- **Live site:** https://hanguk.uz
- **Admin/CRM repo:** https://github.com/asrbekshokirovich-bot/hanguk-uz (`main`)
  - Tokens: `src/index.css`, `tailwind.config.ts` · Landing: `src/pages/Index.tsx` ·
    Auth: `src/pages/Auth.tsx` · CRM shell: `src/components/crm/CRMSidebar.tsx`,
    `CRMDashboard.tsx` · Copy: `src/locales/{en,uz,ru,ko}.json`
- **Flutter app repo:** https://github.com/asrbekshokirovich-bot/hanguk_app (`main`)
  - Theme: `lib/design_system/theme/app_colors.dart`, `app_theme.dart` ·
    Screens: `lib/features/**/presentation/*` · Store screenshots: `public/screenshots/*`

---

## 2. CONTENT FUNDAMENTALS

**Voice:** professional, warm, and *encouraging* — a knowledgeable consultant who is on the
student's side. It frames study-abroad as a personal **journey**.

- **Person:** second person, addressed to the student — "**your** applications", "Help us
  find **your** perfect match", "Track **your** university applications". Staff-facing CRM
  copy is neutral/functional ("Add Student", "Record Payment").
- **Casing:** **Title Case** for buttons, tabs, headings, and nav labels
  ("Login to System", "Get AI Recommendations", "Find Programs", "Start Interview").
  **Sentence case** for descriptions and helper text ("Enter your 8-character magic access
  code provided by your consultant.").
- **Tone of CTAs:** confident imperatives — *Start*, *Get*, *Find*, *Upgrade*, *Explore*,
  *Compare*, *Track*. Marketing headlines are short & aspirational:
  "Welcome to Your Journey", "Your Path to South Korea", "Track Your Applications",
  "Explore Korean Universities", "Practice with AI Interviewer".
- **Tagline / subtitle:** "South Korean University Application Platform" /
  "Your Path to South Korea" / UZ: "Janubiy Koreya universitetlariga ariza berish platformasi".
- **Naming:** the AI is always **"Hanguk AI"**. The brand is **"Hanguk"** (short) or
  **"Hanguk Consulting"** (full). Magic-Code, TOPIK, Apostille, Study Plan, Personal
  Statement are capitalized domain terms.
- **Emoji:** **sparse and functional, not decorative.** Used only as status markers in
  high-stakes copy — ⚠️ for warnings ("⚠️ Important: Do NOT Submit AI Content"), ✅ for the
  recommended/safe path ("✅ Recommended: Write Your Own"). Never as bullets or flourish.
- **Honesty/safety vibe:** the product is candid about risk ("REFERENCE ONLY — DO NOT COPY",
  "Universities CAN and WILL detect AI-written text"). Plain, protective, unfluffy.
- **Numbers/units:** money as `5M UZS`, `$5,000`; counts spelled inline ("{{count}} steps").

*Examples (verbatim):* "Hello! I'm Hanguk AI, your personal study abroad assistant. Ask me
anything about your applications, documents, universities, or the admission process!" ·
"Start your journey with Hanguk" · "Speak clearly and at a moderate pace".

---

## 3. VISUAL FOUNDATIONS

**Palette.** Two colors carry the whole brand:
- **Deep Royal Blue `#1A3A6C`** — primary. Authority, trust, "Korea-blue". Backs the
  marketing hero, the app shell, the CRM sidebar, primary buttons (on light).
- **Vibrant Lime `#D4E94C`** — accent/energy. Used for the single most important action,
  selected/active states, the app's primary buttons (on dark), progress dots, the AI mic
  FAB. High-voltage and deliberately rare — never large fills of it next to body text.
- Neutrals are blue-tinted grays (all hues at 216°): ink `#0A1A34`, muted text `#52627A`,
  borders `#D9DFE8`, secondary surface `#EFF2F5`. White `#FFFFFF` background on web.
- Semantics: success `#16A34A` (app) / `#B4CC19` olive-lime (web token), warning `#F59E0B`,
  destructive `#EF4444`/`#DC2626`.

**Two surface modes:**
- *Web admin (light):* white cards on white/secondary bg, royal-blue primary, lime accent,
  deep-navy sidebar `#132D53`. Clean, dense, productivity SaaS.
- *App (dark, OLED):* true-black `#000` scaffold with a diagonal **navy→black gradient**
  (`#1A3A6C → #132A4D → #0F213D → #0A0A1A`). **Glassmorphism** cards: `rgba(255,255,255,.12)`
  fill, `rgba(255,255,255,.10)` hairline border, 20px radius. Lime is the action color.

**Type.** **Inter** throughout (Google Fonts), `system-ui` fallback. Bold/extrabold (700–900)
for display & headlines with tight negative tracking (-0.02em); 600 for UI labels & buttons;
400–500 for body. Marketing headlines are big, heavy, 2-line. Magic codes & data use a mono
face (JetBrains Mono here) with wide letter-spacing.

**Spacing & radius.** 4px base rhythm; container padding 1rem. Radius scale from
`--radius: 0.75rem` (12px lg, 10 md, 8 sm). The **app** rounds harder: 16px buttons/inputs,
20px cards. Pills (999px) for chips/badges.

**Backgrounds.** No photography in chrome; solid royal-blue or the navy→black gradient.
Marketing/store frames put the device on a flat royal-blue field with a lime corner wedge.
The University Map uses a real Kakao/OSM map tile surface with blue location pins. No noise,
no heavy texture, no decorative illustration in-product.

**Elevation / cards.** Web cards: white, 12px radius, soft blue-shadow
(`0 4px 12px rgba(10,26,52,.08)`), 1px `#D9DFE8` border. App cards: glass fill + hairline
white border, **no** drop shadow (depth comes from translucency over the gradient); the
hero logo gets a strong `0 10px 20px rgba(0,0,0,.30)` lift.

**Buttons & states.**
- *Primary (light web):* royal-blue fill, white text. *Highlight/accent:* lime fill, ink text.
- *Primary (app):* lime fill, black text, 16px radius, weight 700, flat (elevation 0).
- *Outline:* transparent with border — on dark it's `white/30` border + `white/70` text.
- **Hover:** ~90% opacity of the fill (`hover:bg-primary/90`) — a slight darken, no color shift.
- **Press (app):** Material ripple; no scale games. **Focus:** lime ring (`#C7E04A`).
- Min hit target **44×44** (enforced globally in web CSS; Material defaults in app).

**Motion.** Restrained & quick. Web: `fadeIn` / `slideUp` / `slideDown` at **0.3s ease-out**
(10px travel), accordion 0.2s. App: standard Material transitions + a GPS **pulse** on the
map's "you are here" marker. No bounce, no parallax, no long easings.

**Transparency & blur.** Core to the *app* (glassmorphism over gradient) and used lightly on
web (auth card `backdrop-blur`). Sidebar/active states are solid, not glassy.

**Imagery vibe.** Where photos appear (AI interviewer avatar, store shots) they're bright,
clean, professional — cool-leaning to match the blue. Korea/university iconography (shields,
map pins) over abstract art.

---

## 4. ICONOGRAPHY

- **Web admin (`hanguk-uz`):** **lucide-react** (`lucide-react@0.462`) — thin, consistent
  1.5–2px stroke, rounded joins. This is the primary icon language. Common glyphs seen in
  the CRM: `Home, Users, GraduationCap, FileText, MessageSquare, Phone, Calendar,
  ClipboardList, DollarSign, Bot, Languages, MapPin, Settings, Shield, Bell, KeyRound,
  Crown, User, Lock, Eye/EyeOff, Loader2, Download, ChevronRight`.
- **Mobile app (`hanguk_app`):** **Material Icons** (filled, via Flutter `uses-material-design`)
  + `cupertino_icons` on iOS. Examples: `school, map, description, model_training,
  smart_toy` (AI FAB), `workspace_premium, phone, fact_check`.
- For HTML recreations in this system, use **Lucide via CDN** (`https://unpkg.com/lucide@latest`)
  — it matches the web product exactly and is a close stand-in for the app's Material set.
  This is a deliberate substitution for the app kit; flag if pixel-exact Material is required.
- **No custom icon font/sprite** ships in either repo beyond these libraries.
- **Emoji as icons:** essentially none in chrome (see Content Fundamentals — only ⚠️/✅ in
  warning copy). **Unicode glyphs** are not used as UI icons.
- **Logo / brand mark:** the **한** Korean syllable in royal blue (or white on blue) above
  the **Hanguk** wordmark. Assets in `assets/` (`logo-hanguk-navy.png`, `logo.jpg` square
  app-icon, `app-icon.png`). The square icon places a white **한** on a royal-blue tile.

---

## 5. Index — what's in this folder

| Path | What |
|---|---|
| `README.md` | This file — context, content & visual foundations, iconography, index |
| `colors_and_type.css` | All color + type tokens (CSS vars) + semantic type classes |
| `SKILL.md` | Agent-Skills manifest so this system works in Claude Code |
| `assets/` | `logo-hanguk-navy.png`, `logo.jpg`, `app-icon.png`, `splash.png` |
| `preview/` | Design-system cards (color, type, spacing, components) for the DS tab |
| `ui_kits/mobile_app/` | Flutter student-app recreation — `index.html` + JSX components |
| `ui_kits/admin_web/` | hanguk-uz CRM recreation — `index.html` + JSX components |
| `public/screenshots/` | Real store screenshots of the app (reference only) |

**Start here:** open `preview/` cards in the Design System tab, or load a UI kit's
`index.html`. For brand rules read §2–§4 above.
