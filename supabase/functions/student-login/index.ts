// student-login (v1) o'chirildi (xavfsizlik, 2026-11-05). U parolni
// `student-<uuid>-hanguk-A1!` ko'rinishida yaratardi — akkaunt emailidan
// hisoblab topish mumkin edi. Ilova ham, sayt ham student-login-v2'ni ishlatadi
// (v1'ga oxirgi 24 soatda chaqiruv yo'q).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  return new Response(JSON.stringify({ error: "gone", use: "student-login-v2" }), {
    status: 410,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
