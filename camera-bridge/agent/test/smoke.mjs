// Smoke test for the bridge agent — runs without a camera, without Docker,
// and without touching the real Supabase project.
//
// It stands up a fake Frigate and a fake Supabase REST API, runs the real
// agent against them, and asserts the row it tries to write. That covers the
// part most likely to be wrong (field mapping, epoch->ISO conversion, clip
// paths, camera lookup by stream_key) before anyone drives to the office.
//
//   node test/smoke.mjs

import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const agentEntry = path.join(here, '..', 'index.mjs');

const CAMERA_ID = '11111111-1111-1111-1111-111111111111';

// One finished person event, exactly the shape Frigate's /api/events returns.
const FRIGATE_EVENT = {
  id: '1753440000.123456-abcdef',
  camera: 'office',
  label: 'person',
  sub_label: null,
  top_score: 0.87,
  start_time: 1753440000,
  end_time: 1753440042,
  has_clip: true,
  has_snapshot: true,
};

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
  });
}

const state = { upserted: null, onConflict: null, preferHeader: null };

const frigate = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/events') {
    // The agent must ask for events after its watermark, not for everything.
    if (!url.searchParams.has('after')) {
      fail('agent did not send an "after" cursor to Frigate');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([FRIGATE_EVENT]));
    return;
  }
  res.writeHead(404).end();
});

const supabase = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (payload) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  if (req.method === 'GET' && url.pathname === '/rest/v1/cameras') {
    return json([{ id: CAMERA_ID, stream_key: 'office' }]);
  }
  if (req.method === 'GET' && url.pathname === '/rest/v1/camera_events') {
    return json([]); // cold start: no watermark yet
  }
  if (req.method === 'POST' && url.pathname === '/rest/v1/camera_events') {
    state.upserted = JSON.parse(await readBody(req));
    state.onConflict = url.searchParams.get('on_conflict');
    state.preferHeader = req.headers.prefer || '';
    return json([]);
  }
  res.writeHead(404).end();
});

const failures = [];
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}
function fail(message) {
  console.error(`\nfatal: ${message}`);
  process.exit(1);
}

const frigatePort = await listen(frigate);
const supabasePort = await listen(supabase);

const child = spawn(process.execPath, [agentEntry], {
  env: {
    ...process.env,
    SUPABASE_URL: `http://127.0.0.1:${supabasePort}`,
    // Shape-valid dummy key; the fake server never verifies it.
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    FRIGATE_URL: `http://127.0.0.1:${frigatePort}`,
    POLL_INTERVAL_SECONDS: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const agentLog = [];
child.stdout.on('data', (d) => agentLog.push(String(d)));
child.stderr.on('data', (d) => agentLog.push(String(d)));

// Wait for the agent to complete one cycle.
const deadline = Date.now() + 20_000;
while (!state.upserted && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 250));
}

child.kill();
frigate.close();
supabase.close();

console.log('\nbridge agent smoke test\n');

if (!state.upserted) {
  console.log(agentLog.join(''));
  fail('agent never wrote an event within 20s');
}

const row = state.upserted[0];

check('writes exactly one row', state.upserted.length === 1, `got ${state.upserted.length}`);
check('resolves camera by stream_key', row.camera_id === CAMERA_ID, row.camera_id);
check('keeps Frigate id for idempotency', row.external_id === FRIGATE_EVENT.id, row.external_id);
check('upserts on the unique key', state.onConflict === 'source,external_id', state.onConflict);
check(
  'asks PostgREST to merge duplicates',
  state.preferHeader.includes('merge-duplicates'),
  state.preferHeader,
);
check('maps the label', row.label === 'person', row.label);
check('maps the score', Number(row.score) === 0.87, String(row.score));
check(
  'converts start epoch to ISO',
  row.started_at === new Date(1753440000 * 1000).toISOString(),
  row.started_at,
);
check(
  'converts end epoch to ISO',
  row.ended_at === new Date(1753440042 * 1000).toISOString(),
  row.ended_at,
);
check(
  'clip path stays a bridge-local path, not a URL',
  row.clip_path === `clips/office-${FRIGATE_EVENT.id}.mp4` && !/^https?:/.test(row.clip_path),
  row.clip_path,
);
check(
  'thumb path stays a bridge-local path',
  row.thumb_path === `clips/office-${FRIGATE_EVENT.id}.jpg`,
  row.thumb_path,
);
check('analyzer slot is empty by default', row.ai_summary === null, String(row.ai_summary));
// The whole design rests on video staying in the office, so assert the
// payload carries references only: no encoded bytes, and small enough that
// it cannot be hiding a frame.
const payload = JSON.stringify(state.upserted);
check(
  'no encoded media in the payload',
  !/base64|data:image/i.test(payload),
  'payload contained encoded image data',
);
check('payload is metadata-sized', payload.length < 2048, `${payload.length} bytes`);

console.log(
  failures.length
    ? `\n${failures.length} check(s) failed\n`
    : '\nall checks passed\n',
);
process.exit(failures.length ? 1 : 0);
