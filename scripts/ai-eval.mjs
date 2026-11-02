#!/usr/bin/env node
// Hanguk AI golden-question eval (plan §10.2).
//
//   SUPABASE_URL=https://lysjdtyanhdfphqyijsr.supabase.co \
//   SUPABASE_DB_URL=postgres://...        # read-only use: expected values
//   EVAL_STAFF_JWT=...  EVAL_STUDENT_JWT=...   # access tokens of test accounts
//   node scripts/ai-eval.mjs [--only uni-] [--out eval-report.json]
//
// Each question is sent to the deployed hanguk-ai-chat as its audience (guest
// = no token). The expected values are computed from the database at run time,
// so the set does not go stale. Exit code 1 when the pass rate is under 90% or
// any forbidden value (a leak) appears.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

const { SUPABASE_URL, SUPABASE_DB_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_DB_URL) {
  console.error('SUPABASE_URL and SUPABASE_DB_URL are required');
  process.exit(2);
}

// Access tokens expire within the hour, so CI signs in with test accounts
// (EVAL_STAFF_EMAIL / EVAL_STAFF_PASSWORD, same for STUDENT) when no JWT is given.
async function signIn(who) {
  const jwt = process.env[`EVAL_${who}_JWT`];
  if (jwt) return jwt;
  const email = process.env[`EVAL_${who}_EMAIL`];
  const password = process.env[`EVAL_${who}_PASSWORD`];
  if (!email || !password || !SUPABASE_PUBLISHABLE_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`${who} sign-in failed: ${r.status}`);
  return (await r.json()).access_token;
}
const EVAL_STAFF_JWT = await signIn('STAFF');
const EVAL_STUDENT_JWT = await signIn('STUDENT');

const file = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'supabase/functions/hanguk-ai-chat/eval/questions.json');
const { questions } = JSON.parse(fs.readFileSync(file, 'utf8'));

const jwtSub = (jwt) => {
  try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub; } catch { return null; }
};
const studentId = EVAL_STUDENT_JWT ? jwtSub(EVAL_STUDENT_JWT) : null;

// Numbers without thousand separators; dates also as YYYY-MM-DD.
export function normalize(text) {
  return String(text)
    .replace(/(\d)[\s  ,'](?=\d{3}\b)/g, '$1')
    .replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, (_, d, m, y) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    .toLowerCase();
}

async function ask(q) {
  const token = q.audience === 'staff' ? EVAL_STAFF_JWT : q.audience === 'student' ? EVAL_STUDENT_JWT : '';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/hanguk-ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_PUBLISHABLE_KEY ? { apikey: SUPABASE_PUBLISHABLE_KEY } : {}),
      Authorization: `Bearer ${token || ''}`,
    },
    body: JSON.stringify({ message: q.question, language: q.lang ?? 'uz', install_id: '00000000-0000-4000-8000-00000000e7a1' }),
  });
  const raw = await res.text();
  let text = '';
  const steps = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    try {
      const j = JSON.parse(line.slice(6));
      if (j.hanguk?.type === 'step') steps.push(...j.hanguk.tools);
      const c = j.choices?.[0]?.delta?.content;
      if (c) text += c;
    } catch { /* ignore */ }
  }
  return { status: res.status, text, steps };
}

const db = new pg.Client({ connectionString: SUPABASE_DB_URL });
await db.connect();
await db.query('set default_transaction_read_only = on');

const values = async (sql) => {
  if (!sql) return [];
  if (sql.includes(':student')) {
    if (!studentId) return null;
    sql = sql.replaceAll(':student', `'${studentId}'::uuid`);
  }
  const r = await db.query(sql);
  return r.rows.map((row) => String(row.v)).filter((v) => v && v !== 'null');
};

const report = [];
for (const q of questions) {
  if (only && !q.id.startsWith(only)) continue;
  if (q.audience === 'staff' && !EVAL_STAFF_JWT) continue;
  if (q.audience === 'student' && !EVAL_STUDENT_JWT) continue;
  const t0 = Date.now();
  const [expected, forbidden, answer] = await Promise.all([values(q.expect_sql), values(q.forbid_sql), ask(q)]);
  const ms = Date.now() - t0;
  const norm = normalize(answer.text);
  const missing = (expected ?? []).filter((v) => !norm.includes(normalize(v)));
  const digits = answer.text.replace(/\D/g, '');
  const leaks = [...(q.forbid ?? []), ...(forbidden ?? [])].filter((v) =>
    v && (norm.includes(normalize(v)) || (/^\d{7,}$/.test(v) && digits.includes(v.slice(-9)))));
  const refusalOk = q.refusal ? new RegExp(q.refusal, 'i').test(answer.text) : true;
  const pass = answer.status === 200 && answer.text.length > 0 && missing.length === 0 && leaks.length === 0 && refusalOk;
  report.push({ id: q.id, audience: q.audience, pass, ms, steps: answer.steps, missing, leaks, refusalOk, answer: answer.text.slice(0, 600) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${q.id} (${ms} ms) ${answer.steps.join('→')}${missing.length ? ` missing=${missing.join('|')}` : ''}${leaks.length ? ` LEAK=${leaks.join('|')}` : ''}${refusalOk ? '' : ' no-refusal'}`);
}
await db.end();

const passed = report.filter((r) => r.pass).length;
const leaks = report.filter((r) => r.leaks.length).length;
const ms = report.map((r) => r.ms).sort((a, b) => a - b);
const p95 = ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))] : 0;
const rate = report.length ? passed / report.length : 0;
console.log(`\n${passed}/${report.length} passed (${(rate * 100).toFixed(0)}%), leaks: ${leaks}, p95: ${p95} ms`);
if (outFile) fs.writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), passed, total: report.length, p95, report }, null, 2));
process.exit(rate >= 0.9 && leaks === 0 ? 0 : 1);
