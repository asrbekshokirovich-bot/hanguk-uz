// staff-bot — vazifani talabaga biriktirish (reja B5-2, soddalashtirilgan: faqat talaba biriktirish;
// takrorlanuvchi vazifalar keyingi PR'ga qoldirildi — plan/xodim-boti-v2-reja.md).
//
// «/talaba <ism yoki telefon>» — DM'da bot yuborgan vazifa kartasiga javob sifatida, yoki guruhda bot
// kartasiga javob sifatida. Talaba search_students (mavjud, Hanguk AI qidiruvi bilan bir xil, fuzzy)
// orqali topiladi; aniq bitta mos kelsa bot_set_task_student orqali tasqa biriktiriladi, bir nechta
// mos kelsa — ro'yxat ko'rsatiladi (to'liq ism/telefon bilan aniqlashtirish so'raladi).
// Ruxsat: vazifaning mas'uli, bergan odami yoki owner (bot_set_task_student ham shuni tekshiradi).

import { escapeHtml } from "./core.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export const MAX_STUDENT_RESULTS = 5;

export interface StudentMatch { user_id: string; full_name: string; phone: string | null; score: number }

/**
 * search_students natijasidan: bitta aniq moslik (ishonchli) → shu user_id, bir nechta → ro'yxat,
 * hech biri → null ro'yxat bilan.
 */
export function pickStudentMatch(rows: StudentMatch[]): { user_id: string } | { choices: StudentMatch[] } | null {
  if (!rows.length) return null;
  const [best, second] = rows;
  const confident = best.score >= 0.6 && (rows.length === 1 || best.score - (second?.score ?? 0) >= 0.15);
  if (confident) return { user_id: best.user_id };
  return { choices: rows.slice(0, MAX_STUDENT_RESULTS) };
}

export function renderStudentChoices(query: string, choices: StudentMatch[]): string {
  const list = choices.map((s, i) => `${i + 1}. ${escapeHtml(s.full_name)}${s.phone ? ` (${escapeHtml(s.phone)})` : ""}`).join("\n");
  return `«${escapeHtml(query)}» bo'yicha bir nechta talaba topildi, to'liq ism yoki telefon raqamini yozing:\n${list}`;
}

export const STUDENT_NOT_FOUND = (query: string) => `«${escapeHtml(query)}» bo'yicha talaba topilmadi.`;
export const STUDENT_USAGE = "Talaba ismini yozing: <code>/talaba Familiya Ism</code> (yoki telefon raqami).";
export const STUDENT_NO_TASK = "Bu buyruq faqat bot yuborgan vazifa kartasiga javob sifatida ishlaydi.";

export interface StudentLinkDeps {
  db: Any;
  reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}

export interface StudentLinkActor { user_id: string; roles?: string[] }

/** Vazifaga talaba biriktirish: qidirish, aniqlashtirish yoki saqlash — barchasi shu yerda, javob bilan. */
export async function attachStudentToTask(
  d: StudentLinkDeps, actor: StudentLinkActor, taskId: string, query: string, via: "dm" | "group",
): Promise<void> {
  const q = query.trim();
  if (!q) { await d.reply(STUDENT_USAGE); return; }

  const { data: rows, error: sErr } = await d.db.rpc("search_students", { p_query: q, p_limit: MAX_STUDENT_RESULTS });
  if (sErr) { console.error("search_students:", sErr.message); await d.reply("Qidirishda xatolik, birozdan keyin qayta urinib ko'ring."); return; }
  const match = pickStudentMatch((rows ?? []) as StudentMatch[]);
  if (!match) { await d.reply(STUDENT_NOT_FOUND(q)); return; }
  if ("choices" in match) { await d.reply(renderStudentChoices(q, match.choices)); return; }

  const { data: res, error } = await d.db.rpc("bot_set_task_student",
    { p_actor: actor.user_id, p_task: taskId, p_student: match.user_id, p_via: via });
  const r = (Array.isArray(res) ? res[0] : res) as { result: string; title: string; student_name: string } | undefined;
  if (error || !r) { console.error("bot_set_task_student:", error?.message); await d.reply("Biriktirib bo'lmadi, birozdan keyin qayta urinib ko'ring."); return; }
  if (r.result === "not_found") { await d.reply("Vazifa topilmadi — o'chirilgan bo'lishi mumkin."); return; }
  if (r.result === "not_allowed") { await d.reply("Talabani faqat vazifa mas'uli, bergan odam yoki owner biriktira oladi."); return; }
  if (r.result === "bad_student") { await d.reply(STUDENT_NOT_FOUND(q)); return; }
  await d.reply(`🎓 Talaba biriktirildi: <b>${escapeHtml(r.student_name)}</b>\n📌 ${escapeHtml(r.title)}`);
}
