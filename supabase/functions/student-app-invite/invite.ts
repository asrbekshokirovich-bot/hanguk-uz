// The invite's text and the choice of channel, without the network
// (invite_test.ts). Ushlab qolish rejasi P13.

export type Lang = "uz" | "ru" | "en" | "ko" | "vi" | "ky";

export interface Target {
  student_id: string;
  full_name: string | null;
  magic_code: string;
  lang: string | null;
  contract_date: string | null;
  telegram_id: string | null;
  account_label: string | null;
  link_code: string | null;
  consultant: string | null;
  last_invite_at: string | null;
}

export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.hanguk.studentapp.hanguk_app";
export const REINVITE_DAYS = 7;
export const AUTO_CONTRACT_DAYS = 14;

export function normalizeLang(raw: string | null | undefined): Lang {
  const l = (raw ?? "").toLowerCase().slice(0, 2);
  return (["uz", "ru", "en", "ko", "vi", "ky"] as const).includes(l as Lang) ? (l as Lang) : "uz";
}

/** The link: hanguk.uz/l/<code> ties the phone to the lead (src/lib/appLink.ts); else Google Play. */
export function appLink(linkCode: string | null): string {
  const c = (linkCode ?? "").trim().toLowerCase();
  return /^[a-z0-9]{6,32}$/.test(c) ? `https://hanguk.uz/l/${c}` : PLAY_URL;
}

export type Decision = { channel: "telegram" | "task" } | { skip: "recent" | "old_contract" };

/** auto: only new contracts, never invited. By hand: anyone not invited this week. */
export function decide(t: Target, now: Date, auto: boolean): Decision {
  if (t.last_invite_at) {
    if (auto) return { skip: "recent" };
    if (now.getTime() - Date.parse(t.last_invite_at) < REINVITE_DAYS * 86_400_000) return { skip: "recent" };
  }
  if (auto) {
    const c = t.contract_date ? Date.parse(t.contract_date) : NaN;
    if (!Number.isFinite(c) || now.getTime() - c > AUTO_CONTRACT_DAYS * 86_400_000) return { skip: "old_contract" };
  }
  return { channel: t.telegram_id && t.account_label ? "telegram" : "task" };
}

function first(name: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** The Telegram message. */
export function telegramText(t: Target, iosUrl: string | null): string {
  const lang = normalizeLang(t.lang);
  const n = first(t.full_name);
  const link = appLink(t.link_code);
  const ios = iosUrl && link === PLAY_URL ? iosUrl : null;
  const code = t.magic_code;
  switch (lang) {
    case "ru":
      return [
        `Здравствуйте${n ? `, ${n}` : ""}! В приложении Hanguk видны ваша заявка, документы и сроки университетов.`,
        `Установите: ${link}${ios ? `\niPhone: ${ios}` : ""}`,
        `Код для входа: ${code}`,
      ].join("\n\n");
    case "en":
      return [
        `Hello${n ? `, ${n}` : ""}! The Hanguk app shows your application, documents and university deadlines.`,
        `Install it: ${link}${ios ? `\niPhone: ${ios}` : ""}`,
        `Your login code: ${code}`,
      ].join("\n\n");
    case "ko":
      return [
        `안녕하세요${n ? ` ${n}님` : ""}! Hanguk 앱에서 지원 현황, 서류, 대학 마감일을 확인할 수 있습니다.`,
        `설치: ${link}${ios ? `\niPhone: ${ios}` : ""}`,
        `로그인 코드: ${code}`,
      ].join("\n\n");
    case "vi":
      return [
        `Xin chào${n ? ` ${n}` : ""}! Ứng dụng Hanguk cho bạn xem hồ sơ, giấy tờ và hạn của các trường.`,
        `Cài đặt: ${link}${ios ? `\niPhone: ${ios}` : ""}`,
        `Mã đăng nhập: ${code}`,
      ].join("\n\n");
    case "ky":
      return [
        `Саламатсызбы${n ? `, ${n}` : ""}! Hanguk тиркемесинде арызыңызды, документтериңизди жана университеттердин мөөнөттөрүн көрөсүз.`,
        `Орнотуңуз: ${link}${ios ? `\niPhone: ${ios}` : ""}`,
        `Кирүү коду: ${code}`,
      ].join("\n\n");
    default:
      return [
        `Assalomu alaykum${n ? `, ${n}` : ""}! Hanguk ilovasida arizangiz, hujjatlaringiz va universitet muddatlarini kuzatib borasiz.`,
        `O'rnating: ${link}${ios ? `\niPhone: ${ios}` : ""}`,
        `Kirish kodi: ${code}`,
      ].join("\n\n");
  }
}

/** The CRM task for a student with no Telegram (Uzbek: the staff's language). */
export function taskFor(t: Target, iosUrl: string | null): { title: string; description: string } {
  const name = (t.full_name ?? "").trim() || "Talaba";
  const link = appLink(t.link_code);
  return {
    title: `Ilovaga taklif: ${name}`,
    description: [
      `${name} ilovani hali ochmagan. Qo'ng'iroq qilib, ilovani o'rnatishga yordam bering.`,
      `Havola: ${link}${iosUrl && link === PLAY_URL ? `\niPhone: ${iosUrl}` : ""}`,
      `Kirish kodi: ${t.magic_code}`,
    ].join("\n"),
  };
}
