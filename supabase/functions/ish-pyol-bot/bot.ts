// ish-pyol-bot — the conversation (2026-11-25). Pure: index.ts gives it the
// database and Telegram (Deps), so bot_test.ts runs it without either.
//
//   /start → «Write your phone or invite code»
//   phone / code → the worker (bot_find_worker) → the packs (buttons)
//   a pack → where to send the money (payment_settings, as in the CRM)
//   a screenshot → a top-up request (bot_request_topup), the staff check it
//   in the CRM; the app says «+100 puyl» when they approve.

export interface Pack {
  pyols: number;
  won: number;
}

export interface Worker {
  worker_id: string;
  name: string;
  balance: number;
}

export interface Chat {
  worker_id: string | null;
  pyols: number | null;
}

export interface Deps {
  chat(chatId: number): Promise<Chat | null>;
  saveChat(chatId: number, chat: Chat): Promise<void>;
  findWorker(text: string): Promise<Worker | null>;
  details(): Promise<{ packs: Pack[]; methods: Record<string, string> }>;
  /** Downloads the Telegram file and stores it; returns its storage path. */
  storeProof(workerId: string, fileId: string): Promise<string>;
  /** bot_request_topup; throws an Error whose message is the database code. */
  requestTopup(workerId: string, pyols: number, payer: string, proof: string): Promise<void>;
  send(chatId: number, text: string, buttons?: { text: string; data: string }[][]): Promise<void>;
  answerCallback(id: string): Promise<void>;
}

export const T = {
  hello: "Assalomu alaykum! Bu — Hanguk Ish puyl boti.\n\n" +
    "Hanguk Ish ilovasidagi telefon raqamingizni (010-…) yoki «Puyl olish» sahifasidagi taklif kodingizni yozing.",
  notFound: "Topilmadi. Ilovada ro'yxatdan o'tgan telefon raqamingizni (010-…) yoki taklif kodingizni (6 ta belgi) yozing.\n\n" +
    "Hali ro'yxatdan o'tmagan bo'lsangiz, avval Hanguk Ish ilovasida profilni to'ldiring.",
  found: (w: Worker) => `Topildi: ${w.name}\nBalans: ${w.balance} P\n\nQancha puyl kerak?`,
  choose: "Qancha puyl kerak?",
  noDetails: "To'lov ma'lumotlari hali kiritilmagan. Iltimos, keyinroq urinib ko'ring.",
  pay: (p: Pack, methods: Record<string, string>) => {
    const lines = [`${p.pyols} P = ${wonText(p.won)}`, "", "Pulni shu yerga yuboring:"];
    if (methods.bank) lines.push(`🏦 Bank: ${methods.bank}`);
    if (methods.kakaopay) lines.push(`💛 KakaoPay: ${methods.kakaopay}`);
    if (methods.toss) lines.push(`💙 Toss: ${methods.toss}`);
    if (methods.note) lines.push("", methods.note);
    lines.push("", "To'lagach, to'lov skrinshotini shu chatga yuboring.");
    return lines.join("\n");
  },
  needPack: "Avval paketni tanlang:",
  needWorker: "Avval ilovadagi telefon raqamingizni yoki taklif kodingizni yozing.",
  thanks: "Rahmat! So'rovingiz qabul qilindi. Xodim pulni tekshirgach, puyl ilovangizga tushadi va xabar keladi.",
  tooMany: "Sizda 3 ta tekshirilayotgan so'rov bor. Ular tekshirilgach, yana yuboring.",
  error: "Xatolik yuz berdi. Iltimos, birozdan keyin qayta urinib ko'ring.",
  photoOnly: "Skrinshotni rasm sifatida yuboring.",
};

export function wonText(won: number): string {
  return `${String(won).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₩`;
}

function packButtons(packs: Pack[]) {
  return packs.map((p) => [{ text: `${p.pyols} P — ${wonText(p.won)}`, data: `pack:${p.pyols}` }]);
}

// deno-lint-ignore no-explicit-any
type Update = any;

/** Handles one Telegram update. */
export async function handle(update: Update, deps: Deps): Promise<void> {
  const callback = update?.callback_query;
  if (callback) {
    const chatId = callback.message?.chat?.id;
    await deps.answerCallback(String(callback.id));
    if (typeof chatId !== "number") return;
    const pyols = Number(String(callback.data ?? "").replace(/^pack:/, ""));
    const chat = await deps.chat(chatId);
    if (!chat?.worker_id) return deps.send(chatId, T.needWorker);
    const { packs, methods } = await deps.details();
    const pack = packs.find((p) => p.pyols === pyols);
    if (!pack) return deps.send(chatId, T.choose, packButtons(packs));
    if (!methods.bank && !methods.kakaopay && !methods.toss) return deps.send(chatId, T.noDetails);
    await deps.saveChat(chatId, { worker_id: chat.worker_id, pyols });
    return deps.send(chatId, T.pay(pack, methods));
  }

  const msg = update?.message;
  const chatId = msg?.chat?.id;
  if (typeof chatId !== "number" || msg?.chat?.type !== "private") return;
  const text = String(msg.text ?? "").trim();
  const chat = await deps.chat(chatId);

  // A screenshot: a photo, or an image sent as a file.
  const photo = Array.isArray(msg.photo) && msg.photo.length > 0 ? msg.photo[msg.photo.length - 1] : null;
  const imageDoc = msg.document && String(msg.document.mime_type ?? "").startsWith("image/") ? msg.document : null;
  const file = photo ?? imageDoc;
  if (file || msg.document) {
    if (!file) return deps.send(chatId, T.photoOnly);
    if (!chat?.worker_id) return deps.send(chatId, T.needWorker);
    if (!chat.pyols) {
      const { packs } = await deps.details();
      return deps.send(chatId, T.needPack, packButtons(packs));
    }
    const from = msg.from ?? {};
    const payer = [from.first_name, from.last_name].filter(Boolean).join(" ") +
      (from.username ? ` (@${from.username})` : "") + " · Telegram";
    try {
      const path = await deps.storeProof(chat.worker_id, String(file.file_id));
      await deps.requestTopup(chat.worker_id, chat.pyols, payer, path);
    } catch (e) {
      return deps.send(chatId, (e as Error).message === "TOO_MANY" ? T.tooMany : T.error);
    }
    await deps.saveChat(chatId, { worker_id: chat.worker_id, pyols: null });
    return deps.send(chatId, T.thanks);
  }

  if (text === "" || text === "/start" || text.startsWith("/start ")) {
    return deps.send(chatId, T.hello);
  }

  // A phone or a code: (re)link the chat.
  if (/^[+\d][\d\s-]{8,}$/.test(text) || /^[A-Za-z0-9]{6}$/.test(text)) {
    const worker = await deps.findWorker(text);
    if (!worker) return deps.send(chatId, T.notFound);
    await deps.saveChat(chatId, { worker_id: worker.worker_id, pyols: null });
    const { packs } = await deps.details();
    return deps.send(chatId, T.found(worker), packButtons(packs));
  }

  if (!chat?.worker_id) return deps.send(chatId, T.hello);
  const { packs } = await deps.details();
  return deps.send(chatId, T.choose, packButtons(packs));
}
