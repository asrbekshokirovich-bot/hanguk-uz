// ElevenLabs Scribe speech-to-text (file/async mode) with speaker diarization.
//
// Scribe (scribe_v1) supports Uzbek and returns word-level timestamps plus a
// speaker_id per word, which we fold into speaker "turns". This is our primary
// transcription path; process-call-recording falls back to Gemini audio if it
// fails.
//
// deno-lint-ignore-file no-explicit-any

export interface TranscriptSegment {
  speaker: string;
  start: number | null;
  end: number | null;
  text: string;
}

export interface TranscriptionResult {
  provider: "elevenlabs" | "gemini";
  text: string;
  languageCode: string | null;
  segments: TranscriptSegment[];
  wordCount: number;
}

/**
 * Transcribe audio bytes with ElevenLabs Scribe.
 * `languageCode` is an ISO-639 hint (default "uzb" — Uzbek). Diarization on.
 * `fileName` is sent as the upload's name; its extension should match the audio
 * (Telegram voice notes are OGG/Opus → "voice.ogg"). Defaults to the old
 * "recording.mp3" so existing callers (process-call-recording) are unchanged.
 */
export async function transcribeWithScribe(
  bytes: Uint8Array,
  mimeType: string,
  languageCode = "uzb",
  fileName = "recording.mp3",
): Promise<TranscriptionResult> {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured");

  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("diarize", "true");
  form.append("timestamps_granularity", "word");
  if (languageCode) form.append("language_code", languageCode);
  // `as BlobPart`: TS 5.7+ types Uint8Array<ArrayBufferLike> as not a BlobPart (runtime is fine).
  form.append("file", new Blob([bytes as unknown as BlobPart], { type: mimeType }), fileName || "recording.mp3");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Scribe failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json: any = await res.json();
  const words: any[] = Array.isArray(json.words) ? json.words : [];
  const segments = wordsToSegments(words);

  return {
    provider: "elevenlabs",
    text: typeof json.text === "string" ? json.text : segments.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
    languageCode: json.language_code ?? languageCode ?? null,
    segments,
    wordCount: words.filter((w) => (w.type ?? "word") === "word").length,
  };
}

/** Collapse Scribe's per-word output into contiguous same-speaker turns. */
function wordsToSegments(words: any[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  for (const w of words) {
    const text: string = w.text ?? "";
    if (!text) continue;
    const speaker: string = w.speaker_id ?? "speaker_0";
    const isSpacing = (w.type ?? "word") === "spacing";

    if (!current || (current.speaker !== speaker && !isSpacing)) {
      if (current) segments.push(current);
      current = { speaker, start: w.start ?? null, end: w.end ?? null, text: text };
    } else {
      current.text += text;
      if (typeof w.end === "number") current.end = w.end;
    }
  }
  if (current) segments.push(current);

  // Tidy whitespace.
  return segments.map((s) => ({ ...s, text: s.text.replace(/\s+/g, " ").trim() }))
    .filter((s) => s.text.length > 0);
}
