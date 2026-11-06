// orbit-app — serves the Orbit dashboard SPA. Proxies the static build from the
// public `orbit-web` storage bucket, re-serving each file with the correct
// Content-Type (Supabase Storage forces text/plain on .html, which breaks SPAs).
// Public (verify_jwt = false); it serves only the static front-end bundle.
const STORAGE = "https://lysjdtyanhdfphqyijsr.supabase.co/storage/v1/object/public/orbit-web";
const CT: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8",
  png: "image/png", svg: "image/svg+xml", json: "application/json", ico: "image/x-icon", woff2: "font/woff2",
};

Deno.serve(async (req) => {
  const u = new URL(req.url);
  let path = u.pathname.split("/orbit-app")[1] || "/";
  if (path === "" || path === "/") path = "/index.html";
  const ext = path.split(".").pop()!.toLowerCase();

  const res = await fetch(STORAGE + path);
  if (!res.ok) {
    // SPA fallback — unknown paths return index.html
    const idx = await fetch(STORAGE + "/index.html");
    return new Response(await idx.text(), { headers: { "Content-Type": CT.html } });
  }
  const body = await res.arrayBuffer();
  return new Response(body, {
    headers: { "Content-Type": CT[ext] || "application/octet-stream", "Cache-Control": "public, max-age=300" },
  });
});
