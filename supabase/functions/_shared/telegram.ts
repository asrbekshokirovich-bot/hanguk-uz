// Shared Telegram Bot API helpers for Supabase Edge Functions (Deno).
//
// Used by `telegram-webhook` (incoming updates + canned bot replies) and
// `send-telegram` (outgoing staff replies from the CRM inbox).

const TELEGRAM_API = "https://api.telegram.org";

export interface TelegramSendOptions {
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  reply_markup?: unknown;
  disable_web_page_preview?: boolean;
  reply_to_message_id?: number;
}

export interface TelegramApiResult<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

/** Low-level call to the Telegram Bot API. Never throws — returns `{ ok: false }`. */
export async function callTelegram<T = unknown>(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<TelegramApiResult<T>> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data: TelegramApiResult<T>;
    try {
      data = await res.json();
    } catch {
      data = { ok: false, description: `Non-JSON response (HTTP ${res.status})` };
    }
    if (!data.ok) {
      console.error(`Telegram ${method} failed (${res.status}):`, data.description);
    }
    return data;
  } catch (error) {
    const description = error instanceof Error ? error.message : "Network error";
    console.error(`Telegram ${method} threw:`, description);
    return { ok: false, description };
  }
}

/** Send a text message to a chat. */
export function sendTelegramMessage(
  token: string,
  chatId: string | number,
  text: string,
  options: TelegramSendOptions = {},
): Promise<TelegramApiResult> {
  return callTelegram(token, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...options,
  });
}

/** Acknowledge a callback query so the client stops showing a loading spinner. */
export function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
): Promise<TelegramApiResult> {
  return callTelegram(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

/**
 * Reply keyboard whose first button asks the user to share their phone number
 * in one tap. `extraRows` are plain quick-reply buttons (their label is sent
 * back as a normal text message when tapped — no callback handling needed).
 */
export function contactRequestKeyboard(
  contactButtonText: string,
  extraRows: string[][] = [],
) {
  return {
    keyboard: [
      [{ text: contactButtonText, request_contact: true }],
      ...extraRows.map((row) => row.map((text) => ({ text }))),
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function removeKeyboard() {
  return { remove_keyboard: true };
}
