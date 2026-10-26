// The app's HOZIR signal in Telegram (app analytics, stage 3; the marketing
// plan's signal 1): a new request from the app — the lead form, or a Telegram
// chat that carried the app's code — that nobody answered within 10 minutes.
// app_signal_alerts (20261029090000_app_person_profile.sql) hands over each
// task once its timer runs out, except the ones the lead SLA already sends (a
// new lead with a phone on a working day): those get «📱 Ilova» in the SLA's
// own text instead (index.ts). On working days 09:00–18:00 the alert goes to
// the staff channel and every recipient, 18:00–22:00 to the boss
// (lead_alert_recipients where watchdog); at night and on Sunday the task
// waits for the next working morning (Q92).
// deno-lint-ignore-file no-explicit-any

type Admin = any;
type Send = (chatId: string, text: string) => Promise<boolean>;

interface AppAlert {
  id: number;
  lead_id: string;
  full_name: string | null;
  phone: string | null;
  how_heard: string | null;
  source: string | null;
  via: string | null;
  target: "operators" | "boss";
  asked_at: string;
  minutes_waiting: number;
}

export function composeAppAlert(a: AppAlert): string {
  const name = a.full_name || "(ismsiz lid)";
  const phone = a.phone ? `\nTelefon: ${a.phone}` : "";
  const via = a.how_heard || a.source;
  const source = via ? `\nManba: ${via}` : "";
  const how = a.via === "telegram" ? "Telegram (ilova kodi bilan)" : "ilovadagi forma";
  return [
    `📱 Ilovadan murojaat — ${a.minutes_waiting} daqiqadan beri javob yo'q!`,
    ``,
    name + phone + source,
    `Yo'l: ${how}`,
    ``,
    `CRM → Bugun ilovada bo'limida ko'ring.`,
  ].join("\n");
}

export async function sendAppSignalAlerts(
  supabase: Admin,
  dry: boolean,
  send: Send,
  everyone: () => Promise<string[]>,
  boss: () => Promise<string[]>,
): Promise<{ due: number; sent: number; alerts?: AppAlert[] }> {
  const { data, error } = await supabase.rpc("app_signal_alerts", { p_dry: dry });
  if (error) {
    // The migration may not be applied yet; the lead SLA goes on regardless.
    console.error("lead-sla-check: app_signal_alerts:", error.message);
    return { due: 0, sent: 0 };
  }
  const alerts = (data ?? []) as AppAlert[];
  if (dry || !alerts.length) return { due: alerts.length, sent: 0, alerts: dry ? alerts : undefined };

  const chats = {
    operators: alerts.some((a) => a.target === "operators") ? await everyone() : [],
    boss: alerts.some((a) => a.target === "boss") ? await boss() : [],
  };
  let sent = 0;
  for (const a of alerts) {
    const to = chats[a.target] ?? [];
    if (!to.length) console.warn(`lead-sla-check: no recipient for the app signal (${a.target})`);
    let delivered = false;
    for (const chat of to) {
      if (await send(chat, composeAppAlert(a))) delivered = true;
    }
    if (delivered) sent++;
  }
  return { due: alerts.length, sent };
}
