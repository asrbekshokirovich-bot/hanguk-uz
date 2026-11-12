#!/usr/bin/env node
// Type errors may only go down.
//
// `tsc -p tsconfig.app.json` reports a couple of hundred errors on main (most
// of them from src/integrations/supabase/types.ts being older than the
// database), so "tsc must pass" cannot be a check yet — and with no check at
// all, new type errors were merged unseen. This script counts the errors per
// file and compares them with scripts/tsc-baseline.json:
//
//   - a file with MORE errors than its baseline, or a new file with errors,
//     fails the run and prints those errors;
//   - fewer errors pass, with a reminder to lower the baseline.
//
//   node scripts/tsc-ratchet.mjs            check
//   node scripts/tsc-ratchet.mjs --update   rewrite the baseline from the current state
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** `path(line,col): error TS1234: message` → { file, text } */
export function parseErrors(output) {
  const errors = [];
  for (const line of output.split('\n')) {
    const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line.trim());
    if (m) errors.push({ file: m[1].replace(/\\/g, '/'), text: line.trim() });
  }
  return errors;
}

export function countByFile(errors) {
  const counts = {};
  for (const e of errors) counts[e.file] = (counts[e.file] ?? 0) + 1;
  return counts;
}

/** Files that got worse, and files that got better, against the baseline. */
export function compare(baseline, current) {
  const worse = [];
  const better = [];
  for (const [file, n] of Object.entries(current)) {
    const was = baseline[file] ?? 0;
    if (n > was) worse.push({ file, was, now: n });
  }
  for (const [file, was] of Object.entries(baseline)) {
    const now = current[file] ?? 0;
    if (now < was) better.push({ file, was, now });
  }
  return { worse, better };
}

function runTsc() {
  const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (r.error) throw r.error;
  return `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
}

// Run only as a script; the functions above are imported by its test.
if (/tsc-ratchet\.mjs$/.test(process.argv[1] ?? '')) {
  const baselinePath = fileURLToPath(new URL('./tsc-baseline.json', import.meta.url));
  const errors = parseErrors(runTsc());
  const current = countByFile(errors);
  const total = errors.length;

  if (process.argv.includes('--update')) {
    const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`tsc baseline written: ${total} errors in ${Object.keys(current).length} files`);
    process.exit(0);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  const { worse, better } = compare(baseline, current);

  console.log(`tsc: ${total} errors (baseline ${baselineTotal})`);
  if (worse.length) {
    console.error('\nNew type errors:');
    for (const w of worse) {
      console.error(`\n  ${w.file}: ${w.was} → ${w.now}`);
      for (const e of errors.filter((x) => x.file === w.file)) console.error(`    ${e.text}`);
    }
    console.error('\nFix them (or, if the file was only renamed, run: node scripts/tsc-ratchet.mjs --update).');
    process.exit(1);
  }
  if (better.length) {
    console.log(`\n${better.length} file(s) have fewer errors than the baseline — lower it: node scripts/tsc-ratchet.mjs --update`);
  }
}
