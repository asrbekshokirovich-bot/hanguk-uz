// Haqiqiy go2rtc bilan sinov. Ishga tushirish: bash deploy/camera/test/e2e.sh
// (soxta kamera — ffmpeg test tasviri; ishlab chiqarishdagi go2rtc.yaml aynan o'zi ishlatiladi).
import { assert, assertEquals, openWs, waitFor } from "./testutil.ts";
import { importSecret, signToken } from "./token.ts";

const GATE = Deno.env.get("E2E_GATE_URL");
const GO2RTC = Deno.env.get("E2E_GO2RTC_URL");
const SECRET = Deno.env.get("E2E_SECRET") ?? "";
const HEALTH = Deno.env.get("E2E_HEALTH_KEY") ?? "";
const ignore = !GATE || !GO2RTC;

async function token(cams: string[]) {
  const now = Math.floor(Date.now() / 1000);
  return signToken(await importSecret(SECRET), { u: "e2e-user", c: cams, iat: now, exp: now + 300 });
}

Deno.test({ name: "e2e: go2rtc sozlash API'si va portlari yopiq", ignore }, async () => {
  for (
    const p of ["/", "/api", "/api/streams", "/api/config", "/api/restart", "/api/webrtc?src=kirish", "/stream.html"]
  ) {
    const res = await fetch(GO2RTC + p);
    await res.body?.cancel();
    assertEquals(res.status, 404, `go2rtc ${p}`);
  }
  for (const port of [8554, 8555, 8443]) {
    let open = false;
    try {
      const conn = await Deno.connect({ hostname: "127.0.0.1", port });
      conn.close();
      open = true;
    } catch {
      open = false;
    }
    assertEquals(open, false, `port ${port} yopiq bo'lsin`);
  }
});

Deno.test({ name: "e2e: rasm gate orqali — haqiqiy JPEG; o'chiq kamera 504", ignore }, async () => {
  const t = await token(["kirish", "zal"]);
  const res = await fetch(`${GATE}/api/frame.jpeg?src=kirish&t=${t}`);
  const body = new Uint8Array(await res.arrayBuffer());
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "image/jpeg");
  assert(body.length > 1000 && body[0] === 0xff && body[1] === 0xd8, "JPEG bo'lsin");
  const off = await fetch(`${GATE}/api/frame.jpeg?src=zal&t=${t}`);
  await off.body?.cancel();
  assertEquals(off.status, 504);
});

Deno.test({ name: "e2e: jonli MSE gate orqali — kodek va video bo'laklari", ignore }, async () => {
  const t = await token(["kirish"]);
  const p = openWs(`${GATE!.replace("http", "ws")}/api/ws?src=kirish&q=hd&t=${t}`);
  await p.opened;
  p.ws.send(JSON.stringify({ type: "mse", value: "avc1.640029,avc1.64002A,avc1.640033,hvc1.1.6.L153.B0,mp4a.40.2" }));
  await waitFor(() => p.messages.filter((m) => m instanceof ArrayBuffer).length >= 3, 15000);
  const first = JSON.parse(p.messages[0] as string);
  assertEquals(first.type, "mse");
  assert(String(first.value).includes("avc1"), "H.264 kodek");
  const bytes = p.messages.filter((m) => m instanceof ArrayBuffer).reduce(
    (n, m) => n + (m as ArrayBuffer).byteLength,
    0,
  );
  assert(bytes > 10_000, `video keldi: ${bytes} bayt`);
  p.ws.close();
  await p.closed;
});

Deno.test({ name: "e2e: HLS (eski iPhone) — faqat seansda berilgan id ochiladi", ignore }, async () => {
  const t = await token(["kirish"]);
  const p = openWs(`${GATE!.replace("http", "ws")}/api/ws?src=kirish&q=sd&t=${t}`);
  await p.opened;
  p.ws.send(JSON.stringify({ type: "hls", value: "avc1.640029,mp4a.40.2" }));
  await waitFor(() => p.messages.length >= 1, 15000);
  const msg = JSON.parse(p.messages[0] as string);
  assertEquals(msg.type, "hls");
  const id = /id=([A-Za-z0-9_-]+)/.exec(msg.value)?.[1];
  assert(id, "playlist'da id bo'lsin");
  const master = await fetch(`${GATE}/api/hls/playlist.m3u8?id=${id}`);
  const text = await master.text();
  assertEquals(master.status, 200);
  assert(text.startsWith("#EXTM3U"), "m3u8");
  const wrong = await fetch(`${GATE}/api/hls/playlist.m3u8?id=Begona1234`);
  await wrong.body?.cancel();
  assertEquals(wrong.status, 404);
  p.ws.close();
  await p.closed;
});

Deno.test({ name: "e2e: /health — kirish onlayn, zal oflayn", ignore }, async () => {
  const res = await fetch(`${GATE}/health`, { headers: { "x-health-key": HEALTH } });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals([body.go2rtc, body.cameras.kirish.online, body.cameras.zal.online], [true, true, false]);
});
