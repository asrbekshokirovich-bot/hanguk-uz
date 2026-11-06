// staff-bot — ovozli xabarni matnga aylantirish (reja B0-4, qaror D2).
//
// ElevenLabs Scribe asosiy (_shared/scribe.ts, o'zbekcha "uzb"), u ishlamasa (xato, kalit yo'q,
// bo'sh javob, vaqt tugadi) — Gemini (audio inline). 04.11 da Gemini 503 bergani uchun ovozli
// hisobot matnga aylanmay qolgan edi; endi bitta provayder band bo'lsa, ikkinchisi ishlaydi.
// Qaysi provayder ishlagani (yoki ikkalasi ham ishlamagani) logga yoziladi: "staff-bot voice: …".
//
// Guruh (reja B2-1, ovoz qismi): ulangan xodimning ovozli xabari fonda matnga aylanadi,
// staff_group_messages.text «🎤 …» bilan yangilanadi va oddiy tahlilga beriladi
// (shouldAnalyze + analyzeGroupMessage). Ovozdan #vazifa buyrug'i chiqarilmaydi — faqat tahlil.
//
// Kalitlar: ELEVENLABS_API_KEY (Scribe), GEMINI_API_KEY; ixtiyoriy STAFF_BOT_GEMINI_MODEL.

import { callTelegram } from "../_shared/telegram.ts";
import { transcribeWithScribe } from "../_shared/scribe.ts";
import { shouldAnalyze } from "./core.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export type VoiceProvider = "scribe" | "gemini";

export interface VoiceText {
  text: string;
  provider: VoiceProvider;
}

/** Bundan katta fayl matnga aylantirilmaydi (Gemini inline chegarasi ham shu atrofda). */
export const MAX_VOICE_BYTES = 8 * 1024 * 1024;
const SCRIBE_TIMEOUT_MS = 30_000;
const GEMINI_TIMEOUT_MS = 40_000;

const GEMINI_PROMPT =
  "Transcribe this voice message verbatim. It is mostly in Uzbek (Latin script), possibly with Russian or Korean words. Output only the transcript, no comments.";

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac", wav: "audio/wav",
  flac: "audio/flac", webm: "audio/webm", amr: "audio/amr",
};

/**
 * Telegram fayl yo'li (getFile → file_path) bo'yicha mime va yuboriladigan fayl nomi.
 * Ovozli xabar — OGG/Opus («voice/file_1.oga») → audio/ogg, «voice.ogg».
 */
export function audioFormat(filePath: string): { mime: string; fileName: string } {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(filePath)?.[1] ?? "").toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) return { mime: "audio/ogg", fileName: "voice.ogg" };
  return { mime, fileName: `audio.${ext}` };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** Promise'ni vaqt bilan cheklash (taymer har holda tozalanadi). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms} ms`)), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}

function toBase64(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function viaScribe(bytes: Uint8Array, mime: string, fileName: string): Promise<string> {
  const r = await withTimeout(transcribeWithScribe(bytes, mime, "uzb", fileName), SCRIBE_TIMEOUT_MS, "scribe");
  return (r.text ?? "").trim();
}

async function viaGemini(bytes: Uint8Array, mime: string): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const model = Deno.env.get("STAFF_BOT_GEMINI_MODEL") || "gemini-2.5-flash";
  const res = await withTimeout(
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: GEMINI_PROMPT }, { inlineData: { mimeType: mime, data: toBase64(bytes) } }] }],
        generationConfig: { temperature: 0 },
      }),
    }),
    GEMINI_TIMEOUT_MS,
    "gemini",
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j?.candidates?.[0]?.content?.parts ?? []).map((p: Any) => p?.text ?? "").join("").trim();
}

/** Ovoz baytlari → matn: Scribe, ishlamasa Gemini. Ikkalasi ham ishlamasa null. */
export async function transcribeAudio(bytes: Uint8Array, mime: string, fileName: string): Promise<VoiceText | null> {
  let t0 = Date.now();
  try {
    const text = await viaScribe(bytes, mime, fileName);
    if (text) {
      console.log(`staff-bot voice: via scribe (${Date.now() - t0} ms, ${text.length} chars)`);
      return { text, provider: "scribe" };
    }
    console.warn("staff-bot voice: scribe returned empty text, trying gemini");
  } catch (e) {
    console.warn(`staff-bot voice: scribe failed, trying gemini: ${errText(e)}`);
  }
  t0 = Date.now();
  try {
    const text = await viaGemini(bytes, mime);
    if (text) {
      console.log(`staff-bot voice: via gemini (fallback, ${Date.now() - t0} ms, ${text.length} chars)`);
      return { text, provider: "gemini" };
    }
    console.error("staff-bot voice: gemini returned empty text — voice not transcribed");
  } catch (e) {
    console.error(`staff-bot voice: gemini failed too — voice not transcribed: ${errText(e)}`);
  }
  return null;
}

/** Telegram'dagi ovoz (file_id) → matn. Yuklab bo'lmasa yoki ikkala provayder ham ishlamasa null. */
export async function transcribeTelegramVoice(token: string, fileId: string): Promise<VoiceText | null> {
  try {
    const f = await callTelegram<{ file_path?: string; file_size?: number }>(token, "getFile", { file_id: fileId });
    const path = f.result?.file_path;
    if (!path) {
      console.error("staff-bot voice: getFile failed:", f.description ?? "no file_path");
      return null;
    }
    if ((f.result?.file_size ?? 0) > MAX_VOICE_BYTES) {
      console.warn(`staff-bot voice: file too large (${f.result?.file_size} bytes), skipped`);
      return null;
    }
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
    if (!res.ok) {
      console.error(`staff-bot voice: download failed (${res.status})`);
      await res.body?.cancel();
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_VOICE_BYTES) {
      console.warn(`staff-bot voice: file size ${bytes.length} bytes, skipped`);
      return null;
    }
    const fmt = audioFormat(path);
    return await transcribeAudio(bytes, fmt.mime, fmt.fileName);
  } catch (e) {
    console.error("staff-bot voice:", errText(e));
    return null;
  }
}

/** Guruhda saqlanadigan matn: «🎤 <eshitilgan>» (+ ovoz izohi bo'lsa, yangi qatordan). */
export function voiceMessageText(heard: string, caption?: string | null): string {
  const c = (caption ?? "").trim();
  return (`🎤 ${heard.trim()}` + (c ? `\n${c}` : "")).slice(0, 8000);
}

/**
 * Guruhdagi ovozli xabar: matnga aylantirib staff_group_messages.text'ni yangilaydi va matn
 * tahlilga arziydigan bo'lsa `analyze`ni chaqiradi (index.ts'dagi analyzeGroupMessage).
 * Aylantirib bo'lmasa — ovozning izohi (caption) bo'lsa, o'shani tahlil qiladi.
 */
export async function onGroupVoice(
  db: Any, token: string, msg: Any, analyze: (text: string) => Promise<unknown>,
): Promise<void> {
  const caption: string = msg.caption ?? "";
  const v = msg.voice?.file_id ? await transcribeTelegramVoice(token, msg.voice.file_id) : null;
  if (!v) {
    if (shouldAnalyze(caption)) await analyze(caption);
    return;
  }
  const text = voiceMessageText(v.text, caption);
  const { error } = await db.from("staff_group_messages").update({ text })
    .eq("chat_id", msg.chat.id).eq("message_id", msg.message_id);
  if (error) console.error("staff_group_messages (voice):", error.message);
  if (shouldAnalyze(v.text) || shouldAnalyze(caption)) await analyze(text);
}
