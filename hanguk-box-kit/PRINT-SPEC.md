# Hanguk Box — Print Specification (hand this to the printing agency)

A premium **two-piece rigid box** (lid + tray) holding a laptop and a set of
books written by Hanguk Consulting staff. Everything below is what a packaging
printer needs to quote and produce the job.

---

## 1. Files in this folder

| File | What it is | Give to printer? |
|------|------------|------------------|
| `dieline-lid.svg`  | **Print-ready dieline of the LID** (1:1, millimetres) | ✅ Yes |
| `dieline-tray.svg` | **Print-ready dieline of the TRAY/base** (1:1, millimetres) | ✅ Yes |
| `keyvisual.svg`    | Marketing hero image (not for the box itself) | optional |
| `previews/*.png`   | Quick previews to look at on screen | reference only |

> **Vector & editable.** The dielines are real vector SVG at 1:1 scale.
> Open them in Adobe Illustrator or CorelDRAW (both open SVG natively) and
> **Save As → PDF/X-1a or AI** before sending to print. All text, the logo,
> dimensions, cut, fold and bleed marks are preserved.

---

## 2. Construction

- **Type:** Rigid set-up box, separate **lid (telescoping cover)** over a **tray (base)**.
- **Board:** 2 mm grey chipboard, wrapped with **157 gsm coated art paper** (printed wrap).
- **Assembled outer size (lid):** **390 × 295 × 50 mm**
- **Assembled outer size (tray):** **380 × 285 × 80 mm**
- **Inner clear space:** ~360 × 265 × 70 mm — fits a 14–15″ laptop **plus** 2–3 books.
- **Insert:** die-cut **EVA foam** or **moulded pulp** tray, one cavity for the
  laptop + a slot for the book set. (Spec the insert from the final laptop model.)

> Dimensions are a starting point sized for a 14″ laptop. If your laptop/book
> sizes differ, tell the printer the exact item sizes — the dieline scales
> proportionally (or regenerate with `node hanguk-box-kit/dieline.mjs` after
> editing the `L/W/H` values at the bottom of that file).

---

## 3. Colours (brand-exact)

| Role | Pantone | CMYK | HEX |
|------|---------|------|-----|
| **Royal Blue** (main) | **PMS 534 C** | C100 M82 Y30 K12 | `#1A3A6C` |
| Royal deep (shadows) | PMS 539 C | C100 M85 Y40 K40 | `#0F213D` |
| **Lime** (accent / action) | **PMS 374 C** | C26 M0 Y82 Y0 | `#D4E94C` |
| Lime deep | PMS 376 C | C35 M0 Y100 K10 | `#B4CC19` |
| Ink (text) | PMS 533 C | — | `#0A1A34` |
| Paper / inner | warm white | — | `#F6F1E4` |

Lime is an **accent only** (rim line, logo "Box", tagline rule) — keep the box
predominantly Royal Blue, matching Hanguk's brand.

---

## 4. Finish

- **Outside:** soft-touch **matte lamination** over the full wrap.
- **Logo + "Box" wordmark:** **spot UV** (gloss) for a premium tactile hit.
- Optional upgrade: **lime foil stamp** instead of printed lime on the lid logo.
- **Inside:** matte, warm-white, no lamination needed (or anti-scratch matte).

---

## 5. Prepress

- **Scale:** 1:1. Do not resize the dieline.
- **Bleed:** **3 mm** on every cut edge (shown as the dotted guide).
- **Safety:** keep text/logo **≥ 5 mm** inside fold lines.
- **Lines in the file:** `CUT` = solid red · `FOLD/CREASE` = dashed blue ·
  `GLUE` = hatched (no print) · `BLEED` = dotted grey. (Move these to your
  die/crease/cut layers; they are guide colours, not printing inks.)
- **Logo art:** the `한 / Hanguk` mark is embedded in the file. Master logos
  also live in the repo: `public/brand-mark.png` (navy) and
  `public/brand-glyph-white.png` (white). Ask us for vector logo if needed.

---

## 6. Quantity / quote checklist to send the printer

1. Quantity (e.g. 100 / 250 / 500 boxes).
2. Confirm material (2 mm rigid) + wrap (157 gsm art paper).
3. Confirm soft-touch matte lam + spot-UV logo.
4. Insert: EVA foam vs moulded pulp (send laptop model + book trim size).
5. Proof: request a **physical white-sample + a printed proof** before the full run.

---

*Generated for Hanguk Consulting. Edit `dieline.mjs` / `keyvisual.mjs` and
re-run with Node to regenerate any artwork.*
