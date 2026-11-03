// camera-session mantiqi (Supabase'siz sinaladi: session_test.ts).
import { type CameraClaims, importSecret, signToken } from "../_shared/camera-token.ts";

/** Kalit umri. camera-gate 600 s dan uzunini qabul qilmaydi; CRM 4 daqiqada yangilaydi. */
export const TOKEN_TTL_SEC = 300;

export interface CameraRow {
  id: string;
  name: string;
}

export interface SessionDeps {
  userId: string;
  secret: string;
  gateUrl: string;
  hasAccess: () => Promise<boolean>;
  listCameras: () => Promise<CameraRow[]>;
  /** Jurnalga yozish. Yozilmasa kalit berilmaydi. */
  log: (cameraIds: string[]) => Promise<void>;
  nowSec?: number;
}

export type SessionResult =
  | {
    status: 200;
    body: { gate: string; token: string; expires_at: string; ttl: number; cameras: CameraRow[] };
  }
  | { status: 403 | 409; body: { error: "forbidden" | "no_cameras" } };

export async function buildSession(d: SessionDeps): Promise<SessionResult> {
  if (!(await d.hasAccess())) return { status: 403, body: { error: "forbidden" } };
  const cameras = await d.listCameras();
  if (cameras.length === 0) return { status: 409, body: { error: "no_cameras" } };

  const iat = Math.floor(d.nowSec ?? Date.now() / 1000);
  const claims: CameraClaims = { u: d.userId, c: cameras.map((c) => c.id), iat, exp: iat + TOKEN_TTL_SEC };
  const token = await signToken(await importSecret(d.secret), claims);
  await d.log(claims.c);
  return {
    status: 200,
    body: {
      gate: d.gateUrl,
      token,
      expires_at: new Date(claims.exp * 1000).toISOString(),
      ttl: TOKEN_TTL_SEC,
      cameras,
    },
  };
}

/** CAMERA_GATE_SECRET va CAMERA_GATE_URL to'g'ri qo'yilganmi. */
export function configProblems(secret: string, gateUrl: string): string[] {
  const out: string[] = [];
  if (secret.length < 32) out.push("CAMERA_GATE_SECRET");
  if (!/^https:\/\/[^/\s]+$/.test(gateUrl)) out.push("CAMERA_GATE_URL");
  return out;
}

export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim().slice(0, 64) : null;
}
