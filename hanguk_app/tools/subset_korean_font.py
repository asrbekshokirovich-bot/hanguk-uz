#!/usr/bin/env python3
"""Re-subset NotoSansKR to exactly the characters the app can render.

The app ships subset fonts so the APK stays small, which means every Korean
syllable — and every symbol Inter doesn't carry — has to be in the subset or
it renders as tofu. Run this after any change that adds Korean text or a
symbol to lib/ or the .arb files.

Source: the Noto Sans KR variable font from google/fonts. Instanced at the
three weights pubspec.yaml registers (500 / 700 / 900), then subset.
"""
import io, os, subprocess, sys

APP = '/home/user/hanguk-uz/hanguk_app'
SCRATCH = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.join(SCRATCH, 'kr-var.ttf')
OUT = os.path.join(APP, 'assets', 'fonts')
WEIGHTS = [500, 700, 900]

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# ---------------------------------------------------------------------------
# 1. What does the app actually render?
# ---------------------------------------------------------------------------
text = []
for root in ['lib']:
    for dp, _d, fs in os.walk(os.path.join(APP, root)):
        for fn in fs:
            if fn.endswith(('.dart', '.arb')):
                text.append(io.open(os.path.join(dp, fn), encoding='utf-8').read())
used = set(''.join(text))

def is_cjk(c):
    return ('ᄀ' <= c <= 'ᇿ' or '㄰' <= c <= '㆏'
            or '가' <= c <= '힣' or '一' <= c <= '鿿'
            or '　' <= c <= '〿' or '＀' <= c <= '￯')

korean = {c for c in used if is_cjk(c)}

# Symbols Inter does not carry, so Noto has to be the fallback that does.
inter_cov = set()
f = TTFont(os.path.join(OUT, 'Inter-400.ttf'))
for t in f['cmap'].tables:
    inter_cov |= {chr(c) for c in t.cmap}
symbols = {c for c in used
           if ord(c) > 0x2000 and not is_cjk(c) and c not in inter_cov
           and ord(c) < 0x10000}

# ASCII + the punctuation that shows up inside mixed Korean strings, so a
# fallback line never swaps typeface mid-word.
base = set(chr(c) for c in range(0x20, 0x7F))
charset = korean | symbols | base

print(f'korean={len(korean)}  extra symbols={len(symbols)} '
      f'({"".join(sorted(symbols))})  total={len(charset)}')

# ---------------------------------------------------------------------------
# 2. Instance + subset per weight
# ---------------------------------------------------------------------------
unicodes = ','.join(f'U+{ord(c):04X}' for c in sorted(charset))
uni_file = os.path.join(SCRATCH, 'kr-charset.txt')
io.open(uni_file, 'w', encoding='utf-8').write(''.join(sorted(charset)))

for w in WEIGHTS:
    inst_path = os.path.join(SCRATCH, f'kr-{w}.ttf')
    font = TTFont(VAR)
    # updateFontNames so the file says 'Medium'/'Bold'/'Black' instead of
    # inheriting the variable font's default 'Thin' name records.
    instancer.instantiateVariableFont(
        font, {'wght': w}, inplace=True, updateFontNames=True)
    font.save(inst_path)

    dest = os.path.join(OUT, f'NotoSansKR-{w}.ttf')
    subprocess.run([
        sys.executable, '-m', 'fontTools.subset', inst_path,
        f'--text-file={uni_file}',
        f'--output-file={dest}',
        '--layout-features=*',
        '--no-hinting',
        '--desubroutinize',
        '--name-IDs=*',
        '--drop-tables+=DSIG',
    ], check=True)
    print(f'  wrote {dest}  {os.path.getsize(dest)/1024:.0f} KB')

# ---------------------------------------------------------------------------
# 3. Verify nothing is missing
# ---------------------------------------------------------------------------
bad = 0
for w in WEIGHTS:
    p = os.path.join(OUT, f'NotoSansKR-{w}.ttf')
    cov = set()
    ft = TTFont(p)
    for t in ft['cmap'].tables:
        cov |= {chr(c) for c in t.cmap}
    # U+2715 exists only in source comments, never in a rendered string, and
    # Noto Sans KR does not carry it at all — so it is not a real gap.
    missing = sorted((korean | symbols) - cov - {'\u2715'})
    print(f'NotoSansKR-{w}: {len(cov)} glyphs, missing {len(missing)}'
          + (f' -> {"".join(missing)}' if missing else ''))
    bad += len(missing)

# And the combined promise: every character in the app is in Inter or Noto.
combined = set(inter_cov)
ft = TTFont(os.path.join(OUT, 'NotoSansKR-700.ttf'))
for t in ft['cmap'].tables:
    combined |= {chr(c) for c in t.cmap}
renderable_gap = sorted(
    c for c in used
    if ord(c) > 31 and ord(c) < 0x10000 and c not in combined)
print(f'characters in lib/ covered by neither font: {len(renderable_gap)}'
      + (f' -> {" ".join(repr(c) for c in renderable_gap)}' if renderable_gap else ''))

sys.exit(1 if bad else 0)
