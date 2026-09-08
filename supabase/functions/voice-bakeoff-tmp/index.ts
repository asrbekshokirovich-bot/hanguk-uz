// TEMPORARY — Uzbek voice (TTS) bake-off: ElevenLabs vs Azure Neural voices.
// Secret-gated. Accepts a TTS key in the POST body (eleven_key, or
// azure_key+azure_region) so nothing is persisted in env.
//
// NOTE: this compares text-to-SPEECH voices for a future voice assistant, not
// speech-to-text. Results land in voice_bakeoff_results + the voice-bakeoff
// storage bucket. The 2026-06-19 run produced 24/24 errors: ElevenLabs returned
// 401 invalid_api_key.
//
// Recovered 2026-09-07 from the live Supabase project (version 12). The gate
// secret was hardcoded on the server; it now comes from VOICE_BAKEOFF_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET = Deno.env.get("VOICE_BAKEOFF_SECRET") ?? "";
const EL_VOICE_ID = "cgSgspJ2msm6clMCkdW9";
const EL_MODELS = ["eleven_multilingual_v2", "eleven_v3"];
const AZ_VOICES = ["uz-UZ-MadinaNeural", "uz-UZ-SardorNeural"];

const SENTENCES: { id: string; uz: string }[] = [
  { id: "01-greeting-disclosure", uz: "Assalomu alaykum! Men Hanguk Education kompaniyasining virtual yordamchisiman. Sizga qanday yordam bera olaman?" },
  { id: "02-ask-need", uz: "Albatta, yordam beraman. Siz Koreyada bakalavr, magistratura yoki til kursi haqida ma'lumot olmoqchimisiz?" },
  { id: "03-gks-scholarship", uz: "GKS — bu Koreya hukumati stipendiyasi. U o'qish to'lovini, samolyot chiptasini va oylik nafaqani to'liq qoplaydi. Talabnoma odatda har yili fevral va mart oylarida ochiladi." },
  { id: "04-topik-requirement", uz: "Ko'pchilik universitetlar uchun TOPIK 3-daraja yetarli, ammo ba'zi dasturlar 4-darajani talab qiladi. Agar koreys tilini bilmasangiz, ingliz tilidagi dasturlar ham bor." },
  { id: "05-bachelor-steps", uz: "Bakalavrga kirish uchun avval attestat va diplomingizni tayyorlaymiz, keyin universitet tanlaymiz, hujjatlarni topshiramiz va viza jarayonini boshlaymiz. Butun jarayonda biz siz bilan bo'lamiz." },
  { id: "06-visa-d2", uz: "O'qish uchun sizga D-2 talaba vizasi kerak bo'ladi. Universitetdan qabul xati kelgach, viza uchun hujjatlarni Seul elchixonasiga topshiramiz. Bu odatda ikki-uch hafta vaqt oladi." },
  { id: "07-cost-consultation", uz: "Bir yillik o'qish to'lovi universitetga qarab taxminan to'rt mingdan olti ming dollargacha bo'ladi. Aniq raqamlarni bepul maslahat uchrashuvida batafsil tushuntiramiz." },
  { id: "08-capture-callback", uz: "Sizga to'liq ma'lumot yuborishimiz uchun ismingiz va telefon raqamingizni qoldirsangiz bo'ladimi? Mutaxassisimiz bugun siz bilan bog'lanadi." },
  { id: "09-language-course", uz: "Bizda koreys tili kurslari ham bor — noldan boshlab TOPIK imtihoniga tayyorlash. Darslar haftada to'rt marta, tajribali o'qituvchilar bilan o'tiladi." },
  { id: "10-handoff", uz: "Bu savol bo'yicha sizni mutaxassisimizga ulab qo'yaman, u sizga aniqroq javob beradi. Bir daqiqa kuting, iltimos." },
  { id: "11-numbers-dates", uz: "Bahorgi qabul 2026-yil 1-mart kuni yopiladi. Ro'yxatdan o'tish uchun 250 dollar to'lov va 3 ta tavsiyanoma kerak bo'ladi." },
  { id: "12-empathy-closing", uz: "Tushunaman, chet elda o'qish katta qaror. Xavotir olmang — biz har bir bosqichda yoningizdamiz. Sizni Koreyada ko'rishni juda istaymiz!" },
];

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

