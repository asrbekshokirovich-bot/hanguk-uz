#!/usr/bin/env node
/**
 * Uzbek voice bake-off — Phase 0 of the AI phone agent (docs/research/uzbek-voice-agent.md).
 *
 * THE point of this script: speaking natural, accent-free Uzbek is the single
 * biggest risk of the whole project, and there is essentially one production
 * voice (Azure) plus a couple of contenders. Before building anything, we
 * synthesize the same real Hanguk sentences with each voice and let a NATIVE
 * UZBEK SPEAKER judge them side by side. Cheap, fast, decisive.
 *
 * It writes audio files + a self-contained comparison page (voice-samples/index.html)
 * + a manifest.json. No new dependencies — Node 18+ (global fetch) and fs only.
 *
 * ── Run ───────────────────────────────────────────────────────────────────────
 *   # Azure (the default / must-have option). Get a Speech resource key in the
 *   # Azure portal; pick a region close to users (westeurope recommended).
 *   AZURE_SPEECH_KEY=xxxx AZURE_SPEECH_REGION=westeurope node scripts/uzbek-voice-bakeoff.mjs
 *
 *   # Optional: also try Yandex SpeechKit (native Uzbek, Central-Asia region).
 *   # Voice names for Uzbek are under-documented — set them explicitly once you
 *   # confirm them with Yandex; the script skips Yandex if they're not set.
 *   YANDEX_API_KEY=xxx YANDEX_FOLDER_ID=xxx YANDEX_UZ_VOICES=nigora,lola \
 *     AZURE_SPEECH_KEY=xxx AZURE_SPEECH_REGION=westeurope node scripts/uzbek-voice-bakeoff.mjs
 *
 *   Then open voice-samples/index.html in a browser and rate each voice.
 *
 *   Aisha AI (Tashkent, aisha.group) is the other native contender but has no
 *   public API docs — generate its samples from their web app by hand and drop
 *   the files into voice-samples/aisha/<voice>/<id>.mp3 to appear in the page.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "voice-samples");
const SENTENCES_FILE =
  process.env.SENTENCES_FILE || join(__dirname, "uzbek-voice-bakeoff.sentences.json");

// ── Load sentences ────────────────────────────────────────────────────────────
const { sentences } = JSON.parse(readFileSync(SENTENCES_FILE, "utf8"));
if (!Array.isArray(sentences) || sentences.length === 0) {
  console.error("No sentences found in", SENTENCES_FILE);
  process.exit(1);
}

const xmlEscape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Providers ─────────────────────────────────────────────────────────────────
// Each provider lists the voices to try and a synth(text) -> { buffer, ext }.
const providers = [];

// Azure Neural TTS — the only tier-1 cloud with real Uzbek voices.
if (process.env.AZURE_SPEECH_KEY) {
  const region = process.env.AZURE_SPEECH_REGION || "westeurope";
  const voices = (process.env.AZURE_UZ_VOICES || "uz-UZ-MadinaNeural,uz-UZ-SardorNeural")
    .split(",").map((v) => v.trim()).filter(Boolean);
  providers.push({
    name: "azure",
    voices,
    async synth(text, voice) {
      const ssml =
        `<speak version='1.0' xml:lang='uz-UZ'><voice name='${voice}'>${xmlEscape(text)}</voice></speak>`;
      const res = await fetch(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "hanguk-uzbek-voice-bakeoff",
          },
          body: ssml,
        },
      );
      if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return { buffer: Buffer.from(await res.arrayBuffer()), ext: "mp3" };
    },
  });
} else {
  console.warn("• Azure skipped — set AZURE_SPEECH_KEY (and AZURE_SPEECH_REGION) to include it. This is the default voice; you almost certainly want it.");
}

// Yandex SpeechKit v1 — native Uzbek (under-documented voice names; opt-in).
if (process.env.YANDEX_API_KEY && process.env.YANDEX_FOLDER_ID && process.env.YANDEX_UZ_VOICES) {
  const voices = process.env.YANDEX_UZ_VOICES.split(",").map((v) => v.trim()).filter(Boolean);
  providers.push({
    name: "yandex",
    voices,
    async synth(text, voice) {
      const body = new URLSearchParams({
        text,
        lang: "uz-UZ",
        voice,
        format: "oggopus",
        folderId: process.env.YANDEX_FOLDER_ID,
      });
      const res = await fetch("https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize", {
        method: "POST",
        headers: {
          Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) throw new Error(`Yandex ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return { buffer: Buffer.from(await res.arrayBuffer()), ext: "ogg" };
    },
  });
} else {
  console.warn("• Yandex skipped — set YANDEX_API_KEY, YANDEX_FOLDER_ID and YANDEX_UZ_VOICES (confirm Uzbek voice names with Yandex first).");
}

if (providers.length === 0) {
  console.error("\nNo providers configured. Set at least AZURE_SPEECH_KEY + AZURE_SPEECH_REGION and re-run.");
  process.exit(1);
}

// ── Synthesize ────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const manifest = []; // { provider, voice, id, uz, en, file, error }

for (const p of providers) {
  for (const voice of p.voices) {
    const voiceDir = join(OUT_DIR, p.name, voice);
    mkdirSync(voiceDir, { recursive: true });
    for (const s of sentences) {
      const rel = `${p.name}/${voice}/${s.id}`;
      process.stdout.write(`  ${rel} … `);
      try {
        const { buffer, ext } = await p.synth(s.uz, voice);
        const file = `${rel}.${ext}`;
        writeFileSync(join(OUT_DIR, file), buffer);
        manifest.push({ provider: p.name, voice, id: s.id, uz: s.uz, en: s.en, file });
        console.log(`ok (${(buffer.length / 1024).toFixed(0)} KB)`);
      } catch (e) {
        manifest.push({ provider: p.name, voice, id: s.id, uz: s.uz, en: s.en, error: String(e.message || e) });
        console.log(`FAILED — ${e.message || e}`);
      }
    }
  }
}

// ── Pick up any hand-dropped samples (e.g. Aisha) under voice-samples/<prov>/<voice>/<id>.<ext> ──
const known = new Set(manifest.map((m) => `${m.provider}/${m.voice}/${m.id}`));
const byId = new Map(sentences.map((s) => [s.id, s]));
for (const provider of safeReaddir(OUT_DIR)) {
  if (providers.some((p) => p.name === provider)) continue; // already handled above
  const provDir = join(OUT_DIR, provider);
  for (const voice of safeReaddir(provDir)) {
    for (const f of safeReaddir(join(provDir, voice))) {
      const id = f.replace(/\.[^.]+$/, "");
      if (!byId.has(id) || known.has(`${provider}/${voice}/${id}`)) continue;
      const s = byId.get(id);
      manifest.push({ provider, voice, id, uz: s.uz, en: s.en, file: `${provider}/${voice}/${f}` });
    }
  }
}

writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(OUT_DIR, "index.html"), renderHtml(sentences, manifest));

const okCount = manifest.filter((m) => m.file).length;
const failCount = manifest.filter((m) => m.error).length;
console.log(`\nDone. ${okCount} clips written, ${failCount} failed.`);
console.log(`Open ${join("voice-samples", "index.html")} in a browser and have a native Uzbek speaker rate each voice.`);

// ── helpers ───────────────────────────────────────────────────────────────────
function safeReaddir(dir) {
  try { return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() || d.isFile()).map((d) => d.name); }
  catch { return []; }
}

function renderHtml(sentences, manifest) {
  const voices = [...new Set(manifest.filter((m) => m.file).map((m) => `${m.provider} · ${m.voice}`))];
  const fileFor = (prov, voice, id) =>
    (manifest.find((m) => `${m.provider} · ${m.voice}` === `${prov} · ${voice}` && m.id === id) || {}).file;

  const rows = sentences.map((s) => {
    const players = voices.map((label) => {
      const [prov, voice] = label.split(" · ");
      const f = fileFor(prov, voice, s.id);
      return `<td>${f ? `<audio controls preload="none" src="${f}"></audio>` : '<span class="muted">—</span>'}</td>`;
    }).join("");
    return `<tr><td class="sent"><div class="uz">${s.uz}</div><div class="en">${s.en}</div></td>${players}</tr>`;
  }).join("\n");

  const head = voices.map((v) => `<th>${v}</th>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hanguk — Uzbek voice bake-off</title>
<style>
  body{font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#1a1a1a}
  h1{font-size:20px} p.lead{color:#555;max-width:60ch}
  table{border-collapse:collapse;width:100%;margin-top:16px}
  th,td{border:1px solid #e2e2e2;padding:10px;vertical-align:top;text-align:left}
  th{background:#fafafa;position:sticky;top:0}
  td.sent{max-width:34ch}
  .uz{font-weight:600} .en{color:#888;font-size:13px;margin-top:4px}
  .muted{color:#bbb} audio{width:230px}
  tr:nth-child(even){background:#fcfcfc}
</style></head><body>
<h1>Uzbek voice bake-off — rate accent, naturalness, clarity, prosody</h1>
<p class="lead">A native Uzbek speaker should listen across each row and judge which voice sounds most like a real human consultant. Note any wrong stress, robotic intonation, or mispronounced words (especially numbers, dates, and Korean/Russian terms). This decides the agent's voice.</p>
<table><thead><tr><th>Sentence (Uzbek)</th>${head}</tr></thead><tbody>
${rows}
</tbody></table>
</body></html>`;
}
