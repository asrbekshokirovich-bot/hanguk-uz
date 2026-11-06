// Xodim boti guruh tarixi — semantik qidiruv uchun embedding ishi (B3-2).
//
// Migratsiya (20261106140000_staff_group_embeddings.sql) staff_group_messages'ga
// `embedding vector(1024)` ustuni qo'shadi va har INSERT'da bot_jobs navbatiga
// `group_embed` ishi tushiradi (trigger). Bu modul shu ishni bajaradi: Voyage AI
// bilan matnni vektorlab, bazaga yozadi (`bot_embed_set` RPC). VOYAGE_API_KEY
// bo'lmasa — ish shunchaki "kerak emas" deb yakunlanadi (lexical qidiruv ishlaydi).
//
// Orttirilgan (eski) xabarlar uchun — `?action=embed_backfill` (cron yoki qo'lda):
// `bot_embed_backfill_claim` bilan navbatsiz, to'g'ridan-to'g'ri eski yozuvlarni oladi.
//
// deno-lint-ignore-file no-explicit-any
import { voyageEmbed, voyageKey } from "../_shared/voyage.ts";
import type { Db, JobRow } from "./aiops.ts";

export const EMBED_BACKFILL_BATCH = 50;

export interface EmbedDeps {
  db: Db & { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
  embed?: typeof voyageEmbed;
  key?: string;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** `bot_jobs` ish bajaruvchisi (kind = 'group_embed'): bitta xabarni vektorlaydi. */
export function createEmbedOps(deps: EmbedDeps) {
  const { db } = deps;
  const embed = deps.embed ?? voyageEmbed;
  const key = deps.key ?? voyageKey();

  async function embedTexts(texts: string[]): Promise<number[][] | null> {
    if (!key) return null; // VOYAGE_API_KEY yo'q — lexical bilan qolamiz.
    return await embed(texts, "document", key);
  }

  /** `runJobs({ group_embed: embedJob })`. Xato qaytarsa — qayta urinishga qo'yiladi. */
  async function embedJob(job: JobRow): Promise<string | undefined> {
    // staff_group_messages.id — bigint; trigger uni jsonb_build_object orqali raqam sifatida yuboradi.
    const rawId = job.payload?.message_id;
    const messageId = typeof rawId === "number" || typeof rawId === "string" ? rawId : "";
    const text = typeof job.payload?.text === "string" ? job.payload.text : "";
    if (!messageId || !text) return undefined; // yaroqsiz payload — qayta urinmaymiz
    if (!key) return undefined; // kalit yo'q — ish bekor, keyin kalit qo'yilsa backfill qamrab oladi

    let vecs: number[][] | null;
    try {
      vecs = await embedTexts([text]);
      if (!vecs) return undefined;
    } catch (e) {
      return errText(e);
    }
    try {
      const { error } = await db.rpc("bot_embed_set", { p_message_id: messageId, p_embedding: vecs[0] });
      if (error) return error.message.slice(0, 300);
      return undefined;
    } catch (e) {
      return errText(e);
    }
  }

  /** Eski xabarlarni (embedding yo'q) partiyalab vektorlaydi; bir chaqiruv ≤ EMBED_BACKFILL_BATCH. */
  async function backfillBatch(limit: number = EMBED_BACKFILL_BATCH): Promise<{ embedded: number; skipped: boolean; error?: string }> {
    if (!key) return { embedded: 0, skipped: true };
    let rows: { id: string; text: string }[];
    try {
      const { data, error } = await db.rpc("bot_embed_backfill_claim", { p_limit: limit });
      if (error) return { embedded: 0, skipped: false, error: error.message.slice(0, 300) };
      rows = Array.isArray(data) ? (data as any[]).map((r) => ({ id: r.id, text: r.text })) : [];
    } catch (e) {
      return { embedded: 0, skipped: false, error: errText(e) };
    }
    if (!rows.length) return { embedded: 0, skipped: false };

    let vecs: number[][] | null;
    try {
      vecs = await embedTexts(rows.map((r) => r.text));
      if (!vecs) return { embedded: 0, skipped: true };
    } catch (e) {
      return { embedded: 0, skipped: false, error: errText(e) };
    }

    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        const { error } = await db.rpc("bot_embed_set", { p_message_id: rows[i].id, p_embedding: vecs[i] });
        if (!error) n++;
      } catch {
        // keyingi partiyada qayta urinib ko'radi
      }
    }
    return { embedded: n, skipped: false };
  }

  return { embedJob, backfillBatch };
}
