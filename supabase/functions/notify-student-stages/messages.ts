// The text of a stage notification, in the language the phone registered with
// (user_push_tokens.preferred_lang). Pure, so src/lib/__tests__ can test it.

export type StageKind =
  | "documents_ready"
  | "university_offered"
  | "university_confirmed"
  | "online_submitted"
  | "offline_sent"
  | "interview_scheduled"
  | "admission_accepted"
  | "admission_rejected"
  | "final_university"
  | "visa_process"
  | "visa_waiting"
  | "visa_received"
  | "offer_reminder"
  | "deadline_7"
  | "deadline_3"
  | "deadline_1";

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
  // 2026-11-07: har bir CRM bosqichida xabar (suhbat, rad javobi, viza).
  interview_scheduled: {
    uz: (n) => ({ title: "Suhbat belgilandi 🗓", body: `Suhbat sanasi belgilandi: ${list(n, "uz")}. Kun va vaqtni ilovada ko'ring.` }),
    ru: (n) => ({ title: "Назначено собеседование 🗓", body: `Назначено собеседование: ${list(n, "ru")}. Дата и время — в приложении.` }),
    en: (n) => ({ title: "Interview scheduled 🗓", body: `Your interview is scheduled: ${list(n, "en")}. See the date and time in the app.` }),
    ko: (n) => ({ title: "면접 일정 확정 🗓", body: `면접 일정이 정해졌습니다: ${list(n, "ko")}. 날짜와 시간은 앱에서 확인하세요.` }),
    vi: (n) => ({ title: "Đã có lịch phỏng vấn 🗓", body: `Lịch phỏng vấn đã được xếp: ${list(n, "vi")}. Xem ngày giờ trong ứng dụng.` }),
  },
  admission_rejected: {
    uz: (n) => ({ title: "Universitet javobi", body: `${list(n, "uz")} javob berdi: bu safar qabul qilinmadingiz. Konsultantingiz keyingi qadamni aytadi.` }),
    ru: (n) => ({ title: "Ответ университета", body: `${list(n, "ru")}: на этот раз вы не приняты. Консультант подскажет следующий шаг.` }),
    en: (n) => ({ title: "University decision", body: `${list(n, "en")}: not admitted this time. Your consultant will tell you the next step.` }),
    ko: (n) => ({ title: "대학 결과", body: `${list(n, "ko")}: 이번에는 불합격입니다. 상담사가 다음 단계를 안내해 드립니다.` }),
    vi: (n) => ({ title: "Kết quả từ trường", body: `${list(n, "vi")}: lần này bạn chưa trúng tuyển. Tư vấn viên sẽ hướng dẫn bước tiếp theo.` }),
  },
  visa_process: {
    uz: () => ({ title: "Viza jarayoni boshlandi", body: "Viza uchun hujjatlaringiz tayyorlanmoqda. Batafsil ilovada." }),
    ru: () => ({ title: "Начато оформление визы", body: "Готовим документы на визу. Подробности — в приложении." }),
    en: () => ({ title: "Visa process started", body: "We are preparing your visa documents. Details in the app." }),
    ko: () => ({ title: "비자 절차 시작", body: "비자 서류를 준비하고 있습니다. 자세한 내용은 앱에서 확인하세요." }),
    vi: () => ({ title: "Bắt đầu làm visa", body: "Chúng tôi đang chuẩn bị hồ sơ visa cho bạn. Chi tiết trong ứng dụng." }),
  },
  visa_waiting: {
    uz: () => ({ title: "Viza arizasi topshirildi", body: "Viza arizangiz topshirildi, natijasini kutyapmiz." }),
    ru: () => ({ title: "Заявление на визу подано", body: "Заявление на визу подано, ждём результат." }),
    en: () => ({ title: "Visa application submitted", body: "Your visa application has been submitted; we are waiting for the result." }),
    ko: () => ({ title: "비자 신청 완료", body: "비자 신청서가 제출되었습니다. 결과를 기다리고 있습니다." }),
    vi: () => ({ title: "Đã nộp hồ sơ visa", body: "Hồ sơ visa của bạn đã được nộp, đang chờ kết quả." }),
  },
  visa_received: {
    uz: () => ({ title: "Viza tayyor! ✈️", body: "Tabriklaymiz, vizangiz chiqdi. Parvoz va turar joy bo'yicha konsultantingiz bog'lanadi." }),
    ru: () => ({ title: "Виза готова! ✈️", body: "Поздравляем, виза получена. Консультант свяжется по поводу перелёта и жилья." }),
    en: () => ({ title: "Your visa is ready! ✈️", body: "Congratulations, your visa has been issued. Your consultant will contact you about the flight and housing." }),
    ko: () => ({ title: "비자 발급 완료! ✈️", body: "축하합니다, 비자가 발급되었습니다. 항공편과 숙소는 상담사가 안내해 드립니다." }),
    vi: () => ({ title: "Visa đã có! ✈️", body: "Chúc mừng, visa của bạn đã được cấp. Tư vấn viên sẽ liên hệ về chuyến bay và chỗ ở." }),
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
  // Onlayn ariza muddati (20261103150000_deadline_reminders.sql): 7, 3 va 1 kun
  // oldin, talaba tanlagan va onlayn arizasi hali topshirilmagan universitetlar.
  deadline_7: deadline(7),
  deadline_3: deadline(3),
  deadline_1: deadline(1),
};

