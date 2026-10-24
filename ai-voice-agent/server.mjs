// Always-on media bridge for the Hanguk AI voice agent.
//
//   inbound:  Event Grid IncomingCall  → answer + stream → RealtimeBridge
//   outbound: POST /outbound           → createCall + stream → RealtimeBridge
//   both:     ACS media WebSocket  ⇄  Azure OpenAI Realtime  ⇄  the caller
//             on hang-up → POST transcript/summary to ai-call-ingest
//
// Run: `node server.mjs` (see .env.example / AI_VOICE_AGENT.md).

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { answerInbound, placeOutbound, hangUp } from './acs.mjs';
import { RealtimeBridge } from './realtimeBridge.mjs';
import { ingestCall } from './ingest.mjs';

const PORT = Number(process.env.PORT || 8080);

// correlationId -> session. A session lives from call setup to hang-up.
const sessions = new Map();

function newSession(fields) {
  const correlationId = fields.correlationId || randomUUID();
  const s = {
    correlationId,
    callConnectionId: null,
    direction: fields.direction, // 'inbound' | 'outbound'
    phone: fields.phone || 'unknown',
    goal: fields.goal || null,
    context: fields.context || null,
    displayName: fields.displayName || null,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    status: 'in_progress',
    recordingUrl: null,
    bridge: null,
    mediaWs: null,
    finalized: false,
  };
  sessions.set(correlationId, s);
  return s;
}

async function finalize(s, status = 'completed') {
  if (!s || s.finalized) return;
  s.finalized = true;
  s.status = status;
  try {
    if (s.bridge) {
      s.transcriptText = s.bridge.getTranscriptText();
      s.segments = s.bridge.getSegments();
      s.bridge.close();
    }
  } catch (e) { console.error('[finalize] bridge close:', e?.message || e); }
  try { await ingestCall(s); } catch (e) { console.error('[finalize] ingest:', e?.message || e); }
  sessions.delete(s.correlationId);
  console.log(`[call ${s.correlationId}] finalized (${status})`);
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => res.json({ ok: true, service: 'hanguk-ai-voice-agent', live: sessions.size }));

// Event Grid: subscription validation handshake + IncomingCall.
app.post('/acs/events', async (req, res) => {
  const events = Array.isArray(req.body) ? req.body : [req.body];

  for (const ev of events) {
    const type = ev.eventType || ev.type;

    if (type === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
      return res.json({ validationResponse: ev.data?.validationCode });
    }

    if (type === 'Microsoft.Communication.IncomingCall') {
      const data = ev.data || {};
      const incomingCallContext = data.incomingCallContext;
      const from = data.from?.phoneNumber?.value || data.from?.rawId || 'unknown';
      const correlationId = data.correlationId || randomUUID();
      const s = newSession({ correlationId, direction: 'inbound', phone: from });
      try {
        s.callConnectionId = await answerInbound(incomingCallContext, correlationId);
        console.log(`[call ${correlationId}] inbound answered from ${from}`);
      } catch (e) {
        console.error('[events] answer failed:', e?.message || e);
        await finalize(s, 'failed');
      }
    }
  }
  res.sendStatus(200);
});

// ACS call-lifecycle callbacks (CloudEvents array).
app.post('/acs/callbacks', async (req, res) => {
  const cid = req.query.cid;
  const s = cid ? sessions.get(cid) : null;
  const events = Array.isArray(req.body) ? req.body : [req.body];

  for (const ev of events) {
    const type = ev.type || ev.eventType || '';
    if (!s) continue;
    if (type.endsWith('CallConnected')) {
      s.callConnectionId = ev.data?.callConnectionId || s.callConnectionId;
      console.log(`[call ${s.correlationId}] connected`);
    } else if (type.endsWith('CallDisconnected')) {
      await finalize(s, 'completed');
    } else if (type.endsWith('RecordingFileStatusUpdated')) {
      // If ACS Call Recording is enabled, capture the URL for the pipeline.
      const loc = ev.data?.recordingStorageInfo?.recordingChunks?.[0]?.contentLocation;
      if (loc) s.recordingUrl = loc;
    }
  }
  res.sendStatus(200);
});

// Outbound trigger — called by the ai-place-call edge function.
app.post('/outbound', async (req, res) => {
  if ((req.get('x-agent-secret') || '') !== (process.env.AGENT_SECRET || '\0')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { phone, goal, context, displayName } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const s = newSession({ direction: 'outbound', phone, goal, context, displayName });
  try {
    s.callConnectionId = await placeOutbound(phone, s.correlationId);
    console.log(`[call ${s.correlationId}] outbound dialing ${phone}`);
    res.json({ ok: true, correlationId: s.correlationId });
  } catch (e) {
    console.error('[outbound] createCall failed:', e?.message || e);
    await finalize(s, 'failed');
    res.status(502).json({ error: 'dial failed' });
  }
});

// ---------------------------------------------------------------------------
// ACS media WebSocket  ⇄  RealtimeBridge
// ---------------------------------------------------------------------------
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const { pathname, searchParams } = new URL(request.url, 'http://localhost');
  if (pathname !== '/acs/media') return socket.destroy();
  const cid = searchParams.get('cid');
  const s = cid ? sessions.get(cid) : null;
  if (!s) { socket.destroy(); return; }
  wss.handleUpgrade(request, socket, head, (ws) => attachMedia(ws, s));
});

function attachMedia(ws, s) {
  s.mediaWs = ws;
  console.log(`[call ${s.correlationId}] media stream open`);

  const sendToAcs = (b64Pcm) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ kind: 'AudioData', audioData: { data: b64Pcm } }));
    }
  };
  const stopAcsPlayback = () => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ kind: 'StopAudio', stopAudio: {} }));
  };

  const bridge = new RealtimeBridge({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_REALTIME_API_VERSION || '2024-10-01-preview',
    voice: process.env.AZURE_OPENAI_REALTIME_VOICE || 'alloy',
    call: { direction: s.direction, goal: s.goal, context: s.context, displayName: s.displayName },
    onAudioToAcs: sendToAcs,
    onBargeIn: stopAcsPlayback,
  }).connect();
  s.bridge = bridge;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    // ACS media frames: AudioMetadata (once) then AudioData frames.
    if (msg.kind === 'AudioData' && msg.audioData?.data && !msg.audioData.silent) {
      bridge.pushCallerAudio(msg.audioData.data);
    }
  });

  ws.on('close', () => {
    console.log(`[call ${s.correlationId}] media stream closed`);
    // Media socket closing usually coincides with hang-up; CallDisconnected
    // finalizes, but guard in case that event is missed.
    setTimeout(() => finalize(s, 'completed'), 2000);
  });
  ws.on('error', (e) => console.error('[media] ws error:', e?.message || e));
}

httpServer.listen(PORT, () => {
  console.log(`hanguk-ai-voice-agent listening on :${PORT}`);
  for (const k of ['ACS_CONNECTION_STRING', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'PUBLIC_WS_URL']) {
    if (!process.env[k]) console.warn(`[warn] ${k} is not set`);
  }
});
