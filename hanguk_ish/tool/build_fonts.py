"""Rebuilds the bundled Noto Sans KR and JetBrains Mono files.

Usage:
  python3 tool/build_fonts.py <NotoSansKR[wght].ttf> <JetBrainsMono[wght].ttf> <prototype.html>

Inputs are the variable fonts from github.com/google/fonts (ofl/notosanskr,
ofl/jetbrainsmono). Each weight the prototype uses is instanced into a static
file. Noto Sans KR is subset to the 2,350 Hangul syllables of KS X 1001 plus
every syllable the prototype uses, jamo, Latin-1, CJK punctuation and ₩, which
keeps each file near 0.5 MB instead of 10 MB. Inter comes ready-made from
hanguk_app/assets/fonts (static Inter 4).
Needs fontTools (pip install fonttools).
"""
import html
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = 'assets/fonts'
noto_vf, mono_vf, prototype = sys.argv[1:4]

ks = set()
for hi in range(0xB0, 0xC9):
    for lo in range(0xA1, 0xFF):
        try:
            ch = bytes([hi, lo]).decode('euc_kr')
        except UnicodeDecodeError:
            continue
        if 0xAC00 <= ord(ch) <= 0xD7A3:
            ks.add(ord(ch))
src = html.unescape(open(prototype, encoding='utf-8').read())
uni = ks | {ord(c) for c in src if 0xAC00 <= ord(c) <= 0xD7A3}
for a, b in [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2030, 0x203A),
             (0x3000, 0x303F), (0x3131, 0x318E), (0xFF01, 0xFF5E), (0x2190, 0x2193)]:
    uni |= set(range(a, b + 1))
uni |= {0x20A9, 0x00B7, 0x2022, 0x2026, 0x2212, 0x00D7}

for w in [400, 500, 600, 700, 800, 900]:
    font = instancer.instantiateVariableFont(TTFont(noto_vf), {'wght': w})
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.glyph_names = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=uni)
    sub.subset(font)
    font.save(f'{OUT}/NotoSansKR-{w}.ttf')
    print('NotoSansKR', w)

for w in [500, 600, 700, 800]:
    instancer.instantiateVariableFont(TTFont(mono_vf), {'wght': w}).save(
        f'{OUT}/JetBrainsMono-{w}.ttf')
    print('JetBrainsMono', w)
