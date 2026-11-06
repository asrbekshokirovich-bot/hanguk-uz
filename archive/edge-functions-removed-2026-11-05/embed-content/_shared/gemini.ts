// Thin Gemini helpers shared by the communication-intelligence pipeline:
//   * embedText()      — text-embedding-004 (768-dim) for the pgvector store
//   * generateJSON()   — structured analysis with a response schema
//
// deno-lint-ignore-file no-explicit-any

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function apiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

/**
 * Embed a single string with text-embedding-004 (768 dims).
 */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT",
): Promise<number[]> {
  const res = await fetch(
    `${GEMINI_BASE}/models/text-embedding-004:embedContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: text.slice(0, 8000) }] },
        taskType,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini embed failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const values = json?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini embed: no vector in response");
  return values;
}

/** L2-normalise a vector (returns a new array). */
function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (!norm || !Number.isFinite(norm)) return v;
  return v.map((x) => x / norm);
}

/**
 * Embed a single string with gemini-embedding-001 (Phase 2 hybrid store).
 * MRL output truncated to outputDim (default 1536) + L2-normalised.
 */
export async function embedContent001(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT",
  outputDim = 1536,
): Promise<number[]> {
  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-embedding-001:embedContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: text.slice(0, 8000) }] },
        taskType,
        outputDimensionality: outputDim,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini embed (001) failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const values = json?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini embed (001): no vector in response");
  return outputDim === 3072 ? values : l2normalize(values);
}

/**
 * Run a Gemini model with a JSON response schema and return the parsed object.
 */
export async function generateJSON<T = any>(args: {
  prompt: string;
  schema: Record<string, unknown>;
  model?: string;
  systemInstruction?: string;
  temperature?: number;
}): Promise<T | null> {
  const model = args.model ?? "gemini-2.5-flash";
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: args.prompt }] }],
    generationConfig: {
      temperature: args.temperature ?? 0.2,
      responseMimeType: "application/json",
      responseSchema: args.schema,
    },
  };
  if (args.systemInstruction) {
    body.systemInstruction = { parts: [{ text: args.systemInstruction }] };
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini generate failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch (_e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch (_e2) { /* fall through */ }
    }
    console.error("generateJSON: unparseable response:", text.slice(0, 500));
    return null;
  }
}

/**
 * Transcribe audio directly with Gemini (fallback path).
 */
export async function transcribeAudioWithGemini(
  audioBase64: string,
  mimeType: string,
  hintLanguage = "Uzbek",
): Promise<string> {
  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-2.5-flash:generateContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            {
              text:
                `Transcribe this phone call verbatim. The conversation is mostly in ${hintLanguage}, ` +
                `possibly code-switching to Russian or Korean. Preserve the original language(s). ` +
                `Label speakers as "Operator:" and "Caller:" on separate lines when you can tell them apart. ` +
                `Output only the transcript.`,
            },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini transcribe failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
}
