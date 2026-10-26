#!/usr/bin/env node
// The student app's button names (the `element` of a `tap` event) with the
// button's own text in each language, for the CRM's app analytics.
//
// Every tap handler in hanguk_app/lib is wrapped in tracked('<screen>.<what>', …)
// (see hanguk_app/lib/core/analytics/tracked.dart). This finds each name and,
// in the same widget call, a label/title/text/tooltip taken from the app's
// translations (l.someKey), and writes the key's text from the ARB files:
//
//   node scripts/app-elements.mjs
//
// → src/components/crm/appActivity/appElements.json
//   { "lead.report_send": { "key": "fdReportSend", "uz": "…", "en": "…", "ru": "…", "ko": "…" }, … }
//
// Names without a translated label are listed with "key": null; the CRM shows
// those by name. Run it again after adding buttons to the app.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LIB = join(ROOT, 'hanguk_app/lib');
const ARB = join(ROOT, 'hanguk_app/lib/l10n');
const OUT = join(ROOT, 'src/components/crm/appActivity/appElements.json');
const LANGS = ['uz', 'en', 'ru', 'ko'];
const SKIP = ['l10n/', 'design_system/seoul_night/seoul_night_gallery.dart'];

function dartFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...dartFiles(p));
    else if (name.endsWith('.dart') && !name.endsWith('.g.dart') && !name.endsWith('.freezed.dart')) out.push(p);
  }
  return out;
}

// Marks which characters are code (not inside a string or a comment).
function codeMask(s) {
  const mask = new Uint8Array(s.length).fill(1);
  let i = 0;
  const blank = (a, b) => mask.fill(0, a, b);
  function skipString(j) {
    const raw = s[j] === 'r';
    if (raw) j++;
    const q = s[j];
    const triple = s.startsWith(q.repeat(3), j);
    const end = triple ? q.repeat(3) : q;
    j += triple ? 3 : 1;
    while (j < s.length) {
      if (!raw && s[j] === '\\') { j += 2; continue; }
      if (s.startsWith(end, j)) return j + end.length;
      if (!raw && s[j] === '$' && s[j + 1] === '{') { j = skipBraces(j + 1); continue; }
      if (!triple && s[j] === '\n') return j;
      j++;
    }
    return j;
  }
  function skipBraces(j) {
    let depth = 0;
    while (j < s.length) {
      if (isString(j)) { j = skipString(j); continue; }
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { depth--; if (depth === 0) return j + 1; }
      j++;
    }
    return j;
  }
  const isString = (j) =>
    s[j] === "'" || s[j] === '"' || (s[j] === 'r' && (s[j + 1] === "'" || s[j + 1] === '"') && !/[\w$]/.test(s[j - 1] ?? ''));
  while (i < s.length) {
    if (s.startsWith('//', i)) { const e = s.indexOf('\n', i); const j = e < 0 ? s.length : e; blank(i, j); i = j; continue; }
    if (s.startsWith('/*', i)) { const e = s.indexOf('*/', i + 2); const j = e < 0 ? s.length : e + 2; blank(i, j); i = j; continue; }
    if (isString(i)) { const j = skipString(i); blank(i, j); i = j; continue; }
    i++;
  }
  return mask;
}

// The unmatched '(' before position `at`, in code.
function enclosingParen(s, mask, at) {
  let depth = 0;
  for (let j = at - 1; j >= 0; j--) {
    if (!mask[j]) continue;
    const c = s[j];
    if (c === ')' || c === ']' || c === '}') depth++;
    else if (c === '(' || c === '[' || c === '{') {
      if (depth === 0) return c === '(' ? j : -1;
      depth--;
    }
  }
  return -1;
}

function matchParen(s, mask, open) {
  let depth = 0;
  for (let j = open; j < s.length; j++) {
    if (!mask[j]) continue;
    if ('([{'.includes(s[j])) depth++;
    else if (')]}'.includes(s[j])) { depth--; if (depth === 0) return j; }
  }
  return s.length;
}

