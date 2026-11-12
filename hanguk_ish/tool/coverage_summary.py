#!/usr/bin/env python3
"""Sums up an lcov file: lines covered in lib/, and the files least covered.

  tool/coverage_summary.py coverage/lcov.info [title] >> "$GITHUB_STEP_SUMMARY"

Generated code (l10n, *.g.dart) is left out. Prints Markdown.
"""
import sys


def main():
    path = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else 'Coverage'
    files = {}
    current = None
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('SF:'):
                current = line[3:]
                files.setdefault(current, [0, 0])
            elif line.startswith('DA:') and current:
                hits = int(line[3:].split(',')[1])
                files[current][1] += 1
                if hits > 0:
                    files[current][0] += 1
            elif line == 'end_of_record':
                current = None
    kept = {
        name: (hit, found) for name, (hit, found) in files.items()
        if found and 'lib/' in name and '/l10n/gen/' not in name and not name.endswith('.g.dart')
    }
    hit = sum(h for h, _ in kept.values())
    found = sum(n for _, n in kept.values())
    print(f'### {title}')
    print()
    print(f'**{100 * hit / found:.1f}%** of {found} lines in {len(kept)} files of lib/.')
    print()
    print('| File | Lines | Covered |')
    print('|---|---:|---:|')
    worst = sorted(kept.items(), key=lambda kv: (kv[1][0] / kv[1][1], -kv[1][1]))[:15]
    for name, (h, n) in worst:
        short = name[name.index('lib/'):]
        print(f'| `{short}` | {n} | {100 * h / n:.0f}% |')
    print()


if __name__ == '__main__':
    main()