async function store(supabase: any, provider: string, voice: string, id: string, buf: Uint8Array) {
  const path = `${provider}/${id}.mp3`;
  const up = await supabase.storage.from("voice-bakeoff").upload(path, buf, { contentType: "audio/mpeg", upsert: true });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  const url = supabase.storage.from("voice-bakeoff").getPublicUrl(path).data.publicUrl;
  await supabase.from("voice_bakeoff_results").insert({ provider, voice, sentence_id: id, url, bytes: buf.length });
}

async function run(supabase: any, keys: { eleven?: string; azure?: string; azureRegion?: string }) {
  for (const s of SENTENCES) {
    if (keys.eleven) {
      for (const model of EL_MODELS) {
        const provider = `elevenlabs-${model}`;
        try {
          const body: any = { text: s.uz, model_id: model };
          if (model !== "eleven_v3") body.voice_settings = { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true };
          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": keys.eleven, "Content-Type": "application/json" }, body: JSON.stringify(body) });
          if (!res.ok) { await supabase.from("voice_bakeoff_results").insert({ provider, voice: EL_VOICE_ID, sentence_id: s.id, error: `${res.status}: ${(await res.text()).slice(0, 160)}` }); continue; }
          await store(supabase, provider, EL_VOICE_ID, s.id, new Uint8Array(await res.arrayBuffer()));
        } catch (e) { await supabase.from("voice_bakeoff_results").insert({ provider, voice: EL_VOICE_ID, sentence_id: s.id, error: String((e as any)?.message || e).slice(0, 160) }); }
      }
    }
    if (keys.azure) {
      const region = keys.azureRegion || "westeurope";
      for (const voice of AZ_VOICES) {
        const provider = `azure`;
        try {
          const ssml = `<speak version='1.0' xml:lang='uz-UZ'><voice name='${voice}'>${xmlEscape(s.uz)}</voice></speak>`;
          const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": keys.azure, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "hanguk-bakeoff" }, body: ssml });
          if (!res.ok) { await supabase.from("voice_bakeoff_results").insert({ provider, voice, sentence_id: s.id, error: `${res.status}: ${(await res.text()).slice(0, 160)}` }); continue; }
          await store(supabase, provider, voice, s.id, new Uint8Array(await res.arrayBuffer()));
        } catch (e) { await supabase.from("voice_bakeoff_results").insert({ provider, voice, sentence_id: s.id, error: String((e as any)?.message || e).slice(0, 160) }); }
      }
    }
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!SECRET || url.searchParams.get("secret") !== SECRET) return new Response("Unauthorized", { status: 401 });
  let bodyJson: any = {};
  try { bodyJson = await req.json(); } catch (_e) { bodyJson = {}; }
  const keys = { eleven: bodyJson.eleven_key || Deno.env.get("ELEVENLABS_API_KEY") || undefined, azure: bodyJson.azure_key || undefined, azureRegion: bodyJson.azure_region || undefined };

  if (url.searchParams.get("diag") === "1") {
    let userStatus = -1;
    if (keys.eleven) { try { userStatus = (await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": keys.eleven } })).status; } catch (_e) { userStatus = -2; } }
    return Response.json({ eleven_present: !!keys.eleven, eleven_probe: userStatus, azure_present: !!keys.azure });
  }

  if (!keys.eleven && !keys.azure) return new Response("no key provided (eleven_key or azure_key)", { status: 400 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  (globalThis as any).EdgeRuntime?.waitUntil?.(run(supabase, keys));
  return new Response(JSON.stringify({ started: true, providers: { eleven: !!keys.eleven, azure: !!keys.azure } }), { headers: { "Content-Type": "application/json" } });
});
