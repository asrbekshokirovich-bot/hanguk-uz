// camera-gate testlari: go2rtc o'rniga soxta server (yo'llar, kalit, WebSocket, HLS, /health).
// Haqiqiy go2rtc bilan sinov — e2e_test.ts (deploy/camera/test/e2e.sh).
import { type GateConfig, loadConfig } from "./config.ts";
import { createGate, type Gate } from "./gate.ts";
import { type CameraClaims, importSecret, signToken } from "./token.ts";
import { assert, assertEquals, HEALTH_KEY, openWs, TEST_SECRET, waitFor } from "./testutil.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 0xff, 0xd9]);
const FTYP = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);

interface Mock {
  url: string;
  requests: string[];
  wsTypes: string[];
  offline: Set<string>;
  server: Deno.HttpServer;
}

function startMock(): Mock {
  const m = { requests: [] as string[], wsTypes: [] as string[], offline: new Set<string>() } as Mock;
  m.server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, (req) => {
    const url = new URL(req.url);
    m.requests.push(url.pathname + url.search);
    if (url.pathname === "/api/frame.jpeg") {
      const src = url.searchParams.get("src");
      if (!src) return new Response("src required", { status: 400 });
      if (m.offline.has(src)) return new Response("dial tcp: i/o timeout", { status: 500 });
      return new Response(JPEG, { headers: { "content-type": "image/jpeg" } });
    }
    if (url.pathname === "/api/ws") {
      const src = url.searchParams.get("src") ?? "";
      const { socket, response } = Deno.upgradeWebSocket(req);
      socket.onopen = () => {
        if (src.startsWith("zal")) socket.close(1000, "no stream");
      };
      socket.onmessage = (e) => {
        const msg = JSON.parse(String(e.data));
        m.wsTypes.push(msg.type);
        if (msg.type === "mse") {
          socket.send(JSON.stringify({ type: "mse", value: 'video/mp4; codecs="avc1.640029"' }));
          socket.send(FTYP);
        }
        if (msg.type === "hls") {
          socket.send(JSON.stringify({
            type: "hls",
            value: "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nhls/playlist.m3u8?id=AbCd1234",
          }));
        }
      };
      return response;
    }
    if (url.pathname === "/api/hls/playlist.m3u8") {
      return new Response("#EXTM3U\n#EXT-X-VERSION:6\n", {
        headers: { "content-type": "application/vnd.apple.mpegurl" },
      });
    }
    return new Response("404 page not found", { status: 404 });
  });
  m.url = `http://127.0.0.1:${(m.server.addr as Deno.NetAddr).port}`;
  return m;
}

interface Env {
  mock: Mock;
  gate: Gate;
  base: string;
  wsBase: string;
  logs: { ev: string; f: Record<string, unknown> }[];
  token: (cams?: string[], over?: Partial<CameraClaims>) => Promise<string>;
  close: () => Promise<void>;
}

async function setup(over: Partial<GateConfig> = {}, env: Record<string, string> = {}): Promise<Env> {
  const mock = startMock();
  const cfg: GateConfig = {
    ...loadConfig((n) =>
      ({ GATE_SECRET: TEST_SECRET, HEALTH_KEY, CAMERAS: "kirish,zal", GO2RTC_URL: mock.url, ...env } as Record<
        string,
        string
      >)[n]
    ),
    ...over,
  };
  const key = await importSecret(TEST_SECRET);
  const logs: Env["logs"] = [];
  const gate = createGate(cfg, key, { log: (ev, f = {}) => logs.push({ ev, f }) });
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, gate.handler);
  const base = `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`;
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    mock,
    gate,
    base,
    wsBase: base.replace("http", "ws"),
    logs,
    token: (cams = ["kirish"], o = {}) =>
      signToken(key, { u: "user-1", c: cams, iat: nowSec, exp: nowSec + 300, ...o }),
    close: async () => {
      await waitFor(() => gate.stats().sessions === 0);
      await server.shutdown();
      await mock.server.shutdown();
    },
  };
}

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  const body = new Uint8Array(await res.arrayBuffer());
  return { res, body, text: new TextDecoder().decode(body) };
}

