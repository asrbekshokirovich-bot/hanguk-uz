// Retired. Was a one-off transcription helper for a maintenance session.
// Recovered 2026-09-07 from the live project (version 5) so a repo deploy
// matches production; safe to delete on both sides.
Deno.serve(() => new Response("gone", { status: 410 }));
