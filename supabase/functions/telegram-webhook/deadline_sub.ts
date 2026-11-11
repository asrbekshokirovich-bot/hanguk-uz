// Ushlab qolish rejasi P16: the bot's side of the app's «Telegram'da olish»
// (t.me/<bot>?start=D_<code>). Pure, so deadline_sub_test.ts can test it.

export type Lang = "uz" | "ru" | "en" | "ko" | "vi" | "ky";

/** The code from `/start D_<code>`; Telegram allows 64 characters after start=. */
export function subCode(text: string): string | null {
  const m = text.trim().match(/^\/start\s+D_([A-HJ-NP-Z2-9]{10})$/i);
  return m ? m[1].toUpperCase() : null;
}

export function lang(raw: unknown): Lang {
  const l = String(raw ?? "").toLowerCase().slice(0, 2);
  return (["uz", "ru", "en", "ko", "vi", "ky"] as const).includes(l as Lang) ? (l as Lang) : "uz";
}

const LINKED: Record<Lang, string> = {
  uz: "Tayyor ✅ Saqlagan universitetlaringizda onlayn ariza muddati yaqinlashganda shu yerga yozamiz.",
  ru: "Готово ✅ Напишем сюда, когда в сохранённых вами университетах будет заканчиваться онлайн-подача.",
  en: "Done ✅ We'll write here when the online application is about to close at the universities you saved.",
  ko: "완료 ✅ 저장한 대학의 온라인 지원 마감이 다가오면 여기로 알려 드립니다.",
  vi: "Xong ✅ Chúng tôi sẽ nhắn ở đây khi hạn nộp hồ sơ trực tuyến ở các trường bạn đã lưu sắp kết thúc.",
  ky: "Даяр ✅ Сактаган университеттериңизде онлайн арыз берүү мөөнөтү жакындаганда ушул жерге жазабыз.",
};
const STOPPED: Record<Lang, string> = {
  uz: "Eslatmalar to'xtatildi. Qayta yoqish uchun ilovadagi «Telegram'da olish» tugmasini bosing.",
  ru: "Напоминания отключены. Чтобы включить снова, нажмите в приложении «Получать в Telegram».",
  en: "Reminders are off. To turn them back on, tap «Get in Telegram» in the app.",
  ko: "알림을 껐습니다. 다시 켜려면 앱에서 «Telegram으로 받기»를 누르세요.",
  vi: "Đã tắt nhắc nhở. Để bật lại, hãy nhấn «Nhận qua Telegram» trong ứng dụng.",
  ky: "Эскертмелер өчүрүлдү. Кайра күйгүзүү үчүн тиркемедеги «Telegram'да алуу» баскычын басыңыз.",
};
const UNKNOWN: Record<Lang, string> = {
  uz: "Havola eskirgan. Ilovada «Telegram'da olish» tugmasini qayta bosing.",
  ru: "Ссылка устарела. Нажмите «Получать в Telegram» в приложении ещё раз.",
  en: "This link has expired. Tap «Get in Telegram» in the app again.",
  ko: "링크가 만료되었습니다. 앱에서 «Telegram으로 받기»를 다시 누르세요.",
  vi: "Liên kết đã hết hạn. Hãy nhấn lại «Nhận qua Telegram» trong ứng dụng.",
  ky: "Шилтеменин мөөнөтү бүттү. Тиркемеде «Telegram'да алуу» баскычын кайра басыңыз.",
};
const STOP: Record<Lang, string> = { uz: "To'xtatish", ru: "Отключить", en: "Stop", ko: "중지", vi: "Dừng", ky: "Токтотуу" };

export const linkedText = (l: Lang) => LINKED[l];
export const stoppedText = (l: Lang) => STOPPED[l];
export const unknownText = (l: Lang) => UNKNOWN[l];
export const stopButton = (l: Lang) => ({ inline_keyboard: [[{ text: STOP[l], callback_data: "sub_stop" }]] });
