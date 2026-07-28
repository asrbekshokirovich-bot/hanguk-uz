#!/usr/bin/env python3
"""Static l10n consistency check (no flutter/dart available).

1. Every `l.<key>` / `AppLocalizations.of(context)!.<key>` referenced in lib/
   must be declared in app_localizations.dart.
2. Every declared key must be implemented in all 5 locale files.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
LIB = '/home/user/hanguk-uz/hanguk_app/lib'
L10N = os.path.join(LIB, 'l10n')
LOCALES = ['en', 'uz', 'ko', 'ru', 'vi']

def read(p):
    return io.open(p, encoding='utf-8').read()

# --- declared -------------------------------------------------------------
abstract = read(os.path.join(L10N, 'app_localizations.dart'))
declared = set(re.findall(r'^\s+String get (\w+);', abstract, re.M))
declared |= set(re.findall(r'^\s+String (\w+)\(', abstract, re.M))

impl = {}
for loc in LOCALES:
    s = read(os.path.join(L10N, f'app_localizations_{loc}.dart'))
    keys = set(re.findall(r'^\s+String get (\w+) =>', s, re.M))
    keys |= set(re.findall(r'^\s+String (\w+)\(', s, re.M))
    impl[loc] = keys

errors = []

for loc in LOCALES:
    missing = declared - impl[loc]
    extra = impl[loc] - declared
    for k in sorted(missing):
        errors.append(f'MISSING IMPL  app_localizations_{loc}.dart  ->  {k}')
    for k in sorted(extra):
        errors.append(f'ORPHAN IMPL   app_localizations_{loc}.dart  ->  {k} (not declared in abstract)')

# --- used ------------------------------------------------------------------
used = {}
pat = re.compile(r'\b(?:l|l10n|loc|strings|t)\.([a-z]\w*)')
for dirpath, _dirs, files in os.walk(LIB):
    if os.path.abspath(dirpath).startswith(os.path.abspath(L10N)):
        continue
    for fn in files:
        if not fn.endswith('.dart'):
            continue
        p = os.path.join(dirpath, fn)
        for m in pat.finditer(read(p)):
            used.setdefault(m.group(1), set()).add(os.path.relpath(p, LIB))

# Heuristic: only flag identifiers that look like l10n keys, i.e. that at least
# one locale or the abstract knows about, OR that appear on a var literally
# named `l`. Reduce noise by checking against a `final l = AppLocalizations`
# binding in the same file.
bound = set()
for dirpath, _dirs, files in os.walk(LIB):
    for fn in files:
        if fn.endswith('.dart'):
            p = os.path.join(dirpath, fn)
            if 'AppLocalizations.of(' in read(p):
                bound.add(os.path.relpath(p, LIB))

unknown = []
for key, files in sorted(used.items()):
    if key in declared:
        continue
    hit = [f for f in files if f in bound]
    if hit:
        unknown.append((key, sorted(hit)))

for key, files in unknown:
    errors.append(f'UNDECLARED KEY  l.{key}  used in: {", ".join(files[:4])}')

if errors:
    print(f'{len(errors)} problem(s):\n')
    for e in errors:
        print('  ' + e)
    sys.exit(1)
print(f'OK — {len(declared)} keys declared, all implemented in {len(LOCALES)} locales, no undeclared usage.')
