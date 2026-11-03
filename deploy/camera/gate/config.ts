// camera-gate sozlamasi: hammasi muhit o'zgaruvchilaridan (secrets/gate.env).
import { CAMERA_ID_RE } from "./token.ts";

export interface GateConfig {
  hostname: string;
  port: number;
  /** go2rtc API, faqat shu kompyuter ichida: http://127.0.0.1:1984 */
  go2rtcUrl: string;
  /** Supabase'dagi CAMERA_GATE_SECRET bilan bir xil. */
  secret: string;
  /** /health uchun alohida kalit (Supabase'dagi CAMERA_HEALTH_KEY). */
  healthKey: string;
  /** Jonli video faqat shu sahifalardan ochiladi (WebSocket Origin). */
  origins: string[];
  /** Kamera nomlari. go2rtc'da har biri uchun "<nom>" (katta) va "<nom>_sub" (kichik) oqim bo'ladi. */
  cameras: string[];
  /** Bitta jonli ulanishning eng uzun vaqti; keyin pleyer yangi kalit bilan o'zi ulanadi. */
  sessionMaxSec: number;
  maxSessions: number;
  maxSessionsPerUser: number;
  /** go2rtc rasm keshi: bir necha ko'ruvchi bo'lsa ham kamera bir marta so'raladi. */
  snapshotCache: string;
}

/** main.ts shu nomlarni --allow-env ga beradi. */
export const ENV_NAMES = [
  "GATE_LISTEN",
  "GO2RTC_URL",
  "GATE_SECRET",
  "HEALTH_KEY",
  "GATE_ORIGINS",
  "CAMERAS",
  "SESSION_MAX_SEC",
  "MAX_SESSIONS",
  "MAX_SESSIONS_PER_USER",
  "SNAPSHOT_CACHE",
] as const;

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join("; "));
    this.name = "ConfigError";
  }
}

function intIn(
  raw: string | undefined,
  name: string,
  def: number,
  min: number,
  max: number,
  problems: string[],
): number {
  if (raw === undefined || raw.trim() === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    problems.push(`${name}: ${min}…${max} oralig'idagi butun son bo'lsin`);
    return def;
  }
  return n;
}

export function loadConfig(get: (name: string) => string | undefined): GateConfig {
  const problems: string[] = [];

  const listen = (get("GATE_LISTEN") ?? "127.0.0.1:8080").trim();
  const m = /^([0-9a-zA-Z.-]+):(\d{1,5})$/.exec(listen);
  let hostname = "127.0.0.1";
  let port = 8080;
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 65535) {
    problems.push(`GATE_LISTEN: "manzil:port" ko'rinishida bo'lsin, masalan 10.8.0.2:8080`);
  } else {
    hostname = m[1];
    port = Number(m[2]);
  }

  const go2rtcUrl = (get("GO2RTC_URL") ?? "http://127.0.0.1:1984").trim().replace(/\/+$/, "");
  if (!/^http:\/\/[^/\s]+$/.test(go2rtcUrl)) {
    problems.push("GO2RTC_URL: http://127.0.0.1:1984 ko'rinishida bo'lsin");
  }

  const secret = get("GATE_SECRET") ?? "";
  if (secret.length < 32) {
    problems.push("GATE_SECRET kamida 32 belgi (Supabase'dagi CAMERA_GATE_SECRET bilan bir xil)");
  }
  const healthKey = get("HEALTH_KEY") ?? "";
  if (healthKey.length < 16) problems.push("HEALTH_KEY kamida 16 belgi");

  const origins = (get("GATE_ORIGINS") ?? "https://hanguk.uz,https://www.hanguk.uz")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.length === 0) problems.push("GATE_ORIGINS bo'sh");
  for (const o of origins) {
    if (!/^https?:\/\/[^/\s]+$/.test(o)) {
      problems.push(`GATE_ORIGINS: "${o}" — https://sayt ko'rinishida, oxirida / siz`);
    }
  }

  const cameras = (get("CAMERAS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (cameras.length === 0) problems.push("CAMERAS bo'sh — masalan CAMERAS=kirish,zal");
  for (const c of cameras) {
    if (!CAMERA_ID_RE.test(c)) {
      problems.push(`CAMERAS: "${c}" — kichik lotin harf, raqam va "-", 32 belgigacha`);
    }
  }
  if (new Set(cameras).size !== cameras.length) problems.push("CAMERAS: takror nom bor");

  const sessionMaxSec = intIn(get("SESSION_MAX_SEC"), "SESSION_MAX_SEC", 900, 60, 3600, problems);
  const maxSessions = intIn(get("MAX_SESSIONS"), "MAX_SESSIONS", 12, 1, 100, problems);
  const maxSessionsPerUser = intIn(get("MAX_SESSIONS_PER_USER"), "MAX_SESSIONS_PER_USER", 6, 1, 50, problems);

  const snapshotCache = (get("SNAPSHOT_CACHE") ?? "8s").trim();
  if (!/^\d{1,4}(ms|s|m)$/.test(snapshotCache)) problems.push("SNAPSHOT_CACHE: masalan 8s");

  if (problems.length) throw new ConfigError(problems);
  return {
    hostname,
    port,
    go2rtcUrl,
    secret,
    healthKey,
    origins,
    cameras,
    sessionMaxSec,
    maxSessions,
    maxSessionsPerUser,
    snapshotCache,
  };
}
