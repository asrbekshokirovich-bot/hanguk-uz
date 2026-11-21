"""Writes the launcher icons of both apps from Asrbek's logos (2026-11-14).

  tool/icons/worker.png   — «Hanguk Ish»: blue field, white 한 with the
                            taegeuk in its ㅇ
  tool/icons/employer.png — «Hanguk Ish 사장님»: red/blue taegeuk field,
                            white 한

The logo is full-bleed, so it is the whole adaptive icon: the 108 dp
foreground is the logo at 84 dp in the middle, its edges stretched out to
fill the rest — the launcher's mask shows the middle 72 dp, so 한 keeps the
margins it has in the logo. The background colour (logo edge) is only seen
by launchers that move the layers. Legacy icons (API 24–25) are the logo in a
rounded square. Also writes the 512 px Play store icon to build/store/, the
white 한 of the logo as the status-bar notification icon (24 dp, Android
draws it in one colour) and as the adaptive icon's monochrome layer
(Android 13 themed icons).

  python3 tool/gen_launcher_icons.py
"""
import os

import numpy as np

from PIL import Image, ImageDraw

DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
APPS = [('main', 'tool/icons/worker.png'), ('employer', 'tool/icons/employer.png')]


def padded(img, px, inner=84 / 108):
    """[img] at inner*px in the middle of a px square, edges stretched outwards."""
    size = round(px * inner)
    a = np.asarray(img.convert('RGBA').resize((size, size), Image.LANCZOS))
    before = (px - size) // 2
    a = np.pad(a, ((before, px - size - before), (before, px - size - before), (0, 0)), mode='edge')
    return Image.fromarray(a)


def rounded(img, px):
    out = img.convert('RGBA').resize((px, px), Image.LANCZOS)
    mask = Image.new('L', (px * 4, px * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, px * 4 - 1, px * 4 - 1], px * 4 * 0.18, fill=255)
    out.putalpha(mask.resize((px, px), Image.LANCZOS))
    return out


def glyph(img):
    """The white 한 of a logo, white on transparent (the rest of the logo gone)."""
    a = np.asarray(img.convert('RGB')).astype(int)
    white = (a.min(axis=2) > 200)
    out = np.zeros((*white.shape, 4), dtype=np.uint8)
    out[white] = (255, 255, 255, 255)
    return Image.fromarray(out)


def notification(mark, px):
    """The 한 filling a px square with Android's 2 dp margin."""
    box = mark.getbbox()
    cut = mark.crop(box)
    inner = round(px * 20 / 24)
    w, h = cut.size
    k = inner / max(w, h)
    cut = cut.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    out.paste(cut, ((px - cut.width) // 2, (px - cut.height) // 2), cut)
    return out


os.makedirs('build/store', exist_ok=True)
for flavor, source in APPS:
    logo = Image.open(source).convert('RGBA')
    for name, k in DENSITIES.items():
        out = f'android/app/src/{flavor}/res/mipmap-{name}'
        os.makedirs(out, exist_ok=True)
        padded(logo, round(108 * k)).save(f'{out}/ic_launcher_foreground.png')
        rounded(logo, round(48 * k)).save(f'{out}/ic_launcher.png')
        mark = glyph(logo)
        padded(mark, round(108 * k)).save(f'{out}/ic_launcher_monochrome.png')
        drawable = f'android/app/src/{flavor}/res/drawable-{name}'
        os.makedirs(drawable, exist_ok=True)
        notification(mark, round(24 * k)).save(f'{drawable}/ic_notification.png')
    logo.convert('RGB').resize((512, 512), Image.LANCZOS).save(
        f'build/store/icon-512-{"worker" if flavor == "main" else "employer"}.png')
print('icons written')
