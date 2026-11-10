"""layout_diff.py <prototype.json> <flutter.json> [--all]

Compares where texts start (x) and sit (baseline y) in the prototype
(probe_real.mjs, Chrome) and in a Flutter screen test (build/layout/*.json).
Texts are matched by their first characters, in order. Prints each matched
text with dx / dy and a summary; unmatched texts are listed too.
"""
import json
import sys


def norm(text):
    return ' '.join(text.replace(' ', ' ').replace(' ', ' ').split())


def main():
    proto = json.load(open(sys.argv[1], encoding='utf-8'))
    flutter = json.load(open(sys.argv[2], encoding='utf-8'))
    show_all = '--all' in sys.argv
    used = set()
    rows = []
    missing = []
    for p in proto:
        key = norm(p['text'])
        best = None
        for i, f in enumerate(flutter):
            if i in used:
                continue
            fk = norm(f['text'])
            if fk.startswith(key[:24]) or key.startswith(fk[:24]):
                d = abs(f['y'] - p['y']) + abs(f['x'] - p['x'])
                if best is None or d < best[0]:
                    best = (d, i)
        if best is None:
            missing.append(key)
            continue
        used.add(best[1])
        f = flutter[best[1]]
        rows.append((p['y'], key, f['x'] - p['x'], f['y'] - p['y']))
    rows.sort()
    worst = 0.0
    for y, key, dx, dy in rows:
        worst = max(worst, abs(dx), abs(dy))
        if show_all or abs(dx) >= 0.5 or abs(dy) >= 0.5:
            print(f'{y:8.2f}  dx {dx:+6.2f}  dy {dy:+6.2f}  {key[:50]}')
    extra = [norm(f['text']) for i, f in enumerate(flutter) if i not in used]
    print(f'matched {len(rows)}/{len(proto)}, worst offset {worst:.2f} px')
    if missing:
        print('not in Flutter:', missing)
    if extra:
        print('only in Flutter:', extra[:20])


if __name__ == '__main__':
    main()
