// Fetch a call recording's bytes server-side.
//
// Mirrors the auth approach in the mediateka-recording proxy: Mediateka
// recordings live behind hanguk.sip.uz and accept the CRM API key as a Bearer
// token. We pull the raw bytes here so they can be handed to a transcription
// provider (which needs the audio, not a private URL).

export interface FetchedAudio {
  bytes: Uint8Array;
  mimeType: string;
}

export async function fetchRecording(
  recordingUrl: string,
  voipProvider: string | null,
): Promise<FetchedAudio> {
  const headers: Record<string, string> = {};
  const apiKey = Deno.env.get("MEDIATEKA_API_KEY");
  if (apiKey && voipProvider === "mediateka") {
    headers["authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(recordingUrl, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Recording fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const mimeType = res.headers.get("content-type") || "audio/mpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new Error("Recording fetch returned 0 bytes");
  }
  return { bytes: buf, mimeType };
}

/** Base64-encode bytes in chunks (avoids call-stack overflow on big buffers). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
