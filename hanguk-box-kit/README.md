# Hanguk Box — design + reveal kit

Everything for the **Hanguk Box** product: a premium box that holds a **laptop**
and a set of **books written by Hanguk Consulting staff**, sold to students.

This kit gives you **(1)** a print-ready box design to hand to a printer and
**(2)** an animated "unboxing" reveal you can turn into a video clip.

| File | Purpose |
|------|---------|
| **`box-reveal.html`** | 🎬 Animated 3D reveal — box spins in, lid opens, laptop rises & opens, books fan out. Open in a browser. Also live at **`/box-reveal.html`** on the deployed site. |
| **`dieline-lid.svg`** / **`dieline-tray.svg`** | 🖨️ Print-ready dielines (1:1 mm, cut/fold/bleed/glue). |
| **`PRINT-SPEC.md`** | 📋 Full spec sheet for the printing agency (sizes, Pantone/CMYK, finish). |
| **`keyvisual.svg`** | 🖼️ Marketing hero poster (open box + laptop + books). |
| `previews/*.png` | On-screen previews of the above. |
| `*.mjs` | Generators (Node) — edit & re-run to regenerate any artwork. |

---

## The name

Working name used in the artwork: **Hanguk Box** ( **한 Box** ), tagline
**“Learn · Build · Belong.”** Easy to change — see *Customise* below.
Other options: *Hanguk Starter Box · Hanguk Season Box · 한 Kit.*

---

## 🎬 Turn the reveal into a video clip

The animation lives in `box-reveal.html`. Three ways to get a video file:

1. **Built-in recorder (easiest, no tools):** open the page, click
   **“● Record .webm”**, choose *This Tab* — it captures one full loop (~18 s)
   and downloads `hanguk-box-reveal.webm`. Convert to `.mp4` with any converter
   if needed.
2. **Phone:** open the deployed `…/box-reveal.html`, tap **Fullscreen**, and use
   your phone's screen recorder.
3. **Locally with ffmpeg** (if installed):
   ```sh
   ffmpeg -i hanguk-box-reveal.webm -c:v libx264 -pix_fmt yuv420p hanguk-box.mp4
   ```

> Best viewed in **Chrome, Edge or Safari** (uses CSS 3D + Web Animations).

---

## Customise

**Names / text / tagline:** edit `box-reveal.template.html` (the visible
strings) and the artwork generators `dieline.mjs` / `keyvisual.mjs`.

**Box size** (for a different laptop): edit the `L, W, H` numbers at the bottom
of `dieline.mjs`.

**Rebuild everything:**
```sh
node hanguk-box-kit/build.mjs      # rebuilds box-reveal.html (embeds logos) + copies to /public
node hanguk-box-kit/dieline.mjs    # rebuilds both dielines
node hanguk-box-kit/keyvisual.mjs  # rebuilds the hero poster
```

Brand colours come straight from the app: Royal `#1A3A6C`, Lime `#D4E94C`,
Ink `#0A1A34`. Logos: `public/brand-mark.png`, `public/brand-glyph-white.png`.
