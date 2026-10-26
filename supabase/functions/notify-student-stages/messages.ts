// The text of a stage notification, in the language the phone registered with
// (user_push_tokens.preferred_lang). Pure, so src/lib/__tests__ can test it.

export type StageKind =
  | "documents_ready"
  | "university_offered"
  | "university_confirmed"
  | "online_submitted"
  | "offline_sent"
  | "admission_accepted"
  | "final_university"
  | "offer_reminder";

export type Lang = "uz" | "ru" | "en" | "ko" | "vi";

export interface StageMessage {
  title: string;
  body: string;
}

const list = (names: string[], lang: Lang) => {
  if (names.length <= 1) return names[0] ?? "";
  const and = { uz: "va", ru: "и", en: "and", ko: "및", vi: "và" }[lang];
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
};

type Builder = (names: string[], lang: Lang) => StageMessage;

const TEXT: Record<StageKind, Record<Lang, Builder>> = {
  documents_ready: {
    uz: () => ({ title: "Hujjatlaringiz yig'ildi ✅", body: "Barcha hujjatlaringiz tekshirildi va tasdiqlandi. Endi universitetlarga ariza tayyorlaymiz." }),
    ru: () => ({ title: "Документы собраны ✅", body: "Все ваши документы проверены и подтверждены. Теперь готовим заявки в университеты." }),
    en: () => ({ title: "Your documents are complete ✅", body: "All your documents have been checked and approved. We are now preparing your university applications." }),
    ko: () => ({ title: "서류 준비 완료 ✅", body: "모든 서류가 확인 및 승인되었습니다. 이제 대학 지원서를 준비합니다." }),
    vi: () => ({ title: "Hồ sơ đã đầy đủ ✅", body: "Tất cả giấy tờ của bạn đã được kiểm tra và duyệt. Chúng tôi đang chuẩn bị hồ sơ nộp trường." }),
  },
  university_offered: {
    uz: (n) => ({
      title: "Universitet tanlovi",
      body: n.length > 1
        ? `Konsultantingiz siz uchun ${n.length} ta universitet tanladi: ${list(n, "uz")}. Ilovada ko'rib, javob bering.`
        : `Konsultantingiz siz uchun universitet tanladi: ${n[0]}. Ilovada ko'rib, javob bering.`,
    }),
    ru: (n) => ({
      title: "Выбор университета",
      body: `Консультант подобрал для вас: ${list(n, "ru")}. Посмотрите в приложении и ответьте.`,
    }),
    en: (n) => ({
      title: "University choice",
      body: `Your consultant picked ${list(n, "en")} for you. Take a look in the app and answer.`,
    }),
    ko: (n) => ({
      title: "대학 선택",
      body: `상담사가 대학을 추천했습니다: ${list(n, "ko")}. 앱에서 확인하고 답변해 주세요.`,
    }),
    vi: (n) => ({
      title: "Chọn trường",
      body: `Tư vấn viên đã chọn ${list(n, "vi")} cho bạn. Hãy xem trong ứng dụng và trả lời.`,
    }),
  },
  university_confirmed: {
    uz: (n) => ({ title: "Universitet biriktirildi", body: `${list(n, "uz")} — yakuniy tasdiqlandi. Endi ariza tayyorlanadi.` }),
    ru: (n) => ({ title: "Университет закреплён", body: `${list(n, "ru")} — окончательно подтверждено. Начинаем готовить заявку.` }),
    en: (n) => ({ title: "University confirmed", body: `${list(n, "en")} — confirmed. Your application is being prepared.` }),
    ko: (n) => ({ title: "대학 확정", body: `${list(n, "ko")} — 최종 확정되었습니다. 지원서를 준비합니다.` }),
    vi: (n) => ({ title: "Đã xác nhận trường", body: `${list(n, "vi")} — đã xác nhận. Hồ sơ của bạn đang được chuẩn bị.` }),
  },
  online_submitted: {
    uz: (n) => ({ title: "Onlayn ariza topshirildi", body: `Onlayn arizangiz topshirildi: ${list(n, "uz")}.` }),
    ru: (n) => ({ title: "Онлайн-заявка подана", body: `Ваша онлайн-заявка в ${list(n, "ru")} подана.` }),
    en: (n) => ({ title: "Online application submitted", body: `Your online application to ${list(n, "en")} has been submitted.` }),
    ko: (n) => ({ title: "온라인 지원 완료", body: `온라인 지원서가 제출되었습니다: ${list(n, "ko")}.` }),
    vi: (n) => ({ title: "Đã nộp hồ sơ trực tuyến", body: `Hồ sơ trực tuyến của bạn vào ${list(n, "vi")} đã được nộp.` }),
  },
  offline_sent: {
    uz: (n) => ({ title: "Oflayn ariza yuborildi 📮", body: `Hujjatlaringiz pochta orqali jo'natildi: ${list(n, "uz")}.` }),
    ru: (n) => ({ title: "Документы отправлены 📮", body: `Ваши документы отправлены почтой в ${list(n, "ru")}.` }),
    en: (n) => ({ title: "Paper documents posted 📮", body: `Your documents have been posted to ${list(n, "en")}.` }),
    ko: (n) => ({ title: "서류 발송 완료 📮", body: `서류를 우편으로 발송했습니다: ${list(n, "ko")}.` }),
    vi: (n) => ({ title: "Đã gửi hồ sơ giấy 📮", body: `Hồ sơ của bạn đã được gửi bưu điện tới ${list(n, "vi")}.` }),
  },
  admission_accepted: {
    uz: (n) => ({ title: "Tabriklaymiz! 🎓", body: `Siz qabul qilindingiz: ${list(n, "uz")}.` }),
    ru: (n) => ({ title: "Поздравляем! 🎓", body: `Вы приняты: ${list(n, "ru")}.` }),
    en: (n) => ({ title: "Congratulations! 🎓", body: `You have been admitted to ${list(n, "en")}.` }),
    ko: (n) => ({ title: "축하합니다! 🎓", body: `합격했습니다: ${list(n, "ko")}.` }),
    vi: (n) => ({ title: "Chúc mừng! 🎓", body: `Bạn đã trúng tuyển: ${list(n, "vi")}.` }),
  },
  final_university: {
    uz: (n) => ({ title: "Yakuniy universitet", body: `Konsultantingiz tavsiyasi: ${list(n, "uz")}. Ilovada tasdiqlang.` }),
    ru: (n) => ({ title: "Итоговый университет", body: `Рекомендация консультанта: ${list(n, "ru")}. Подтвердите в приложении.` }),
    en: (n) => ({ title: "Your final university", body: `Your consultant recommends ${list(n, "en")}. Confirm it in the app.` }),
    ko: (n) => ({ title: "최종 대학", body: `상담사 추천: ${list(n, "ko")}. 앱에서 확인해 주세요.` }),
    vi: (n) => ({ title: "Trường cuối cùng", body: `Tư vấn viên đề xuất ${list(n, "vi")}. Hãy xác nhận trong ứng dụng.` }),
  },
  // 4-signal (the app analytics plan): an offer the student has not answered
  // for 48 hours. Once per offer.
  offer_reminder: {
    uz: (n) => ({
      title: "Javobingizni kutyapmiz",
      body: `Konsultantingiz tanlagan universitet${n.length > 1 ? "lar" : ""}: ${list(n, "uz")}. Ilovada ko'rib, javob bering.`,
    }),
    ru: (n) => ({ title: "Ждём вашего ответа", body: `Консультант подобрал для вас: ${list(n, "ru")}. Посмотрите в приложении и ответьте.` }),
    en: (n) => ({ title: "Waiting for your answer", body: `Your consultant picked ${list(n, "en")} for you. Take a look in the app and answer.` }),
    ko: (n) => ({ title: "답변을 기다리고 있습니다", body: `상담사가 추천한 대학: ${list(n, "ko")}. 앱에서 확인하고 답변해 주세요.` }),
    vi: (n) => ({ title: "Chúng tôi đang chờ bạn trả lời", body: `Tư vấn viên đã chọn ${list(n, "vi")} cho bạn. Hãy xem trong ứng dụng và trả lời.` }),
  },
};

/**
 * The kind the app is told: a reminder opens the same screen as the offer
 * did (the app routes by kind), and says it is the reminder as its campaign
 * — push_opened records it.
 */
export function pushData(kind: StageKind): Record<string, string> {
  return kind === "offer_reminder"
    ? { type: "stage", kind: "university_offered", campaign: "offer_reminder" }
    : { type: "stage", kind };
}

export function normalizeLang(raw: string | null | undefined): Lang {
  const l = (raw ?? "").toLowerCase().slice(0, 2);
  return (["uz", "ru", "en", "ko", "vi"] as const).includes(l as Lang) ? (l as Lang) : "uz";
}

/** `names` are the universities the notification is about (empty for documents_ready). */
export function stageMessage(kind: StageKind, names: string[], lang: string | null | undefined): StageMessage {
  return TEXT[kind][normalizeLang(lang)](names, normalizeLang(lang));
}
