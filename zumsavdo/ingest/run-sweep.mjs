#!/usr/bin/env node
/**
 * Sweep — bitta yig'ish sessiyasi.
 *
 * Oqim: manba xom o'lchov beradi → o'lchovlar bazaga yoziladi → kunlik
 * yig'indi bazada qayta hisoblanadi. Kunlik raqam hech qachon manbadan
 * to'g'ridan-to'g'ri olinmaydi, u doim ikki o'lchov farqidan chiqadi.
 *
 * Ishga tushirish:
 *   node ingest/run-sweep.mjs              # ZUMSAVDO_SOURCE bo'yicha
 *   node ingest/run-sweep.mjs --probe      # manba javobini bosib chiqaradi
 *   node ingest/run-sweep.mjs --rollup-only
 */

import { loadConfig } from "./config.mjs";
import { createStore } from "./lib/store.mjs";
import { AccessDeniedError } from "./lib/http.mjs";
import { createCatalogSource } from "./sources/catalog.mjs";
import { createSampleSource } from "./sources/sample.mjs";

const SOURCES = {
  sample: createSampleSource,
  "uzum-catalog": createCatalogSource,
};

function log(message) {
  process.stdout.write(`${new Date().toISOString()}  ${message}\n`);
}

/** Toshkent vaqti bo'yicha kun kaliti — rollup ham shu chegarani ishlatadi. */
function tashkentDate(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const config = loadConfig();

  const factory = SOURCES[config.source];
  if (!factory) {
    throw new Error(
      `Noma'lum manba "${config.source}". Mavjud: ${Object.keys(SOURCES).join(", ")}`,
    );
  }

  const source = factory(config);
  const store = createStore(config);
  log(`Manba: ${source.describe()}`);

  if (args.has("--probe")) {
    if (!source.probe) throw new Error(`${source.name} manbasida --probe yo'q.`);
    const result = await source.probe();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (args.has("--rollup-only")) {
    const to = tashkentDate(new Date().toISOString());
    const from = shiftDate(to, -config.rollbackDays);
    const rows = await store.rollup(from, to);
    log(`Rollup ${from}…${to}: ${JSON.stringify(rows)}`);
    return;
  }

  await source.preflight();
  log("Preflight o'tdi.");

  const slots = source.slots();
  log(`${slots.length} ta o'lchov oni.`);

  const touchedDates = new Set();
  let totalCaptured = 0;
  let totalErrors = 0;

  for (const [index, slot] of slots.entries()) {
    // Dry run bazaga umuman tegmaydi — sweep ham ochilmaydi.
    const sweepId = config.dryRun ? null : await store.openSweep(source.name, `slot ${slot.key}`);
    let targets = 0;
    let captured = 0;
    let errors = 0;

    try {
      for await (const batch of source.collect(slot)) {
        targets += batch.shops.length + batch.products.length;
        errors += batch.errors ?? 0;

        if (config.dryRun) {
          captured += batch.shopObservations.length + batch.productObservations.length;
          continue;
        }

        captured += await store.saveBatch(sweepId, batch);

        for (const o of batch.shopObservations) touchedDates.add(tashkentDate(o.observedAt));
        for (const o of batch.productObservations) touchedDates.add(tashkentDate(o.observedAt));
      }
    } catch (error) {
      errors++;
      if (!config.dryRun) {
        await store.closeSweep(sweepId, {
          targets,
          captured,
          errors,
          note: `to'xtadi: ${error.message}`,
        });
      }
      throw error;
    }

    if (!config.dryRun) {
      await store.closeSweep(sweepId, { targets, captured, errors, note: null });
    }

    totalCaptured += captured;
    totalErrors += errors;

    if (slots.length > 1 && (index + 1) % 20 === 0) {
      log(`${index + 1}/${slots.length} o'lchov oni yozildi.`);
    }
  }

  log(`Yozildi: ${totalCaptured} o'lchov, ${totalErrors} xato.`);

  if (config.dryRun) {
    log("Dry run — bazaga hech narsa yozilmadi.");
    return;
  }

  // Yig'indi tegilgan kunlardan bir kun oldin boshlanadi: kunlik farq oldingi
  // kun yakuniga tayanadi.
  const dates = [...touchedDates].sort();
  const from = shiftDate(dates[0] ?? tashkentDate(new Date().toISOString()), -1);
  const to = dates[dates.length - 1] ?? from;
  const rows = await store.rollup(from, to);
  log(`Rollup ${from}…${to}: ${JSON.stringify(rows)}`);
}

function shiftDate(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

main().catch((error) => {
  if (error instanceof AccessDeniedError) {
    process.stderr.write(
      `\nMANBA RUXSAT BERMADI\n${error.message}\n\n` +
        `Uzum katalogi brauzerdan kelmagan so'rovni chekkasidayoq rad etadi.\n` +
        `Buni aylanib o'tish ularning himoyasini sindirish bo'ladi — yig'uvchi\n` +
        `bunday qilmaydi. Kirish huquqi Uzumdan rasmiy olinishi va\n` +
        `UZUM_CATALOG_HEADERS ga qo'yilishi kerak.\n`,
    );
    process.exit(2);
  }
  process.stderr.write(`\nXATO: ${error.message}\n`);
  process.exit(1);
});
