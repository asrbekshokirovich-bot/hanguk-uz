// approve-crawl-findings — Commits approved crawl_findings to university_admission_periods.
//
// Modes:
// - POST { finding_id } — approve a single finding
// - POST { auto: true } — batch-approve all high-confidence pending items
// - POST { finding_id, action: "reject" } — reject a finding

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // --- Auth check ---
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Missing authorization header" }, 401);
  }

  // Allow service-role key directly, otherwise verify as user JWT
  if (token !== serviceKey) {
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Invalid or expired token" }, 401);
    }
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      finding_id?: string;
      action?: "approve" | "reject";
      auto?: boolean;
    };

    const now = new Date().toISOString();

    // --- Batch auto-approve mode ---
    // Auto-approve pending findings where reviewer_decision->confidence >= 0.9
    if (body.auto) {
      const { data: items } = await admin
        .from("review_queue")
        .select("id, entity_id, reviewer_decision")
        .eq("entity_type", "crawl_finding")
        .eq("status", "pending")
        .limit(50);

      if (!items || items.length === 0) {
        return json({ ok: true, approved: 0, message: "No auto-approvable items" });
      }

      let approved = 0;
      for (const item of items) {
        const dec = item.reviewer_decision as Record<string, unknown> | null;
        if (!dec?.suggested || !dec?.institution_id) continue;

        const confidence = Number(dec.confidence);
        if (!Number.isFinite(confidence) || confidence < 0.9) continue;

        const p = dec.suggested as Record<string, unknown>;
        await upsertPeriod(admin, dec.institution_id as string, p);

        await admin
          .from("review_queue")
          .update({ status: "approved", resolved_at: now, needs_attention: false })
          .eq("id", item.id);

        approved++;
      }

      return json({ ok: true, approved });
    }

    // --- Single finding mode ---
    if (!body.finding_id) {
      return json({ error: "finding_id or auto:true required" }, 400);
    }

    const action = body.action ?? "approve";

    const { data: queueItem } = await admin
      .from("review_queue")
      .select("id, entity_id, reviewer_decision, status")
      .eq("entity_type", "crawl_finding")
      .eq("entity_id", body.finding_id)
      .single();

    if (!queueItem) {
      return json({ error: "Finding not found in review queue" }, 404);
    }

    if (queueItem.status === "approved" || queueItem.status === "rejected") {
      return json({ error: `Already ${queueItem.status}` }, 409);
    }

    if (action === "reject") {
      await admin
        .from("review_queue")
        .update({ status: "rejected", resolved_at: now, needs_attention: false })
        .eq("id", queueItem.id);
      return json({ ok: true, action: "rejected", finding_id: body.finding_id });
    }

    // Approve: commit to university_admission_periods
    const dec = queueItem.reviewer_decision as Record<string, unknown> | null;
    if (!dec?.suggested || !dec?.institution_id) {
      return json({ error: "Missing decision data" }, 422);
    }

    const p = dec.suggested as Record<string, unknown>;
    await upsertPeriod(admin, dec.institution_id as string, p);

    await admin
      .from("review_queue")
      .update({ status: "approved", resolved_at: now, needs_attention: false })
      .eq("id", queueItem.id);

    return json({ ok: true, action: "approved", finding_id: body.finding_id });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

async function upsertPeriod(
  admin: ReturnType<typeof createClient>,
  institutionId: string,
  p: Record<string, unknown>,
) {
  const { error } = await admin.from("university_admission_periods").upsert(
    {
      institution_id: institutionId,
      semester: p.semester,
      year: p.year,
      program_level: p.program_level,
      language_track: p.language_track ?? null,
      application_start: p.application_start ?? null,
      application_end: p.application_end ?? null,
      document_deadline: p.document_deadline ?? null,
      result_announcement: p.result_announcement ?? null,
      application_fee_krw: p.application_fee_krw ?? null,
      application_fee_usd: p.application_fee_usd ?? null,
      application_form_url: p.application_form_url ?? null,
      needs_attention: false,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "institution_id,semester,year,program_level,language_track",
      ignoreDuplicates: false,
    },
  );
  if (error) {
    throw new Error(`Failed to upsert admission period for ${institutionId}: ${error.message}`);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
