// Ushlab qolish rejasi P18 (QU4): a guest (guest-test-session account, one
// per phone) may start one text interview a week. Counted in ai_quota with
// ai_take_quota, like the guest AI questions in hanguk-ai-chat.

/** ISO week in Tashkent, e.g. 2026-W47. */
export function isoWeek(now: Date): string {
  const t = new Date(now.getTime() + 5 * 3_600_000); // Asia/Tashkent, UTC+5
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function guestInterviewLimit(): number {
  const v = Number(Deno.env.get("AI_LIMIT_GUEST_INTERVIEW_WEEK"));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export function guestInterviewKey(userId: string, now = new Date()): string {
  return `interview:${userId}:${isoWeek(now)}`;
}

/** Only a new interview counts: the guest's first message in the session. */
export function countsAgainstQuota(isGuest: boolean, earlierStudentMessages: number): boolean {
  return isGuest && earlierStudentMessages === 0;
}

export function weeklyLimitMessage(lang: string | null | undefined): string {
  switch ((lang ?? "").slice(0, 2)) {
    case "ru": return "Гостю доступно одно интервью в неделю. Войдите по коду клиента, чтобы заниматься без ограничений.";
    case "en": return "Guests can take one interview a week. Sign in with your client code to practise without limits.";
    case "ko": return "게스트는 일주일에 한 번 면접 연습을 할 수 있습니다. 고객 코드로 로그인하면 제한 없이 연습할 수 있습니다.";
    case "vi": return "Khách được luyện phỏng vấn một lần mỗi tuần. Đăng nhập bằng mã khách hàng để luyện không giới hạn.";
    case "ky": return "Конок жумасына бир маек машыгуусун өткөрө алат. Чектөөсүз машыгуу үчүн кардар кодуңуз менен кириңиз.";
    default: return "Mehmon haftasiga bitta suhbat mashqini o'tkaza oladi. Cheklovsiz mashq uchun mijoz kodingiz bilan kiring.";
  }
}
