import { createClient } from "@supabase/supabase-js";

/**
 * Supabase ga yozish.
 *
 * Ma'lumot `zumsavdo` sxemasida turadi, PostgREST esa faqat `public` ni
 * ko'radi — shuning uchun yozish `public.zs_*` funksiyalari orqali boradi.
 * Bir partiya bitta chaqiruv: lug'atlar va o'lchovlar bir tranzaksiyada
 * yoziladi, yarim yozilgan sweep qolmaydi.
 *
 * Har bir yozuv idempotent: kalit (sweep_id, obyekt_id), shuning uchun sweep
 * qayta ishga tushsa ham o'lchov takrorlanmaydi.
 */

/** Bir chaqiruvdagi eng ko'p o'lchov soni. */
const CHUNK = 400;

export function createStore(config) {
  const db = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: { persistSession: false },
  });

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error(`${name} bajarilmadi: ${error.message}`);
    return data;
  }

  return {
    async openSweep(source, note) {
      return rpc("zs_open_sweep", { p_source: source, p_note: note ?? null });
    },

    async closeSweep(id, { targets, captured, errors, note }) {
      await rpc("zs_close_sweep", {
        p_sweep_id: id,
        p_targets: targets,
        p_captured: captured,
        p_errors: errors,
        p_note: note ?? null,
      });
    },

    /**
     * Partiyani yozadi. O'lchovlar ko'p bo'lsa bo'laklarga bo'linadi, lug'at
     * esa har bo'lakda takrorlanadi — u idempotent, zarari yo'q.
     */
    async saveBatch(sweepId, batch) {
      const shopObs = batch.shopObservations ?? [];
      const productObs = batch.productObservations ?? [];
      const steps = Math.max(1, Math.ceil(productObs.length / CHUNK));
      let written = 0;

      for (let i = 0; i < steps; i++) {
        const payload = {
          categories: i === 0 ? dedupe(batch.categories ?? []) : [],
          shops: i === 0 ? batch.shops ?? [] : [],
          products: i === 0 ? batch.products ?? [] : [],
          shopObservations: i === 0 ? shopObs : [],
          productObservations: productObs.slice(i * CHUNK, (i + 1) * CHUNK),
        };
        written += (await rpc("zs_ingest_batch", {
          p_sweep_id: sweepId,
          p_payload: payload,
        })) ?? 0;
      }

      return written;
    },

    /** Kunlik yig'indini qayta hisoblash. */
    async rollup(fromDate, toDate) {
      const rows = await rpc("zs_rollup_days", { from_date: fromDate, to_date: toDate });
      return Array.isArray(rows) ? rows[0] : rows;
    },
  };
}

/** Bir partiyada turkum bir necha marta uchraydi — takrorlari olib tashlanadi. */
function dedupe(items) {
  const seen = new Map();
  for (const item of items) seen.set(item.id, item);
  return [...seen.values()];
}
