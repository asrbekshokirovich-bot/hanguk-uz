// Qirg'iziston Milliy banki kurslari veb-ilova uchun (reja claude/qirgiziston-reja.md, KG4).
// nbkr.kg javobida Access-Control-Allow-Origin yo'q: brauzer (hanguk.uz/ilova) uni o'qiy
// olmaydi va narxlar so'm o'rniga ₩ da qoladi. Bu funksiya ikki XML ni (kunlik — USD,
// haftalik — KRW) bankdan o'zgartirmasdan olib, CORS sarlavhasi bilan qaytaradi. Telefon
// ilovasi bankning o'ziga murojaat qilaveradi. Faqat GET, hech narsa saqlanmaydi.
import { corsHeaders } from "../_shared/cors.ts";

const LISTS = {
  daily: "https://www.nbkr.kg/XML/daily.xml",
  weekly: "https://www.nbkr.kg/XML/weekly.xml",
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return new Response("method", { status: 405, headers: corsHeaders });

  const list = new URL(req.url).searchParams.get("list");
  const src = list === "daily" || list === "weekly" ? LISTS[list] : null;
  if (!src) return new Response("list=daily|weekly", { status: 400, headers: corsHeaders });

  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return new Response("bank", { status: 502, headers: corsHeaders });
    // Baytlar o'zgarmaydi (windows-1251): ilova faqat ASCII qismini — kod va raqamlarni — o'qiydi.
    const body = await res.arrayBuffer();
    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=1800",
      },
    });
  } catch {
    return new Response("bank", { status: 502, headers: corsHeaders });
  }
});