const L10N = String.raw`(?:l|l10n|dl|loc|AppLocalizations\.of\(\w+\)!?)`;
const LABEL_ARGS = new Set(['label', 'title', 'text', 'tooltip', 'semanticLabel', 'semanticsLabel', 'cta', 'hint']);
const KEY_VALUE = new RegExp(String.raw`^${L10N}\.([a-z]\w+)\b`);
const TEXT_CHILD = new RegExp(String.raw`^Text\(\s*${L10N}\.([a-z]\w+)\b`);

// The call's own named arguments (not those of the widgets inside it).
function directArgs(s, mask, open, close) {
  const args = [];
  let depth = 0;
  let from = open + 1;
  for (let j = open + 1; j <= close; j++) {
    if (!mask[j]) continue;
    const c = s[j];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) {
      if (depth === 0) { args.push(s.slice(from, j)); break; }
      depth--;
    } else if (c === ',' && depth === 0) { args.push(s.slice(from, j)); from = j + 1; }
  }
  const named = {};
  for (const a of args) {
    const m = a.match(/^\s*(\w+)\s*:\s*([\s\S]*)$/);
    if (m) named[m[1]] = m[2].trim();
  }
  return named;
}

function keyOf(named) {
  for (const [k, v] of Object.entries(named)) {
    if (!LABEL_ARGS.has(k)) continue;
    const m = v.match(KEY_VALUE);
    if (m) return m[1];
  }
  const child = named.child?.match(TEXT_CHILD);
  return child ? child[1] : null;
}

function calleeBefore(s, open) {
  return s.slice(Math.max(0, open - 80), open).match(/([A-Za-z_][\w.]*)\s*(?:<[^()]*>)?\s*$/)?.[1] ?? '';
}

function labelKey(s, mask, at) {
  // The call tracked(...) is an argument of: HardButton(label: l.x, onPressed: tracked(...)).
  const open = enclosingParen(s, mask, at);
  if (open < 0) return null;
  const key = keyOf(directArgs(s, mask, open, matchParen(s, mask, open)));
  if (key) return key;
  // A bare gesture detector: the Semantics around it may carry the label.
  if (!/^(GestureDetector|InkWell|InkResponse)$/.test(calleeBefore(s, open))) return null;
  const parent = enclosingParen(s, mask, open);
  if (parent < 0 || calleeBefore(s, parent) !== 'Semantics') return null;
  return keyOf(directArgs(s, mask, parent, matchParen(s, mask, parent)));
}

// ARB text as a label: placeholders become "…", a plural takes its "other" form.
function plain(text) {
  if (typeof text !== 'string') return null;
  let t = text;
  const plural = t.match(/\{\s*\w+\s*,\s*(?:plural|select)\s*,([\s\S]*)\}/);
  if (plural) {
    const other = plural[1].match(/other\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
    t = t.replace(plural[0], other ? other[1] : '…');
  }
  return t.replace(/\{[^{}]*\}/g, '…').replace(/\s+/g, ' ').trim();
}

const arb = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(readFileSync(join(ARB, `app_${lang}.arb`), 'utf8'))]));
const NAME = /\btracked(?:Long|Value)?(?:<[^>]*>)?\(\s*'([a-z0-9_]+\.[a-z0-9_]+)'/g;

const elements = {};
for (const file of dartFiles(LIB)) {
  const rel = relative(LIB, file);
  if (SKIP.some((x) => rel.startsWith(x) || rel === x)) continue;
  const s = readFileSync(file, 'utf8');
  if (!s.includes('tracked')) continue;
  const mask = codeMask(s);
  for (const m of s.matchAll(NAME)) {
    if (!mask[m.index]) continue;
    const name = m[1];
    const key = labelKey(s, mask, m.index);
    const known = elements[name];
    if (known && known.key) continue;
    elements[name] = { key: key && arb.uz[key] !== undefined ? key : null, file: rel };
  }
}

const out = {};
for (const name of Object.keys(elements).sort()) {
  const { key, file } = elements[name];
  out[name] = { key, file };
  for (const lang of LANGS) out[name][lang] = key ? plain(arb[lang][key] ?? arb.uz[key]) : null;
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
const labelled = Object.values(out).filter((e) => e.key).length;
console.log(`${Object.keys(out).length} names, ${labelled} with a label → ${relative(ROOT, OUT)}`);