function deadline(days: number): Record<Lang, Builder> {
  const last = days === 1;
  return {
    uz: (n) => ({
      title: last ? "Ertaga onlayn ariza muddati tugaydi ⏰" : `Onlayn arizaga ${days} kun qoldi ⏰`,
      body: `${list(n, "uz")}: onlayn ariza topshirish muddati ${last ? "ertaga" : `${days} kundan keyin`} tugaydi. Hujjatlaringiz tayyorligini tekshiring, savol bo'lsa konsultantingizga yozing.`,
    }),
    ru: (n) => ({
      title: last ? "Завтра заканчивается онлайн-подача ⏰" : `До конца онлайн-подачи ${days} ${days === 3 ? "дня" : "дней"} ⏰`,
      body: `${list(n, "ru")}: онлайн-подача документов заканчивается ${last ? "завтра" : `через ${days} ${days === 3 ? "дня" : "дней"}`}. Проверьте, готовы ли документы; вопросы — консультанту.`,
    }),
    en: (n) => ({
      title: last ? "Online application closes tomorrow ⏰" : `${days} days left to apply online ⏰`,
      body: `${list(n, "en")}: the online application closes ${last ? "tomorrow" : `in ${days} days`}. Check that your documents are ready and ask your consultant if anything is unclear.`,
    }),
    ko: (n) => ({
      title: last ? "온라인 지원 마감 하루 전 ⏰" : `온라인 지원 마감 ${days}일 전 ⏰`,
      body: `${list(n, "ko")}: 온라인 지원이 ${last ? "내일" : `${days}일 후`} 마감됩니다. 서류가 준비되었는지 확인하고 궁금한 점은 상담사에게 문의하세요.`,
    }),
    vi: (n) => ({
      title: last ? "Ngày mai hết hạn nộp hồ sơ trực tuyến ⏰" : `Còn ${days} ngày để nộp hồ sơ trực tuyến ⏰`,
      body: `${list(n, "vi")}: hạn nộp hồ sơ trực tuyến kết thúc ${last ? "vào ngày mai" : `sau ${days} ngày`}. Hãy kiểm tra hồ sơ của bạn và hỏi tư vấn viên nếu cần.`,
    }),
  };
}

/**
 * The kind the app is told: a reminder opens the same screen as the offer
 * did (the app routes by kind), and says it is the reminder as its campaign
 * — push_opened records it.
 */
export function pushData(kind: StageKind): Record<string, string> {
  if (kind === "offer_reminder") return { type: "stage", kind: "university_offered", campaign: "offer_reminder" };
  // The app opens its home screen for an unknown stage kind; the campaign
  // tells push_opened which reminder it was.
  if (kind.startsWith("deadline_")) return { type: "stage", kind: "deadline", campaign: kind };
  return { type: "stage", kind };
}

export function normalizeLang(raw: string | null | undefined): Lang {
  const l = (raw ?? "").toLowerCase().slice(0, 2);
  return (["uz", "ru", "en", "ko", "vi"] as const).includes(l as Lang) ? (l as Lang) : "uz";
}

/** `names` are the universities the notification is about (empty for documents_ready). */
export function stageMessage(kind: StageKind, names: string[], lang: string | null | undefined): StageMessage {
  return TEXT[kind][normalizeLang(lang)](names, normalizeLang(lang));
}
