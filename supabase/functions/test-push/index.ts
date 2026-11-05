// test-push o'chirildi (xavfsizlik, 2026-11-05): u kodga yozilgan sobit parol
// bilan istalgan FCM tokenga istalgan push yubora olardi. Sinov push'lari
// uchun send-push-notification ishlatiladi.
Deno.serve(() =>
  new Response(JSON.stringify({ error: "gone" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
