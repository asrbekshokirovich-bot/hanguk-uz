// The guest's reminder text, in the phone's language. A guest has no
// consultant, so the message points at the university's page in the app.
import type { Kind, Lang } from "./plan.ts";

export interface Text {
  title: string;
  body: string;
}

const AND: Record<Lang, string> = { uz: "va", ru: "и", en: "and", ko: "및", vi: "và" };

export function list(names: string[], lang: Lang): string {
  const n = names.filter((x) => x.trim() !== "");
  if (n.length <= 1) return n[0] ?? "";
  if (n.length > 3) return `${n.slice(0, 3).join(", ")} +${n.length - 3}`;
  return `${n.slice(0, -1).join(", ")} ${AND[lang]} ${n[n.length - 1]}`;
}

const ru = (d: number) => (d === 3 ? "дня" : "дней");

function deadline(days: number, lang: Lang, names: string): Text {
  const last = days === 1;
  switch (lang) {
    case "ru":
      return {
        title: last ? "Завтра заканчивается онлайн-подача ⏰" : `До конца онлайн-подачи ${days} ${ru(days)} ⏰`,
        body: `${names}: онлайн-подача заявок заканчивается ${last ? "завтра" : `через ${days} ${ru(days)}`}. Этапы и список документов — в приложении.`,
      };
    case "en":
      return {
        title: last ? "Online application closes tomorrow ⏰" : `${days} days left to apply online ⏰`,
        body: `${names}: the online application closes ${last ? "tomorrow" : `in ${days} days`}. See the steps and the document list in the app.`,
      };
    case "ko":
      return {
        title: last ? "온라인 지원 마감 하루 전 ⏰" : `온라인 지원 마감 ${days}일 전 ⏰`,
        body: `${names}: 온라인 지원이 ${last ? "내일" : `${days}일 후`} 마감됩니다. 앱에서 일정과 서류 목록을 확인하세요.`,
      };
    case "vi":
      return {
        title: last ? "Ngày mai hết hạn nộp hồ sơ trực tuyến ⏰" : `Còn ${days} ngày để nộp hồ sơ trực tuyến ⏰`,
        body: `${names}: hạn nộp hồ sơ trực tuyến kết thúc ${last ? "vào ngày mai" : `sau ${days} ngày`}. Xem các bước và danh sách giấy tờ trong ứng dụng.`,
      };
    default:
      return {
        title: last ? "Ertaga onlayn ariza muddati tugaydi ⏰" : `Onlayn arizaga ${days} kun qoldi ⏰`,
        body: `${names}: onlayn ariza topshirish muddati ${last ? "ertaga" : `${days} kundan keyin`} tugaydi. Bosqichlar va hujjatlar ro'yxatini ilovada ko'ring.`,
      };
  }
}

function guidelineNew(lang: Lang, names: string): Text {
  switch (lang) {
    case "ru":
      return { title: "Новые правила приёма 📄", body: `${names}: опубликованы правила приёма на новый семестр. Посмотрите сроки в приложении.` };
    case "en":
      return { title: "New admission guide 📄", body: `${names}: the admission guide for the new semester is out. Check the dates in the app.` };
    case "ko":
      return { title: "새 모집요강 📄", body: `${names}: 새 학기 모집요강이 나왔습니다. 앱에서 일정을 확인하세요.` };
    case "vi":
      return { title: "Có hướng dẫn tuyển sinh mới 📄", body: `${names}: đã có hướng dẫn tuyển sinh kỳ mới. Xem lịch trong ứng dụng.` };
    default:
      return { title: "Yangi qabul yo'riqnomasi 📄", body: `${names}: yangi semestr qabul yo'riqnomasi chiqdi. Sanalarni ilovada ko'ring.` };
  }
}

export function messageText(kind: Kind, lang: Lang, names: string[]): Text {
  const n = list(names, lang);
  if (kind === "guideline_new") return guidelineNew(lang, n);
  return deadline(Number(kind.split("_")[1]), lang, n);
}

/** What the app gets (notification_service.dart routes guest_deadline and
 *  guideline_new with an institution_id to that university). */
export function pushData(kind: Kind, institutionId: string): Record<string, string> {
  return {
    type: kind === "guideline_new" ? "guideline_new" : "guest_deadline",
    kind,
    institution_id: institutionId,
  };
}

/** Korean phones see the Korean name, the rest the English one. */
export function nameFor(row: { name_en: string | null; name_ko: string | null }, lang: Lang): string {
  const en = (row.name_en ?? "").trim();
  const ko = (row.name_ko ?? "").trim();
  return lang === "ko" ? ko || en : en || ko;
}

/** The Telegram form (P16): HTML, the title bold; the bot's «To'xtatish» stops it. */
export function telegramHtml(t: Text): string {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<b>${esc(t.title)}</b>\n\n${esc(t.body)}`;
}

const STOP: Record<Lang, string> = { uz: "To'xtatish", ru: "Отключить", en: "Stop", ko: "중지", vi: "Dừng" };
export function stopLabel(lang: Lang): string {
  return STOP[lang];
}
