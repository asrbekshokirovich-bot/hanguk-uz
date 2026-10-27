// Sends the stage notifications queued in public.student_stage_notifications
// (documents collected, university offered / confirmed, online application
// submitted, paper documents posted) to every phone the student signed in on
// with their magic code (user_push_tokens), in that phone's language.
//
// Called every minute by pg_cron (migration 20261015090000). A row waits 30
// seconds before it goes, so two universities offered together arrive as one
// notification; rows for the same student and stage are always merged.
//
// AUTH: verify_jwt is off at the gateway because the sb_secret_ key pg_cron
// sends is not a JWT and can only travel in the `apikey` header (same as
// channel-health-check). The caller is checked in `authorized()`.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { pushData, stageMessage, type StageKind } from "./messages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");

const SETTLE_MS = 30_000;
const MAX_ATTEMPTS = 5;

interface QueueRow {
  id: string;
  student_id: string;
  kind: StageKind;
  institution_id: string | null;
  attempts: number;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Only pg_cron (an sb_secret_ key) or the service-role key itself. */
function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return !!bearer && bearer === SUPABASE_SERVICE_ROLE_KEY;
}

function knownSecretKeys(): string[] {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return [];
    return Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string");
  } catch (_e) {
    return [];
  }
}

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;
  const pem = sa.private_key.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
  if (!FCM_SERVICE_ACCOUNT_JSON) return json({ error: "FCM_SERVICE_ACCOUNT_JSON is not set" }, 500);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: rows, error } = await supabase
      .from("student_stage_notifications")
      .select("id, student_id, kind, institution_id, attempts")
      .is("sent_at", null)
      .lt("attempts", MAX_ATTEMPTS)
      .lt("created_at", new Date(Date.now() - SETTLE_MS).toISOString())
      .order("created_at")
      .limit(300);
    if (error) throw new Error(error.message);
    const queue = (rows ?? []) as QueueRow[];
    if (queue.length === 0) return json({ ok: true, groups: 0 });

    const institutionIds = [...new Set(queue.map((r) => r.institution_id).filter((v): v is string => !!v))];
    const names = new Map<string, string>();
    if (institutionIds.length > 0) {
      const { data: inst } = await supabase.from("institutions").select("id, name_en, name_ko").in("id", institutionIds);
      for (const i of inst ?? []) names.set(i.id, (i.name_en || i.name_ko || "").trim());
    }

    const studentIds = [...new Set(queue.map((r) => r.student_id))];
    const { data: tokenRows, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("user_id, token, preferred_lang")
      .eq("enabled", true)
      .in("user_id", studentIds);
    if (tokenError) throw new Error(tokenError.message);
    const tokensByStudent = new Map<string, { token: string; preferred_lang: string | null }[]>();
    for (const t of tokenRows ?? []) {
      tokensByStudent.set(t.user_id, [...(tokensByStudent.get(t.user_id) ?? []), t]);
    }

    const groups = new Map<string, QueueRow[]>();
    for (const r of queue) {
      const key = `${r.student_id}|${r.kind}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }

    const sa: ServiceAccount = JSON.parse(FCM_SERVICE_ACCOUNT_JSON);
    let accessToken: string | null = null;
    let sent = 0;
    let failed = 0;

    for (const group of groups.values()) {
      const { student_id, kind } = group[0];
      const uniNames = group.map((r) => (r.institution_id ? names.get(r.institution_id) : null)).filter((n): n is string => !!n);
      const tokens = tokensByStudent.get(student_id) ?? [];
      const ids = group.map((r) => r.id);

      // No app on any phone: nothing to deliver, so the row is closed.
      if (tokens.length === 0) {
        await supabase.from("student_stage_notifications")
          .update({ sent_at: new Date().toISOString(), last_error: "no push token" }).in("id", ids);
        continue;
      }

      accessToken ??= await fcmAccessToken(sa);
      let delivered = 0;
      const errors: string[] = [];
      for (const { token, preferred_lang } of tokens) {
        const msg = stageMessage(kind, uniNames, preferred_lang);
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: msg.title, body: msg.body },
              data: pushData(kind),
              android: { priority: "high", notification: { sound: "default" } },
            },
          }),
        });
        if (res.ok) {
          delivered++;
        } else {
          const errBody = await res.text();
          errors.push(errBody.slice(0, 300));
          if (errBody.includes("UNREGISTERED") || errBody.includes("INVALID_ARGUMENT")) {
            await supabase.from("user_push_tokens").update({ enabled: false }).eq("token", token);
          }
        }
      }

      if (delivered > 0) {
        sent++;
        await supabase.from("student_stage_notifications")
          .update({ sent_at: new Date().toISOString(), last_error: errors[0] ?? null }).in("id", ids);
      } else {
        failed++;
        for (const r of group) {
          await supabase.from("student_stage_notifications")
            .update({ attempts: r.attempts + 1, last_error: errors[0] ?? "send failed" }).eq("id", r.id);
        }
      }
    }

    return json({ ok: true, groups: groups.size, sent, failed });
  } catch (err) {
    console.error("notify-student-stages error:", err);
    return json({ error: String(err) }, 500);
  }
});
