// Mirrors camera event METADATA from Frigate into Supabase.
//
// What crosses the network boundary: timestamps, labels, scores, and the
// on-disk path of the clip. What never crosses it: the video itself. The CRM
// renders a timeline from these rows; playing a clip requires reaching the
// bridge, which is exactly the property the agency asked for.

import { createClient } from '@supabase/supabase-js';
import { analyze } from './analyzers/index.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FRIGATE_URL = (process.env.FRIGATE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const POLL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS || 15);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[agent] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

// Service role: the camera tables are owner/admin-only under RLS, and the
// agent is neither. It writes as the service role and stays on the bridge.
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const log = (...args) => console.log(`[agent ${new Date().toISOString()}]`, ...args);

/** stream_key -> camera row id. Refreshed each cycle so new cameras get picked up. */
async function loadCameras() {
  const { data, error } = await supabase
    .from('cameras')
    .select('id, stream_key')
    .eq('is_active', true);
  if (error) throw new Error(`loading cameras: ${error.message}`);
  return new Map((data || []).map((c) => [c.stream_key, c.id]));
}

/**
 * Resume point. Frigate's own database is the source of truth for events, so
 * on restart we ask it for everything newer than the latest row we stored
 * rather than keeping a cursor file that can drift.
 */
async function lastSyncedEpoch() {
  const { data, error } = await supabase
    .from('camera_events')
    .select('started_at')
    .eq('source', 'frigate')
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`reading watermark: ${error.message}`);
  if (!data?.length) return Math.floor(Date.now() / 1000) - 3600; // cold start: last hour
  return Math.floor(new Date(data[0].started_at).getTime() / 1000);
}

async function fetchEvents(afterEpoch) {
  const url = `${FRIGATE_URL}/api/events?after=${afterEpoch}&limit=100&include_thumbnails=0`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`frigate ${res.status} ${res.statusText}`);
  return res.json();
}

function toRow(event, cameraId, enrichment) {
  return {
    camera_id: cameraId,
    source: 'frigate',
    external_id: event.id,
    label: event.sub_label || event.label || null,
    score: event.top_score ?? event.score ?? null,
    started_at: new Date(event.start_time * 1000).toISOString(),
    ended_at: event.end_time ? new Date(event.end_time * 1000).toISOString() : null,
    // Paths inside the bridge's own media volume, not URLs.
    clip_path: event.has_clip ? `clips/${event.camera}-${event.id}.mp4` : null,
    thumb_path: event.has_snapshot ? `clips/${event.camera}-${event.id}.jpg` : null,
    ai_summary: enrichment?.summary ?? null,
    ai_meta: enrichment?.meta ?? {},
  };
}

async function syncOnce() {
  const cameras = await loadCameras();
  if (cameras.size === 0) {
    log('no active cameras registered in Supabase — nothing to sync');
    return;
  }

  const after = await lastSyncedEpoch();
  const events = await fetchEvents(after);
  if (!events.length) return;

  const rows = [];
  for (const event of events) {
    const cameraId = cameras.get(event.camera);
    if (!cameraId) {
      // A Frigate camera nobody registered in the CRM. Skipping is correct —
      // creating rows for it would produce a timeline with no owner.
      log(`skipping event for unregistered camera "${event.camera}"`);
      continue;
    }
    // The analyzer slot. Default implementation is a no-op until the agency
    // picks what the AI should actually do.
    let enrichment = null;
    try {
      enrichment = await analyze(event, { frigateUrl: FRIGATE_URL });
    } catch (err) {
      log(`analyzer failed for ${event.id}:`, err.message);
    }
    rows.push(toRow(event, cameraId, enrichment));
  }

  if (!rows.length) return;

  // Idempotent: (source, external_id) is unique, so re-polling the same
  // window updates rows instead of duplicating them. That matters because
  // Frigate keeps mutating an event until the object leaves the frame.
  const { error } = await supabase
    .from('camera_events')
    .upsert(rows, { onConflict: 'source,external_id' });
  if (error) throw new Error(`upserting events: ${error.message}`);
  log(`synced ${rows.length} event(s)`);
}

async function main() {
  log(`polling ${FRIGATE_URL} every ${POLL_SECONDS}s`);
  for (;;) {
    try {
      await syncOnce();
    } catch (err) {
      // Never exit on a transient failure — the bridge has to survive Frigate
      // restarts and office internet drops without manual intervention.
      log('sync failed:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
  }
}

main();
