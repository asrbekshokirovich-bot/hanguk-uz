// guideline_text_search — the guideline PDFs' own text (plan §5.2), for what
// the structured tables do not hold: interview format, dormitory, how scores
// are weighed, special conditions. Hybrid: Korean keywords (PGroonga) +
// meaning (gemini-embedding-001 @1024, multilingual, so an Uzbek question finds
// a Korean page). Without an embedding the keyword half still works.
//
// deno-lint-ignore-file no-explicit-any
import { embedContent001 } from "../../_shared/gemini.ts";
import type { AgentTool, Source } from "./types.ts";

export const GUIDELINE_TEXT_TOOL: AgentTool = {
  name: "guideline_text_search",
  description:
    "Search the full text of the universities' guideline PDFs (mostly Korean) and get the matching passages with their page. Use it when uni_card / uni_faculties / uni_documents / uni_grants do not answer the question (interview, dormitory, evaluation, special conditions, exceptions), or to confirm a detail. Give query in the user's words AND query_ko with the Korean terms (e.g. 면접, 기숙사, 서류전형, 장학금). Limit to one university with institution_id when the question is about one.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      query_ko: { type: "string", description: "Korean keywords for the same question" },
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
      embedding = await embedContent001(`${query} ${a?.query_ko ?? ""}`.trim(), "RETRIEVAL_QUERY", 1024);
    } catch (e) {
      console.error("[hanguk-ai] guideline embedding failed:", e instanceof Error ? e.message : e);
    }
    const { data, error } = await ctx.user.rpc("guideline_text_search", {
      p_query: query,
      p_query_ko: a?.query_ko ?? null,
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
