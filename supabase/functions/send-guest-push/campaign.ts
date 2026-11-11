// A guest campaign's input and its text per phone. Pure, so campaign_test.ts
// runs it as is.

export const LANGS = ["uz", "ru", "en", "ko", "vi", "ky"] as const;
export type Lang = (typeof LANGS)[number];
export type Texts = Partial<Record<Lang, string>>;

export interface CampaignInput {
  campaign: string;
  title: Texts;
  body: Texts;
}

const TITLE_MAX = 80;
const BODY_MAX = 240;

/** The input cleaned, or the reason it cannot be sent. */
export function checkCampaign(raw: unknown): { ok: true; value: CampaignInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const campaign = typeof r.campaign === "string" ? r.campaign.trim().toLowerCase() : "";
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(campaign)) return { ok: false, error: "bad_campaign" };
  const clean = (v: unknown, max: number): Texts | null => {
    const out: Texts = {};
    const src = (v ?? {}) as Record<string, unknown>;
    for (const l of LANGS) {
      const s = typeof src[l] === "string" ? (src[l] as string).trim() : "";
      if (s.length > max) return null;
      if (s) out[l] = s;
    }
    return out;
  };
  const title = clean(r.title, TITLE_MAX);
  const body = clean(r.body, BODY_MAX);
  if (!title || !body) return { ok: false, error: "too_long" };
  if (!title.uz || !body.uz) return { ok: false, error: "uzbek_required" };
  return { ok: true, value: { campaign, title, body } };
}

/** The text for a phone in [lang]: its own language where written, else Uzbek.
 *  A Kyrgyz phone with no Kyrgyz text gets the Russian one first (KG6):
 *  in Kyrgyzstan Russian is read more widely than Uzbek. */
export function textFor(c: CampaignInput, lang: string | null | undefined): { title: string; body: string } {
  const l = (LANGS as readonly string[]).includes((lang ?? "").slice(0, 2)) ? ((lang ?? "").slice(0, 2) as Lang) : "uz";
  if (l === "ky" && !c.title.ky && c.title.ru && c.body.ru) return { title: c.title.ru, body: c.body.ru };
  return { title: c.title[l] ?? c.title.uz!, body: c.body[l] ?? c.body.uz! };
}

/** What the app is told: a campaign push opens the app, and push_opened records the key. */
export function campaignData(campaign: string): Record<string, string> {
  return { type: "campaign", campaign };
}
