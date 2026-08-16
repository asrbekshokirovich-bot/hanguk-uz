import { setDataStart } from "@/lib/dates";
import { setDataset } from "./dataset";
import { isRemoteConfigured, loadRemoteDataset } from "./remote";

/**
 * Panel qaysi maʻlumot bilan ochilgani.
 *
 * Bu holat interfeysda koʻrsatiladi: namuna toʻplami haqiqiy oʻlchov kabi
 * koʻrinib qolsa, panelning butun maʻnosi yoʻqoladi.
 */
export type DataMode = "remote" | "sample";

export interface BootResult {
  mode: DataMode;
  /** Omborga ulanib boʻlmagan boʻlsa — sababi. */
  fallbackReason?: string;
}

/**
 * Ombor shuncha vaqtda javob bermasa, panel namuna bilan ochiladi.
 *
 * Cheklovsiz kutish eng yomon holat: soʻrov osilib qolsa, foydalanuvchi
 * abadiy yuklanish ekranini koʻradi va nima boʻlganini bilmaydi.
 */
const LOAD_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Ombor ${ms / 1000} soniyada javob bermadi.`)),
        ms,
      ),
    ),
  ]);
}

export async function bootstrap(): Promise<BootResult> {
  if (!isRemoteConfigured()) {
    return {
      mode: "sample",
      fallbackReason:
        "Ombor sozlanmagan (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY yoʻq).",
    };
  }

  try {
    const dataset = await withTimeout(loadRemoteDataset(), LOAD_TIMEOUT_MS);
    setDataset(dataset);
    // Davr tanlagich eng eski oʻlchovdan orqaga chiqmasligi kerak.
    if (dataset.dates.length) setDataStart(dataset.dates[0]);
    return { mode: "remote" };
  } catch (error) {
    return {
      mode: "sample",
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}
