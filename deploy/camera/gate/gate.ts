// camera-gate: go2rtc oldidagi yagona eshik.
//
// Ochiq yo'llar (qolgani 404):
//   GET /api/ws?src=<kamera>&q=hd|sd&t=<kalit>     jonli video (WebSocket: MSE, eski iPhone — HLS)
//   GET /api/frame.jpeg?src=<kamera>&q=sd|hd&t=…   rasm
//   GET /api/hls/{playlist.m3u8,init.mp4,segment.m4s,segment.ts}?id=…
//                                                  faqat ruxsatli WebSocket seansida go2rtc bergan id
//   GET /health  (x-health-key sarlavhasi bilan)    kuzatuv: go2rtc va har kamera holati
//
// go2rtc o'zi faqat 127.0.0.1 da tinglaydi; tashqaridan unga faqat shu fayl orqali yetiladi.
import type { GateConfig } from "./config.ts";
import { allowsCamera, CAMERA_ID_RE, type CameraClaims, verifyToken } from "./token.ts";

/** Brauzerdan go2rtc'ga o'tkaziladigan xabar turlari. webrtc* yo'q: ofisdan UDP chiqmasin. */
const CLIENT_MESSAGE_TYPES = new Set(["mse", "hls", "mp4", "mjpeg"]);
const HLS_PATHS = new Set([
  "/api/hls/playlist.m3u8",
  "/api/hls/init.mp4",
  "/api/hls/segment.m4s",
  "/api/hls/segment.ts",
]);
const HLS_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const HLS_IDLE_MS = 60_000;
const MAX_CLIENT_MESSAGE = 8192;
const MAX_PENDING = 8;
const SLOW_CLIENT_BYTES = 8 * 1024 * 1024;
const SNAPSHOT_TIMEOUT_MS = 15_000;
const HLS_TIMEOUT_MS = 20_000;
const HEALTH_TIMEOUT_MS = 12_000;

const BASE_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

export type Quality = "hd" | "sd";
export type LogFn = (event: string, fields?: Record<string, unknown>) => void;

export interface GateOptions {
  /** Hozirgi vaqt, ms (testlar uchun). */
  now?: () => number;
  log?: LogFn;
  fetch?: typeof fetch;
}

interface Session {
  id: number;
  user: string;
  camera: string;
  quality: Quality;
  openedAt: number;
  bytes: number;
}

interface HlsGrant {
  user: string;
  camera: string;
  lastSeen: number;
  hardUntil: number;
}

export interface CameraHealth {
  online: boolean;
  ms: number;
  error?: string;
}

export interface Gate {
  handler: (req: Request, info?: Deno.ServeHandlerInfo) => Promise<Response>;
  stats: () => { sessions: number; hlsGrants: number };
}

export function defaultLog(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), ev: event, ...fields }));
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "content-type": "application/json; charset=utf-8" },
  });
}

/** Uzunligi teng bo'lmasa ham vaqt bo'yicha bir xil taqqoslash. */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function parseClientMessage(data: unknown): { type: string } | null {
  if (typeof data !== "string" || data.length > MAX_CLIENT_MESSAGE) return null;
  try {
    const msg = JSON.parse(data);
    if (msg && typeof msg === "object" && typeof msg.type === "string" && msg.type.length <= 32) {
      return { type: msg.type };
    }
  } catch {
    // pastda null
  }
  return null;
}

function clientIp(req: Request, info?: Deno.ServeHandlerInfo): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const addr = info?.remoteAddr as Deno.NetAddr | undefined;
  return addr?.hostname;
}

export function streamName(camera: string, quality: Quality): string {
  return quality === "sd" ? `${camera}_sub` : camera;
}

