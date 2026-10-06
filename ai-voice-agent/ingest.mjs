// After a call ends, ship what we learned to the ai-call-ingest edge function,
// which writes it into the CRM (calls + call_transcripts + call_analyses) using
// the same identity spine as human calls. Best-effort with a couple of retries.

export async function ingestCall(session) {
  const url = process.env.INGEST_URL;
  const secret = process.env.AI_AGENT_INGEST_SECRET;
  if (!url || !secret) {
    console.warn('[ingest] INGEST_URL / AI_AGENT_INGEST_SECRET not set — skipping');
    return;
  }

  const body = {
    external_call_id: session.correlationId,
    voip_provider: 'azure_ai',
    direction: session.direction, // 'inbound' | 'outbound'
    phone_number: session.phone,
    status: session.status || 'completed',
    started_at: session.startedAt,
    ended_at: new Date().toISOString(),
    duration: Math.max(0, Math.round((Date.now() - session.startedAtMs) / 1000)),
    recording_url: session.recordingUrl || null,
    transcript_text: session.transcriptText || '',
    segments: session.segments || [],
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ingest-secret': secret },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      console.error('[ingest] non-200:', res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      console.error('[ingest] attempt failed:', e?.message || e);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
}
