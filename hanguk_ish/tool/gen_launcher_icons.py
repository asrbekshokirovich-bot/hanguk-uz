"""Draws the launcher icons of both apps (PIL, no other dependencies).

The icon is the prototype's brand tile — white rounded square, 1.5 px ink
outline, 4 px hard ink shadow, blue 한 in Noto Sans KR Black — on the app's
field colour: navy for «Hanguk Ish», lime for «Hanguk Ish 사장님».
Writes adaptive foregrounds (108 dp) and legacy square icons (48 dp) for
every density into android/app/src/<flavor>/res.

  python3 tool/gen_launcher_icons.py
"""
from PIL import Image, ImageDraw, ImageFont

FONT = 'assets/fonts/NotoSansKR-900.ttf'
NAVY, INK, WHITE, BLUE, LIME = '#0A1440', '#0A1A34', '#FFFFFF', '#2447D6', '#CCFF00'
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
SS = 4  # supersampling


def tile(draw, cx, cy, size):
    """Brand tile of [size] px centred at (cx, cy); proportions of the 72 px tile."""
    k = size / 72
    r = 22 * k
    x0, y0 = cx - size / 2, cy - size / 2
    sh = 4 * k
    draw.rounded_rectangle([x0 + sh, y0 + sh, x0 + size + sh, y0 + size + sh], r, fill=INK)
    draw.rounded_rectangle([x0, y0, x0 + size, y0 + size], r, fill=INK)
    b = 1.5 * k
    draw.rounded_rectangle([x0 + b, y0 + b, x0 + size - b, y0 + size - b], r - b, fill=WHITE)
    font = ImageFont.truetype(FONT, int(40 * k))
    draw.text((cx, cy), '한', font=font, fill=BLUE, anchor='mm')


def render(px, field, tile_frac, square):
    big = px * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if square:
        d.rounded_rectangle([0, 0, big - 1, big - 1], big * 0.18, fill=field)
    size = big * tile_frac
    # Shift left/up by half the shadow so tile + shadow is centred.
    tile(d, big / 2 - size * 2 / 72, big / 2 - size * 2 / 72, size)
    return img.resize((px, px), Image.LANCZOS)


for flavor, field in [('main', NAVY), ('employer', LIME)]:
    for name, k in DENSITIES.items():
        out = f'android/app/src/{flavor}/res/mipmap-{name}'
        import os
        os.makedirs(out, exist_ok=True)
        # Adaptive foreground: 108 dp canvas, tile inside the 66 dp safe circle.
        render(round(108 * k), field, 0.40, False).save(f'{out}/ic_launcher_foreground.png')
        # Legacy icon (API 24–25): the whole 48 dp square.
        render(round(48 * k), field, 0.62, True).save(f'{out}/ic_launcher.png')
print('icons written')