Deno.test("yo'llar: faqat 4 ta yo'l ochiq, go2rtc sozlash API'si ko'rinmaydi", async () => {
  const e = await setup();
  for (
    const p of [
      "/",
      "/api",
      "/api/streams",
      "/api/config",
      "/api/restart",
      "/api/exit",
      "/api/webrtc?src=kirish",
      "/api/stream.mp4?src=kirish",
      "/api/ws?src=kirish",
      "/api/frame.jpeg/../streams",
      "/health",
    ]
  ) {
    const { res } = await get(e.base + p);
    assertEquals(res.status, 404, p);
  }
  const post = await fetch(e.base + "/api/frame.jpeg?src=kirish", { method: "POST" });
  await post.body?.cancel();
  assertEquals(post.status, 404, "POST");
  assertEquals(e.mock.requests, [], "go2rtc'ga hech narsa bormasin");
  await e.close();
});

Deno.test("rasm: kalit, kamera ruxsati va go2rtc'ga faqat src+cache boradi", async () => {
  const e = await setup();
  assertEquals((await get(e.base + "/api/frame.jpeg?src=kirish")).res.status, 401, "kalitsiz");
  const zalOnly = await e.token(["zal"]);
  assertEquals((await get(`${e.base}/api/frame.jpeg?src=kirish&t=${zalOnly}`)).res.status, 403, "boshqa kamera");
  const all = await e.token(["*"]);
  assertEquals((await get(`${e.base}/api/frame.jpeg?src=ombor&t=${all}`)).res.status, 404, "noma'lum kamera");
  assertEquals((await get(`${e.base}/api/frame.jpeg?src=Kirish&t=${all}`)).res.status, 400, "noto'g'ri nom");
  assertEquals((await get(`${e.base}/api/frame.jpeg?src=kirish&q=4k&t=${all}`)).res.status, 400, "noto'g'ri sifat");
  assertEquals(e.mock.requests, [], "rad etilganlar go2rtc'ga bormasin");

  const t = await e.token();
  const ok = await get(`${e.base}/api/frame.jpeg?src=kirish&t=${t}&hw=vaapi&rotate=90`);
  assertEquals(ok.res.status, 200);
  assertEquals(ok.res.headers.get("content-type"), "image/jpeg");
  assertEquals(ok.res.headers.get("cache-control"), "no-store");
  assertEquals(Array.from(ok.body), Array.from(JPEG));
  const hd = await get(`${e.base}/api/frame.jpeg?src=kirish&q=hd&t=${t}`);
  assertEquals(hd.res.status, 200);
  assertEquals(e.mock.requests, [
    "/api/frame.jpeg?src=kirish_sub&cache=8s",
    "/api/frame.jpeg?src=kirish&cache=8s",
  ]);

  e.mock.offline.add("kirish_sub");
  const off = await get(`${e.base}/api/frame.jpeg?src=kirish&t=${t}`);
  assertEquals(off.res.status, 504, "kamera o'chiq");
  await e.close();
});

Deno.test("jonli: Origin va kalit ulanishdan oldin tekshiriladi", async () => {
  const e = await setup();
  const t = await e.token();
  const reject = async (url: string, origin: string) => {
    const res = await e.gate.handler(new Request(url, { headers: { upgrade: "websocket", origin } }));
    await res.body?.cancel();
    return res.status;
  };
  assertEquals(await reject(`${e.base}/api/ws?src=kirish&t=${t}`, "https://evil.example"), 403, "begona sayt");
  assertEquals(await reject(`${e.base}/api/ws?src=kirish&t=${t}`, ""), 403, "Origin'siz");
  assertEquals(await reject(`${e.base}/api/ws?src=kirish`, "https://hanguk.uz"), 401, "kalitsiz");
  assertEquals(await reject(`${e.base}/api/ws?src=zal&t=${t}`, "https://hanguk.uz"), 403, "ruxsatsiz kamera");
  assertEquals(e.mock.requests, []);
  await e.close();
});