export function createGate(cfg: GateConfig, key: CryptoKey, opts: GateOptions = {}): Gate {
  const now = opts.now ?? Date.now;
  const log = opts.log ?? defaultLog;
  const doFetch = opts.fetch ?? fetch;
  const cameras = new Set(cfg.cameras);
  const origins = new Set(cfg.origins);
  const sessions = new Set<Session>();
  const hlsGrants = new Map<string, HlsGrant>();
  let nextSessionId = 1;

  type Auth =
    | { ok: true; claims: CameraClaims; camera: string; quality: Quality }
    | { ok: false; res: Response };

  async function authorize(url: URL, fallback: Quality, ip?: string): Promise<Auth> {
    const camera = url.searchParams.get("src") ?? "";
    const q = url.searchParams.get("q");
    const quality: Quality | null = q === null || q === "" ? fallback : q === "hd" || q === "sd" ? q : null;
    if (!CAMERA_ID_RE.test(camera) || !quality) {
      return { ok: false, res: json(400, { error: "bad_request" }) };
    }
    const result = await verifyToken(key, url.searchParams.get("t"), now() / 1000);
    if (!result.ok) {
      log("deny", { path: url.pathname, cam: camera, reason: result.reason, ip });
      return { ok: false, res: json(401, { error: "unauthorized", reason: result.reason }) };
    }
    if (!cameras.has(camera)) {
      log("deny", { path: url.pathname, cam: camera, reason: "unknown_camera", u: result.claims.u, ip });
      return { ok: false, res: json(404, { error: "unknown_camera" }) };
    }
    if (!allowsCamera(result.claims, camera)) {
      log("deny", { path: url.pathname, cam: camera, reason: "camera_not_allowed", u: result.claims.u, ip });
      return { ok: false, res: json(403, { error: "forbidden" }) };
    }
    return { ok: true, claims: result.claims, camera, quality };
  }

  function pruneHls(): void {
    const t = now();
    for (const [id, g] of hlsGrants) {
      if (t > g.hardUntil || t - g.lastSeen > HLS_IDLE_MS) hlsGrants.delete(id);
    }
  }

  /** go2rtc'ning {"type":"hls"} javobidan HLS seans id'larini oladi. */
  function noteHls(text: string, session: Session): void {
    let msg: unknown;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    const { type, value } = msg as { type?: unknown; value?: unknown };
    if (type !== "hls" || typeof value !== "string") return;
    const t = now();
    for (const match of value.matchAll(/[?&]id=([A-Za-z0-9_-]{4,64})/g)) {
      hlsGrants.set(match[1], {
        user: session.user,
        camera: session.camera,
        lastSeen: t,
        hardUntil: t + cfg.sessionMaxSec * 1000,
      });
      log("hls_grant", { s: session.id, u: session.user, cam: session.camera });
    }
  }

  async function snapshot(url: URL, ip?: string): Promise<Response> {
    const auth = await authorize(url, "sd", ip);
    if (!auth.ok) return auth.res;
    const upstream = `${cfg.go2rtcUrl}/api/frame.jpeg?src=${
      encodeURIComponent(streamName(auth.camera, auth.quality))
    }&cache=${cfg.snapshotCache}`;
    let res: Response;
    try {
      res = await doFetch(upstream, { signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS) });
    } catch (e) {
      log("snapshot_error", { cam: auth.camera, u: auth.claims.u, err: errName(e) });
      return json(502, { error: "go2rtc_unreachable" });
    }
    const type = res.headers.get("content-type") ?? "";
    // Kamera o'chiq bo'lsa go2rtc 1.9.15 «200» va bo'sh javob qaytaradi — shuning uchun turi ham tekshiriladi.
    if (!res.ok || !type.startsWith("image/")) {
      await res.body?.cancel();
      log("snapshot_fail", { cam: auth.camera, u: auth.claims.u, status: res.status });
      return json(504, { error: "camera_unavailable" });
    }
    return new Response(res.body, { status: 200, headers: { ...BASE_HEADERS, "content-type": "image/jpeg" } });
  }

  async function hls(url: URL): Promise<Response> {
    pruneHls();
    const id = url.searchParams.get("id") ?? "";
    const grant = HLS_ID_RE.test(id) ? hlsGrants.get(id) : undefined;
    if (!grant) return json(404, { error: "not_found" });
    grant.lastSeen = now();
    const query = new URLSearchParams({ id });
    const n = url.searchParams.get("n");
    if (n !== null) {
      if (!/^\d{1,9}$/.test(n)) return json(400, { error: "bad_request" });
      query.set("n", n);
    }
    let res: Response;
    try {
      res = await doFetch(`${cfg.go2rtcUrl}${url.pathname}?${query}`, {
        signal: AbortSignal.timeout(HLS_TIMEOUT_MS),
      });
    } catch (e) {
      log("hls_error", { cam: grant.camera, u: grant.user, err: errName(e) });
      return json(502, { error: "go2rtc_unreachable" });
    }
    if (!res.ok) {
      await res.body?.cancel();
      return json(res.status === 404 ? 404 : 502, { error: "hls_unavailable" });
    }
    return new Response(res.body, {
      status: 200,
      headers: { ...BASE_HEADERS, "content-type": res.headers.get("content-type") ?? "application/octet-stream" },
    });
  }

  async function websocket(req: Request, url: URL, ip?: string): Promise<Response> {
    const origin = req.headers.get("origin") ?? "";
    if (!origins.has(origin)) {
      log("deny", { path: url.pathname, reason: "origin", origin: origin.slice(0, 100), ip });
      return json(403, { error: "origin" });
    }
    const auth = await authorize(url, "hd", ip);
    if (!auth.ok) return auth.res;
    pruneHls();

    if (sessions.size >= cfg.maxSessions) {
      log("deny", { reason: "busy", u: auth.claims.u, cam: auth.camera });
      return json(429, { error: "busy" });
    }
    let mine = 0;
    for (const s of sessions) if (s.user === auth.claims.u) mine++;
    if (mine >= cfg.maxSessionsPerUser) {
      log("deny", { reason: "busy_user", u: auth.claims.u, cam: auth.camera });
      return json(429, { error: "busy_user" });
    }

    const { socket: client, response } = Deno.upgradeWebSocket(req);
    client.binaryType = "arraybuffer";
    const session: Session = {
      id: nextSessionId++,
      user: auth.claims.u,
      camera: auth.camera,
      quality: auth.quality,
      openedAt: now(),
      bytes: 0,
    };
    sessions.add(session);
    log("ws_open", { s: session.id, u: session.user, cam: session.camera, q: session.quality, ip });

    const upstream = new WebSocket(
      `${cfg.go2rtcUrl.replace(/^http/, "ws")}/api/ws?src=${encodeURIComponent(streamName(auth.camera, auth.quality))}`,
    );
    upstream.binaryType = "arraybuffer";
    const pending: string[] = [];
    let closed = false;
    let closeCode = 1000;
    let closeReason = "";

    const finish = (code: number, reason: string) => {
      if (closed) return;
      closed = true;
      closeCode = code;
      closeReason = reason;
      clearTimeout(timer);
      sessions.delete(session);
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.close(code, reason);
        } catch { /* allaqachon yopilgan */ }
      }
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        try {
          upstream.close();
        } catch { /* allaqachon yopilgan */ }
      }
      log("ws_close", {
        s: session.id,
        u: session.user,
        cam: session.camera,
        code,
        reason,
        sec: Math.round((now() - session.openedAt) / 1000),
        bytes: session.bytes,
      });
    };
    const timer = setTimeout(() => finish(4000, "session_max"), cfg.sessionMaxSec * 1000);

    upstream.onopen = () => {
      for (const m of pending.splice(0)) upstream.send(m);
    };
    upstream.onmessage = (ev: MessageEvent) => {
      if (closed) return;
      if (typeof ev.data === "string") noteHls(ev.data, session);
      else if (ev.data instanceof ArrayBuffer) session.bytes += ev.data.byteLength;
      if (client.readyState !== WebSocket.OPEN) return;
      if (client.bufferedAmount > SLOW_CLIENT_BYTES) return finish(1013, "slow_client");
      client.send(ev.data);
    };
    upstream.onclose = () => finish(1011, "upstream_closed");
    upstream.onerror = () => finish(1011, "upstream_error");

    client.onopen = () => {
      if (closed) {
        try {
          client.close(closeCode, closeReason);
        } catch { /* allaqachon yopilgan */ }
      }
    };
    client.onmessage = (ev: MessageEvent) => {
      if (closed) return;
      const msg = parseClientMessage(ev.data);
      if (!msg) return finish(1008, "bad_message");
      if (!CLIENT_MESSAGE_TYPES.has(msg.type)) {
        log("drop", { s: session.id, type: msg.type });
        return;
      }
      if (upstream.readyState === WebSocket.OPEN) upstream.send(ev.data as string);
      else if (pending.length < MAX_PENDING) pending.push(ev.data as string);
      else finish(1008, "too_many_messages");
    };
    client.onclose = () => finish(1000, "client_closed");
    client.onerror = () => finish(1011, "client_error");
    return response;
  }

  async function health(req: Request): Promise<Response> {
    if (!timingSafeEqual(req.headers.get("x-health-key") ?? "", cfg.healthKey)) {
      return json(404, { error: "not_found" });
    }
    const started = now();
    // go2rtc tirikmi: src'siz so'rovga darrov xato qaytaradi.
    let go2rtc = false;
    try {
      const res = await doFetch(`${cfg.go2rtcUrl}/api/frame.jpeg`, { signal: AbortSignal.timeout(3000) });
      await res.body?.cancel();
      go2rtc = true;
    } catch {
      go2rtc = false;
    }
    const entries = await Promise.all(cfg.cameras.map(async (camera): Promise<[string, CameraHealth]> => {
      if (!go2rtc) return [camera, { online: false, ms: 0, error: "go2rtc_down" }];
      const t0 = now();
      try {
        const res = await doFetch(
          `${cfg.go2rtcUrl}/api/frame.jpeg?src=${encodeURIComponent(streamName(camera, "sd"))}&cache=1m`,
          { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) },
        );
        const online = res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
        await res.body?.cancel();
        if (online) return [camera, { online, ms: now() - t0 }];
        return [camera, { online, ms: now() - t0, error: res.ok ? "no_image" : `http_${res.status}` }];
      } catch (e) {
        return [camera, { online: false, ms: now() - t0, error: errName(e) === "TimeoutError" ? "timeout" : "error" }];
      }
    }));
    const camerasState = Object.fromEntries(entries);
    const ok = go2rtc && entries.every(([, h]) => h.online);
    return json(200, {
      ok,
      go2rtc,
      cameras: camerasState,
      sessions: sessions.size,
      at: new Date(now()).toISOString(),
      ms: now() - started,
    });
  }

  async function handler(req: Request, info?: Deno.ServeHandlerInfo): Promise<Response> {
    if (req.method !== "GET") return json(404, { error: "not_found" });
    const url = new URL(req.url);
    const ip = clientIp(req, info);
    try {
      if (url.pathname === "/api/ws") {
        if ((req.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") return json(404, { error: "not_found" });
        return await websocket(req, url, ip);
      }
      if (url.pathname === "/api/frame.jpeg") return await snapshot(url, ip);
      if (HLS_PATHS.has(url.pathname)) return await hls(url);
      if (url.pathname === "/health") return await health(req);
    } catch (e) {
      log("error", { path: url.pathname, err: errName(e), msg: String(e).slice(0, 200) });
      return json(500, { error: "internal" });
    }
    return json(404, { error: "not_found" });
  }

  return {
    handler,
    stats: () => ({ sessions: sessions.size, hlsGrants: hlsGrants.size }),
  };
}

function errName(e: unknown): string {
  return e instanceof Error ? e.name : typeof e;
}
