// deno test -A supabase/functions/staff-bot/voice_test.ts — ovoz: Scribe asosiy, Gemini zaxira (B0-4), guruh ovozi (B2-1).
import { assertEquals } from "jsr:@std/assert@1";
import { audioFormat, onGroupVoice, transcribeAudio, transcribeTelegramVoice, voiceMessageText } from "./voice.ts";
import { transcribeWithScribe } from "../_shared/scribe.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

const TOKEN = "123:abc";
const AUDIO = new Uint8Array([79, 103, 103, 83, 1, 2, 3]); // "OggS…"
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const scribeOk = (text: string) => () => json(200, { text, language_code: "uzb", words: [] });
const geminiOk = (text: string) => () => json(200, { candidates: [{ content: { parts: [{ text }] } }] });

interface Seen {
  urls: string[];
  scribeForm?: FormData;
  geminiBody?: Any;
}

/** globalThis.fetch'ni almashtirib, fn'ni bajaradi; kalitlar env'da (keyin tiklanadi). */
async function withFetch<T>(
  routes: { scribe?: Handler; gemini?: Handler; getFile?: Handler; download?: Handler },
  env: Record<string, string | undefined>,
  fn: (seen: Seen) => Promise<T>,
): Promise<T> {
  const seen: Seen = { urls: [] };
  const orig = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  const route = (input: string | URL | Request, init?: RequestInit): Response | Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    seen.urls.push(url.replace(/key=[^&]+/, "key=***"));
    if (url.includes("api.elevenlabs.io")) {
      seen.scribeForm = init?.body as FormData;
      return (routes.scribe ?? scribeOk("salom"))(url, init);
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      seen.geminiBody = JSON.parse(String(init?.body));
      return (routes.gemini ?? geminiOk("gemini matn"))(url, init);
    }
    if (url.endsWith("/getFile")) {
      return (routes.getFile ?? (() => json(200, { ok: true, result: { file_path: "voice/file_7.oga", file_size: AUDIO.length } })))(url, init);
    }
    if (url.includes("/file/bot")) return (routes.download ?? (() => new Response(AUDIO)))(url, init);
    return json(404, { ok: false });
  };
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => Promise.resolve(route(input, init))) as typeof fetch;
  try {
    return await fn(seen);
  } finally {
    globalThis.fetch = orig;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

const KEYS = { ELEVENLABS_API_KEY: "el-test", GEMINI_API_KEY: "g-test" };
const services = (seen: Seen) =>
  seen.urls.filter((u) => !u.includes("api.telegram.org")).map((u) => (u.includes("elevenlabs") ? "scribe" : "gemini"));

Deno.test("Scribe ishlasa — Gemini chaqirilmaydi; fayl voice.ogg, audio/ogg, uzb", async () => {
  await withFetch({ scribe: scribeOk("  Bugun uchta talaba bilan gaplashdim  ") }, KEYS, async (seen) => {
    const r = await transcribeTelegramVoice(TOKEN, "file-1");
    assertEquals(r, { text: "Bugun uchta talaba bilan gaplashdim", provider: "scribe" });
    assertEquals(services(seen), ["scribe"]);
    const file = seen.scribeForm?.get("file") as File;
    assertEquals([file.name, file.type, file.size], ["voice.ogg", "audio/ogg", AUDIO.length]);
    assertEquals(seen.scribeForm?.get("language_code"), "uzb");
    assertEquals(seen.urls[0], `https://api.telegram.org/bot${TOKEN}/getFile`);
    assertEquals(seen.urls[1], `https://api.telegram.org/file/bot${TOKEN}/voice/file_7.oga`);
  });
});

Deno.test("Scribe xato (503) — Gemini zaxira javob beradi", async () => {
  await withFetch({ scribe: () => json(503, { detail: "busy" }) }, KEYS, async (seen) => {
    const r = await transcribeAudio(AUDIO, "audio/ogg", "voice.ogg");
    assertEquals(r, { text: "gemini matn", provider: "gemini" });
    assertEquals(services(seen), ["scribe", "gemini"]);
    const part = seen.geminiBody.contents[0].parts[1].inlineData;
    assertEquals([part.mimeType, atob(part.data).length], ["audio/ogg", AUDIO.length]);
  });
});

Deno.test("Scribe kaliti yo'q yoki bo'sh matn — Gemini", async () => {
  await withFetch({}, { ...KEYS, ELEVENLABS_API_KEY: undefined }, async (seen) => {
    assertEquals((await transcribeAudio(AUDIO, "audio/ogg", "voice.ogg"))?.provider, "gemini");
    assertEquals(services(seen), ["gemini"]);
  });
  await withFetch({ scribe: scribeOk("   ") }, KEYS, async (seen) => {
    assertEquals((await transcribeAudio(AUDIO, "audio/ogg", "voice.ogg"))?.provider, "gemini");
    assertEquals(services(seen), ["scribe", "gemini"]);
  });
});

Deno.test("Gemini 503 bo'lsa ham Scribe ishlaydi (04.11 holati); ikkalasi ham ishlamasa — null", async () => {
  await withFetch({ gemini: () => json(503, { error: { status: "UNAVAILABLE" } }) }, KEYS, async () => {
    assertEquals((await transcribeAudio(AUDIO, "audio/ogg", "voice.ogg"))?.provider, "scribe");
  });
  await withFetch({ scribe: () => json(500, {}), gemini: () => json(503, {}) }, KEYS, async (seen) => {
    assertEquals(await transcribeAudio(AUDIO, "audio/ogg", "voice.ogg"), null);
    assertEquals(services(seen), ["scribe", "gemini"]);
  });
  await withFetch({}, { ELEVENLABS_API_KEY: undefined, GEMINI_API_KEY: undefined }, async (seen) => {
    assertEquals(await transcribeAudio(AUDIO, "audio/ogg", "voice.ogg"), null);
    assertEquals(services(seen), []);
  });
});

Deno.test("Telegram'dan yuklab bo'lmasa yoki fayl katta — provayder chaqirilmaydi", async () => {
  await withFetch({ download: () => new Response("no", { status: 404 }) }, KEYS, async (seen) => {
    assertEquals(await transcribeTelegramVoice(TOKEN, "f"), null);
    assertEquals(services(seen), []);
  });
  await withFetch({ getFile: () => json(200, { ok: false, description: "file is too big" }) }, KEYS, async (seen) => {
    assertEquals(await transcribeTelegramVoice(TOKEN, "f"), null);
    assertEquals(services(seen), []);
  });
  await withFetch({ getFile: () => json(200, { ok: true, result: { file_path: "voice/x.oga", file_size: 9e6 } }) }, KEYS, async (seen) => {
    assertEquals(await transcribeTelegramVoice(TOKEN, "f"), null);
    assertEquals(seen.urls.length, 1);
  });
});

Deno.test("audioFormat: Telegram ovozi OGG, boshqa audio — kengaytma bo'yicha", () => {
  assertEquals(audioFormat("voice/file_7.oga"), { mime: "audio/ogg", fileName: "voice.ogg" });
  assertEquals(audioFormat("voice/file_7"), { mime: "audio/ogg", fileName: "voice.ogg" });
  assertEquals(audioFormat("music/file_3.mp3"), { mime: "audio/mpeg", fileName: "audio.mp3" });
  assertEquals(audioFormat("music/file_3.M4A"), { mime: "audio/mp4", fileName: "audio.m4a" });
});

Deno.test("_shared/scribe.ts: fayl nomi ixtiyoriy, standarti avvalgidek recording.mp3", async () => {
  await withFetch({}, KEYS, async (seen) => {
    await transcribeWithScribe(AUDIO, "audio/mpeg", "uzb");
    assertEquals((seen.scribeForm?.get("file") as File).name, "recording.mp3");
    await transcribeWithScribe(AUDIO, "audio/ogg", "uzb", "voice.ogg");
    assertEquals((seen.scribeForm?.get("file") as File).name, "voice.ogg");
  });
});

Deno.test("voiceMessageText: «🎤 …» va ovoz izohi", () => {
  assertEquals(voiceMessageText(" Ertaga keladi "), "🎤 Ertaga keladi");
  assertEquals(voiceMessageText("Ertaga keladi", " Kim Minsu "), "🎤 Ertaga keladi\nKim Minsu");
  assertEquals(voiceMessageText("a".repeat(9000)).length, 8000);
});

function fakeDb() {
  const updates: Any[] = [];
  return {
    updates,
    from: (table: string) => ({
      update: (v: Any) => {
        const u: Any = { table, v, eq: [] };
        updates.push(u);
        const b: Any = { eq: (c: string, x: unknown) => (u.eq.push([c, x]), b), then: (r: Any) => r({ error: null }) };
        return b;
      },
    }),
  };
}

const voiceMsg = (caption?: string) => ({
  chat: { id: -100 }, message_id: 31, voice: { file_id: "v1", mime_type: "audio/ogg", duration: 4 }, caption,
});

Deno.test("guruh ovozi: matn «🎤 …» bilan saqlanadi va tahlilga beriladi", async () => {
  await withFetch({ scribe: scribeOk("Diyora ertaga apostilni olib kelsin") }, KEYS, async () => {
    const db = fakeDb();
    const analyzed: string[] = [];
    await onGroupVoice(db, TOKEN, voiceMsg(), (t) => (analyzed.push(t), Promise.resolve()));
    assertEquals(db.updates, [{ table: "staff_group_messages", v: { text: "🎤 Diyora ertaga apostilni olib kelsin" }, eq: [["chat_id", -100], ["message_id", 31]] }]);
    assertEquals(analyzed, ["🎤 Diyora ertaga apostilni olib kelsin"]);
  });
});

Deno.test("guruh ovozi: qisqa matn tahlil qilinmaydi; aylantirib bo'lmasa — faqat izohi", async () => {
  await withFetch({ scribe: scribeOk("Ha") }, KEYS, async () => {
    const db = fakeDb();
    const analyzed: string[] = [];
    await onGroupVoice(db, TOKEN, voiceMsg(), (t) => (analyzed.push(t), Promise.resolve()));
    assertEquals([db.updates.length, analyzed.length], [1, 0]);
  });
  await withFetch({ scribe: () => json(500, {}), gemini: () => json(503, {}) }, KEYS, async () => {
    const db = fakeDb();
    const analyzed: string[] = [];
    await onGroupVoice(db, TOKEN, voiceMsg("Kim Minsu hujjatlari bo'yicha"), (t) => (analyzed.push(t), Promise.resolve()));
    assertEquals([db.updates.length, analyzed], [0, ["Kim Minsu hujjatlari bo'yicha"]]);
  });
});