Deno.test("jonli: MSE o'tadi, webrtc xabari to'xtatiladi, HLS faqat berilgan id bilan", async () => {
  const e = await setup();
  const t = await e.token();
  const p = openWs(`${e.wsBase}/api/ws?src=kirish&q=sd&t=${t}`);
  await p.opened;
  p.ws.send(JSON.stringify({ type: "webrtc/offer", value: "v=0" }));
  p.ws.send(JSON.stringify({ type: "mse", value: "avc1.640029" }));
  await waitFor(() => p.messages.length >= 2);
  assertEquals(JSON.parse(p.messages[0] as string).type, "mse");
  assert(p.messages[1] instanceof ArrayBuffer, "video bo'lagi binary bo'lsin");
  assertEquals(e.mock.wsTypes, ["mse"], "webrtc/offer go2rtc'ga bormasin");
  assert(e.mock.requests.includes("/api/ws?src=kirish_sub"), "sd → kirish_sub");
  assert(e.logs.some((l) => l.ev === "drop" && l.f.type === "webrtc/offer"), "drop jurnalda");

  assertEquals((await get(`${e.base}/api/hls/playlist.m3u8?id=AbCd1234`)).res.status, 404, "id hali berilmagan");
  p.ws.send(JSON.stringify({ type: "hls", value: "avc1.640029" }));
  await waitFor(() => p.messages.length >= 3);
  const pl = await get(`${e.base}/api/hls/playlist.m3u8?id=AbCd1234`);
  assertEquals(pl.res.status, 200, "berilgan id");
  assert(pl.text.startsWith("#EXTM3U"));
  assertEquals((await get(`${e.base}/api/hls/playlist.m3u8?id=Boshqa999`)).res.status, 404, "begona id");
  assertEquals((await get(`${e.base}/api/hls/segment.m4s?id=AbCd1234&n=x1`)).res.status, 400, "n raqam bo'lsin");
  assertEquals(e.gate.stats().sessions, 1);

  p.ws.close();
  await p.closed;
  await e.close();
});

Deno.test("jonli: noto'g'ri xabar 1008, go2rtc yopsa 1011, vaqt tugasa 4000", async () => {
  const e = await setup({ sessionMaxSec: 1 });
  const t = await e.token(["kirish", "zal"]);

  const bad = openWs(`${e.wsBase}/api/ws?src=kirish&t=${t}`);
  await bad.opened;
  bad.ws.send("bu json emas");
  assertEquals((await bad.closed).code, 1008);

  const gone = openWs(`${e.wsBase}/api/ws?src=zal&t=${t}`);
  await gone.opened;
  assertEquals((await gone.closed).code, 1011);

  const long = openWs(`${e.wsBase}/api/ws?src=kirish&t=${t}`);
  await long.opened;
  const ev = await long.closed;
  assertEquals([ev.code, ev.reason], [4000, "session_max"]);
  await e.close();
});

Deno.test("jonli: bir vaqtdagi ulanishlar cheklanadi", async () => {
  const e = await setup({ maxSessionsPerUser: 1, maxSessions: 2 });
  const t = await e.token();
  const first = openWs(`${e.wsBase}/api/ws?src=kirish&t=${t}`);
  await first.opened;
  await waitFor(() => e.gate.stats().sessions === 1);
  const res = await e.gate.handler(
    new Request(`${e.base}/api/ws?src=kirish&t=${t}`, {
      headers: { upgrade: "websocket", origin: "https://hanguk.uz" },
    }),
  );
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error, "busy_user");
  first.ws.close();
  await first.closed;
  await e.close();
});

Deno.test("health: kalitsiz 404; go2rtc va har kamera holati", async () => {
  const e = await setup();
  assertEquals((await get(e.base + "/health")).res.status, 404, "kalitsiz");
  assertEquals(
    (await get(e.base + "/health", { "x-health-key": HEALTH_KEY + "x" })).res.status,
    404,
    "noto'g'ri kalit",
  );

  e.mock.offline.add("zal_sub");
  const h = await get(e.base + "/health", { "x-health-key": HEALTH_KEY });
  assertEquals(h.res.status, 200);
  const body = JSON.parse(h.text);
  assertEquals([body.ok, body.go2rtc, body.cameras.kirish.online, body.cameras.zal.online], [false, true, true, false]);
  assertEquals(body.cameras.zal.error, "http_500");
  assert(e.mock.requests.includes("/api/frame.jpeg?src=kirish_sub&cache=1m"), "kesh 1m");

  await e.mock.server.shutdown();
  const down = JSON.parse((await get(e.base + "/health", { "x-health-key": HEALTH_KEY })).text);
  assertEquals([down.ok, down.go2rtc, down.cameras.kirish.error], [false, false, "go2rtc_down"]);
  await e.close().catch(() => {});
});
