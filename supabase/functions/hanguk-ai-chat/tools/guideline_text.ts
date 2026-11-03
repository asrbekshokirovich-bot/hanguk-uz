// guideline_text_search — the guideline PDFs' own text (plan §5.2), for what
// the structured tables do not hold: interview format, dormitory, how scores
// are weighed, special conditions. Hybrid: Korean keywords (PGroonga) +
// meaning (gemini-embedding-001 @1024, multilingual, so an Uzbek question finds
// a Korean page). Without an embedding the keyword half still works.
//
// Keyword half: PGroonga's &@~ treats "a b" as a AND b, so one extra Korean
// word the page does not contain ("기숙사 수용인원") used to return nothing, and
// query_ko replaced query, so an English-language guideline never matched.
// guidelineKeywordQuery() turns both into one OR query of single keywords
// (+ the halves of 4-syllable Korean compounds: 원서접수 → 원서, 접수, because
// the PDF may write them with a space). The SQL ranks by how many keywords a
// page holds (migration 20261103180000).
//
// deno-lint-ignore-file no-explicit-any
import { embedContent001 } from "../../_shared/gemini.ts";
import { voyageEmbed, voyageKey } from "../../_shared/voyage.ts";
import type { AgentTool, Source } from "./types.ts";

/** Words that only add noise to a keyword OR query (kept in sync with the SQL function). */
export const GUIDELINE_STOPWORDS = new Set([
  "or", "and", "the", "of", "in", "on", "at", "to", "for", "is", "are", "an", "what", "which", "how", "many",
  "much", "where", "when", "who", "does", "do", "with", "from", "by", "about", "pdf", "guideline", "university",
  "universitet", "universiteti", "va", "yoki", "qaysi", "nechta", "qanday", "qachon", "qayerda", "uchun",
  "bilan", "haqida", "ham", "bor", "ayt", "riqnoma", "сколько", "какой", "какие", "где", "как", "что", "для", "при",
]);

/** Single keywords from query_ko (first) and query: lower-cased, de-duplicated, at most 24. */
export function guidelineKeywords(query: string, queryKo?: string | null): string[] {
  const out: string[] = [];
  const add = (t: string) => {
    if (t.length >= 2 && !GUIDELINE_STOPWORDS.has(t) && !out.includes(t)) out.push(t);
  };
  for (const raw of `${queryKo ?? ""} ${query}`.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    add(raw);
    if (/^[\uAC00-\uD7A3]{4}$/.test(raw)) { add(raw.slice(0, 2)); add(raw.slice(2)); }
  }
  return out.slice(0, 24);
}

/** PGroonga query: any keyword may match ("a" OR "b"); null when nothing is left. */
export function guidelineKeywordQuery(query: string, queryKo?: string | null): string | null {
  const terms = guidelineKeywords(query, queryKo);
  return terms.length ? terms.map((t) => `"${t}"`).join(" OR ") : null;
}

export const GUIDELINE_TEXT_TOOL: AgentTool = {
  name: "guideline_text_search",
  description:
    "Search the full text of the universities' guideline PDFs and get the matching passages with their page. Most PDFs are Korean, some (for foreigners) are English. Use it when uni_card / uni_faculties / uni_documents / uni_grants do not answer the question (application website / portal, dormitory, interview, evaluation, contacts, address, special conditions, exceptions), when the user asks for the PDF, or to confirm a detail. Pages match ANY of the keywords and are ranked by how many they contain, so give several short keywords, not a sentence: query = English keywords (e.g. dormitory, online application, website), query_ko = Korean keywords (e.g. 기숙사, 원서접수, 면접, 서류전형, 장학금). Limit to one university with institution_id (from uni_search) when the question is about one.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "English keywords for the question (some guideline PDFs are in English)" },
      query_ko: { type: "string", description: "Korean keywords for the same question, separated by spaces" },
      institution_id: { type: "string" },
      limit: { type: "integer" },
    },
    required: ["query"],
  },
  audiences: ["staff", "student", "guest"],
  run: async (ctx, a) => {
    const query = String(a?.query ?? "").slice(0, 500);
    let embedding: number[] | null = null;
    try {
      const q = `${query} ${a?.query_ko ?? ""}`.trim();
      // Same provider as the index (guideline-index): Voyage when its key is set.
      embedding = voyageKey() ? (await voyageEmbed([q], "query"))[0] : await embedContent001(q, "RETRIEVAL_QUERY", 1024);
    } catch (e) {
      console.error("[hanguk-ai] guideline embedding failed:", e instanceof Error ? e.message : e);
    }
    const { data, error } = await ctx.user.rpc("guideline_text_search", {
      p_query: query,
      p_query_ko: guidelineKeywordQuery(query, a?.query_ko ? String(a.query_ko).slice(0, 500) : null),
      p_embedding: embedding ? JSON.stringify(embedding) : null,
      p_institution_id: a?.institution_id ?? null,
      p_limit: a?.limit ?? 8,
    });
    if (error) return { data: { error: error.message } };
    const sources: Source[] = (data?.results ?? []).slice(0, 4).map((r: any) => ({
      kind: "pdf",
      label: `Yo'riqnoma PDF: ${r.university ?? ""}${r.academic_year ? ` ${r.academic_year}` : ""}`.trim(),
      page: r.page ? `${r.page}-bet` : null,
      url: r.official_url ?? null,
    }));
    return { data, sources };
  },
};
