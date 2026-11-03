// Testlar uchun kichik yordamchilar (tashqi kutubxonasiz).
export function assert(cond: unknown, msg = "assert"): asserts cond {
  if (!cond) throw new Error(msg);
}

export function assertEquals<T>(actual: T, expected: T, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ? msg + ": " : ""}kutilgan ${e}, keldi ${a}`);
}

export const TEST_SECRET = "test-secret-0123456789-abcdefghijklmnop";
export const HEALTH_KEY = "health-key-0123456789";

export function waitFor(cond: () => boolean, timeoutMs = 3000, stepMs = 10): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (cond()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error("waitFor: vaqt tugadi"));
      setTimeout(tick, stepMs);
    };
    tick();
  });
}

export interface WsProbe {
  ws: WebSocket;
  messages: (string | ArrayBuffer)[];
  opened: Promise<void>;
  closed: Promise<CloseEvent>;
}

/** Deno WebSocket mijozi Origin sarlavhasini yubora oladi (brauzer kabi). */
export function openWs(url: string, origin = "https://hanguk.uz"): WsProbe {
  // deno-lint-ignore no-explicit-any
  const ws: WebSocket = new (WebSocket as any)(url, { headers: { origin } });
  ws.binaryType = "arraybuffer";
  const messages: (string | ArrayBuffer)[] = [];
  ws.onmessage = (e) => messages.push(e.data);
  const opened = new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("ws ochilmadi")), { once: true });
  });
  const closed = new Promise<CloseEvent>((resolve) => ws.addEventListener("close", (e) => resolve(e), { once: true }));
  return { ws, messages, opened, closed };
}
