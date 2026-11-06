import { assertEquals } from "jsr:@std/assert@1";
import { createEmbedOps, EMBED_BACKFILL_BATCH } from "./embed.ts";

function stubDb(opts: { rpcErr?: string; backfillRows?: { id: string; text: string }[] } = {}) {
  const calls: { fn: string; args: unknown }[] = [];
  const db = {
    rpc: (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "bot_embed_backfill_claim") {
        return Promise.resolve({ data: opts.backfillRows ?? [], error: null });
      }
      if (fn === "bot_embed_set") {
        return Promise.resolve({ data: null, error: opts.rpcErr ? { message: opts.rpcErr } : null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from: () => ({ insert: () => Promise.resolve({ error: null }) }),
  };
  return { db, calls };
}

Deno.test("embedJob: VOYAGE_API_KEY yo'q bo'lsa — ishni bekor qiladi (xato emas)", async () => {
  const { db } = stubDb();
  const ops = createEmbedOps({ db, key: "" });
  const r = await ops.embedJob({ id: "j1", kind: "group_embed", attempts: 1, payload: { message_id: "m1", text: "salom" } });
  assertEquals(r, undefined);
});

Deno.test("embedJob: yaroqsiz payload — xato emas, ish bekor", async () => {
  const { db } = stubDb();
  const ops = createEmbedOps({ db, key: "k" });
  const r = await ops.embedJob({ id: "j1", kind: "group_embed", attempts: 1, payload: {} });
  assertEquals(r, undefined);
});

Deno.test("embedJob: muvaffaqiyatli — bot_embed_set chaqiradi, xato qaytarmaydi", async () => {
  const { db, calls } = stubDb();
  const embed = (texts: string[], _type: "document" | "query") => Promise.resolve(texts.map(() => [0.1, 0.2, 0.3]));
  const ops = createEmbedOps({ db, key: "k", embed: embed as never });
  const r = await ops.embedJob({ id: "j1", kind: "group_embed", attempts: 1, payload: { message_id: "m1", text: "kamera haqida" } });
  assertEquals(r, undefined);
  assertEquals(calls.some((c) => c.fn === "bot_embed_set" && (c.args as Record<string, unknown>).p_message_id === "m1"), true);
});

Deno.test("embedJob: Voyage xato bersa — xato matni qaytaradi (qayta urinishga qo'yiladi)", async () => {
  const { db } = stubDb();
  const embed = () => Promise.reject(new Error("voyage 429: rate limited"));
  const ops = createEmbedOps({ db, key: "k", embed: embed as never });
  const r = await ops.embedJob({ id: "j1", kind: "group_embed", attempts: 1, payload: { message_id: "m1", text: "x" } });
  assertEquals(typeof r, "string");
  assertEquals((r ?? "").includes("429"), true);
});

Deno.test("embedJob: bot_embed_set xato bersa — xato matni qaytaradi", async () => {
  const { db } = stubDb({ rpcErr: "db xato" });
  const embed = (texts: string[]) => Promise.resolve(texts.map(() => [0.1]));
  const ops = createEmbedOps({ db, key: "k", embed: embed as never });
  const r = await ops.embedJob({ id: "j1", kind: "group_embed", attempts: 1, payload: { message_id: "m1", text: "x" } });
  assertEquals(r, "db xato");
});

Deno.test("backfillBatch: kalit yo'q — skipped true, 0 embedded", async () => {
  const { db } = stubDb();
  const ops = createEmbedOps({ db, key: "" });
  const r = await ops.backfillBatch();
  assertEquals(r, { embedded: 0, skipped: true });
});

Deno.test("backfillBatch: qator yo'q — 0 embedded, skipped false", async () => {
  const { db } = stubDb({ backfillRows: [] });
  const ops = createEmbedOps({ db, key: "k" });
  const r = await ops.backfillBatch();
  assertEquals(r, { embedded: 0, skipped: false });
});

Deno.test("backfillBatch: bir nechta qatorni vektorlaydi", async () => {
  const rows = [{ id: "a", text: "birinchi" }, { id: "b", text: "ikkinchi" }];
  const { db, calls } = stubDb({ backfillRows: rows });
  const embed = (texts: string[]) => Promise.resolve(texts.map(() => [0.5]));
  const ops = createEmbedOps({ db, key: "k", embed: embed as never });
  const r = await ops.backfillBatch(10);
  assertEquals(r.embedded, 2);
  assertEquals(calls.filter((c) => c.fn === "bot_embed_set").length, 2);
});

Deno.test("EMBED_BACKFILL_BATCH standart qiymat", () => {
  assertEquals(EMBED_BACKFILL_BATCH, 50);
});
