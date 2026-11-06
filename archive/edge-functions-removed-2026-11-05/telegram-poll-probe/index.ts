// Retired: a one-off check for telegram-poll (2026-09-23).
// The real function is telegram-poll; this one does nothing any more.
Deno.serve(() => new Response(JSON.stringify({ error: "retired — use telegram-poll" }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
