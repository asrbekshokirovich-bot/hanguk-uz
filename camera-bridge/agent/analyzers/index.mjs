// The AI analysis slot.
//
// Left as a no-op on purpose: the agency has not decided what the AI should
// do yet, and a detector guessing at that would burn CPU and write rows
// nobody asked for. When the decision is made, implement `analyze` here —
// nothing else in the pipeline has to change.
//
// The contract:
//   analyze(event, ctx) -> null | { summary?: string, meta?: object }
// whose return value lands in camera_events.ai_summary / ai_meta.
//
// `event` is a raw Frigate event (id, camera, label, top_score, start_time,
// end_time, has_clip, has_snapshot, zones). `ctx.frigateUrl` lets you fetch
// the snapshot for that event:
//   `${ctx.frigateUrl}/api/events/${event.id}/snapshot.jpg`
//
// Sketch for the Claude-vision option, which would reuse the same pattern as
// the existing request-call-analysis / process-call-recording functions:
//
//   const img = await fetch(`${ctx.frigateUrl}/api/events/${event.id}/snapshot.jpg`);
//   const b64 = Buffer.from(await img.arrayBuffer()).toString('base64');
//   const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/analyze-camera-event`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
//     },
//     body: JSON.stringify({ image: b64, label: event.label }),
//   });
//   const { summary } = await res.json();
//   return { summary, meta: { analyzer: 'claude-vision' } };
//
// Sending a frame to an API means office video leaves the building, which is
// the opposite of how this bridge is currently configured. Confirm that
// trade-off before shipping an analyzer that uploads anything.

export async function analyze(_event, _ctx) {
  return null;
}
