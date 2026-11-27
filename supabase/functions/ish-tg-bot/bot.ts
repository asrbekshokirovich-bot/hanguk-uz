// The HanPyol bot's own replies (2026-11-27): /start greets the person and
// gives the button that opens the mini app; /start <invite code> (the link
// t.me/<bot>?start=<code> a worker shares) carries the code into the app,
// which fills it in for the newcomer.

/** The invite code in «/start <code>», when it looks like one. */
export function startCode(text: string): string | null {
  const m = /^\/start(?:@\w+)?\s+([A-Za-z0-9]{4,16})\s*$/.exec(text.trim());
  return m ? m[1].toUpperCase() : null;
}

const TEXTS: Record<string, { hello: string; other: string; open: string }> = {
  uz: {
    hello:
      "Assalomu alaykum! 👋\n\n<b>HanPyol</b> — Koreyada kunlik (주간/야간) va oylik ishlar.\n\n" +
      "• Bo'sh kunlaringizni belgilang — siz uchun ish topamiz\n• Ro'yxatdan o'tganda 90 P bepul\n\n" +
      "Boshlash uchun pastdagi tugmani bosing 👇",
    other: "Ilovani ochish uchun pastdagi «HanPyol» tugmasini bosing 👇",
    open: "HanPyol'ni ochish",
  },
  ru: {
    hello:
      "Здравствуйте! 👋\n\n<b>HanPyol</b> — работа в Корее на день (주간/야간) и на месяц.\n\n" +
      "• Отметьте свободные дни — мы найдём вам работу\n• При регистрации 90 P бесплатно\n\n" +
      "Чтобы начать, нажмите кнопку ниже 👇",
    other: "Чтобы открыть приложение, нажмите кнопку «HanPyol» ниже 👇",
    open: "Открыть HanPyol",
  },
};

/** The greeting (or the short hint for any other message), with the button. */
export function reply(chatId: number, text: string, language: string, appUrl: string) {
  const t = TEXTS[language === "ru" ? "ru" : "uz"];
  const code = startCode(text);
  const isStart = /^\/start\b/.test(text.trim());
  const url = code ? `${appUrl}${appUrl.includes("?") ? "&" : "?"}ref=${code}` : appUrl;
  return {
    chat_id: chatId,
    text: isStart ? t.hello : t.other,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: t.open, web_app: { url } }]] },
  };
}

/** The webhook's secret (setWebhook secret_token): from the bot token, so no extra setting. */
export async function webhookSecret(botToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(botToken));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
