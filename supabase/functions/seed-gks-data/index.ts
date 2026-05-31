import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
    );

    const results: string[] = [];

    // ============================================================
    // 1. GKS UNDERGRADUATE 2026
    // ============================================================

    const ugPrograms = [
      {
        program_level: "undergraduate",
        track_type: "embassy",
        sub_track: "general",
        year: 2026,
        total_slots: 82,
        announcement_date: "2025-09-01",
        application_start: "2025-09-15",
        application_end: "2025-10-31",
        review_period_start: "2025-11-01",
        review_period_end: "2025-12-20",
        result_date: "2026-01-09",
        benefits: {
          airfare: true,
          korean_language_training: "1 year",
          tuition: "Full coverage",
          monthly_allowance: "All-inclusive (living, health insurance, TOPIK fee, settlement, completion grants)",
          scholarship_period_bachelor: "5-7 years (1yr language + 4-6yr degree)",
          scholarship_period_associate: "3-4 years (1yr language + 2-3yr degree)",
        },
        eligibility: {
          age: "Under 25 (born after March 1, 2001)",
          gpa: "80% or above on 100-point scale, or top 20%, or ≥2.64/4.0",
          nationality: "Must hold citizenship of NIIED designated country",
          restrictions: "Cannot have Korean high school diploma or previous GKS degree scholarship",
          topik_bonus: "TOPIK 3+ gives 10% additional points",
        },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "undergraduate",
        track_type: "embassy",
        sub_track: "overseas_korean",
        year: 2026,
        total_slots: 7,
        announcement_date: "2025-09-01",
        application_start: "2025-09-15",
        application_end: "2025-10-31",
        review_period_start: "2025-11-01",
        review_period_end: "2025-12-20",
        result_date: "2026-01-09",
        benefits: { same_as: "embassy_general" },
        eligibility: { same_as: "embassy_general", additional: "Must be ethnic Korean without Korean citizenship" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "undergraduate",
        track_type: "embassy",
        sub_track: "r_gks",
        year: 2026,
        total_slots: 61,
        announcement_date: "2025-09-01",
        application_start: "2025-09-15",
        application_end: "2025-10-31",
        review_period_start: "2025-11-01",
        review_period_end: "2025-12-20",
        result_date: "2026-01-09",
        benefits: { same_as: "embassy_general" },
        eligibility: { same_as: "embassy_general", note: "Can choose up to 2 Type B universities" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "undergraduate",
        track_type: "university",
        sub_track: "uic",
        year: 2026,
        total_slots: 100,
        announcement_date: "2025-09-01",
        application_start: "2025-09-15",
        application_end: "2025-10-31",
        review_period_start: "2025-11-01",
        review_period_end: "2025-12-15",
        result_date: "2026-01-09",
        benefits: { same_as: "embassy_general", note: "UIC provides customized curriculum with industry-university cooperation in natural science/engineering" },
        eligibility: { same_as: "embassy_general", note: "Open to all countries" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "undergraduate",
        track_type: "university",
        sub_track: "associate",
        year: 2026,
        total_slots: 30,
        announcement_date: "2025-09-01",
        application_start: "2025-09-15",
        application_end: "2025-10-31",
        review_period_start: "2025-11-01",
        review_period_end: "2025-12-15",
        result_date: "2026-01-09",
        benefits: { same_as: "embassy_general", scholarship_period: "3-4 years" },
        eligibility: { same_as: "embassy_general" },
        contact_email: "gksniied@korea.kr",
      },
    ];

    // ============================================================
    // 2. GKS GRADUATE 2026
    // ============================================================

    const gradPrograms = [
      {
        program_level: "graduate",
        track_type: "embassy",
        sub_track: "general",
        year: 2026,
        total_slots: 776,
        announcement_date: "2026-02-01",
        application_start: "2026-02-15",
        application_end: "2026-03-31",
        review_period_start: "2026-04-01",
        review_period_end: "2026-06-15",
        result_date: "2026-06-30",
        benefits: {
          airfare: true,
          korean_language_training: "1 year",
          tuition: "Full coverage",
          monthly_allowance: "All-inclusive",
          scholarship_period_masters: "3 years (1yr language + 2yr degree)",
          scholarship_period_phd: "4 years (1yr language + 3yr degree)",
        },
        eligibility: {
          age: "Under 40 at time of application",
          gpa: "Must meet GKS GPA requirements",
          nationality: "143 countries",
        },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "graduate",
        track_type: "embassy",
        sub_track: "overseas_korean",
        year: 2026,
        total_slots: 24,
        announcement_date: "2026-02-01",
        application_start: "2026-02-15",
        application_end: "2026-03-31",
        review_period_start: "2026-04-01",
        review_period_end: "2026-06-15",
        result_date: "2026-06-30",
        benefits: { same_as: "graduate_embassy_general" },
        eligibility: { same_as: "graduate_embassy_general", additional: "Ethnic Korean without Korean citizenship, from 8 countries" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "graduate",
        track_type: "university",
        sub_track: "general",
        year: 2026,
        total_slots: 160,
        announcement_date: "2026-02-01",
        application_start: "2026-02-15",
        application_end: "2026-03-31",
        review_period_start: "2026-04-01",
        review_period_end: "2026-06-15",
        result_date: "2026-06-30",
        benefits: { same_as: "graduate_embassy_general" },
        eligibility: { same_as: "graduate_embassy_general", note: "Type A or Type B universities" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "graduate",
        track_type: "university",
        sub_track: "r_gks",
        year: 2026,
        total_slots: 480,
        announcement_date: "2026-02-01",
        application_start: "2026-02-15",
        application_end: "2026-03-31",
        review_period_start: "2026-04-01",
        review_period_end: "2026-06-15",
        result_date: "2026-06-30",
        benefits: { same_as: "graduate_embassy_general" },
        eligibility: { same_as: "graduate_embassy_general", note: "Type B universities only" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "graduate",
        track_type: "university",
        sub_track: "research",
        year: 2026,
        total_slots: 5,
        announcement_date: "2026-02-01",
        application_start: "2026-02-15",
        application_end: "2026-03-31",
        review_period_start: "2026-04-01",
        review_period_end: "2026-06-15",
        result_date: "2026-06-30",
        benefits: { same_as: "graduate_embassy_general", note: "6 months or 1 year research" },
        eligibility: { same_as: "graduate_embassy_general" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "graduate",
        track_type: "university",
        sub_track: "international_org",
        year: 2026,
        total_slots: 72,
        announcement_date: "2026-02-01",
        application_start: "2026-02-15",
        application_end: "2026-03-31",
        review_period_start: "2026-04-01",
        review_period_end: "2026-06-15",
        result_date: "2026-06-30",
        benefits: { same_as: "graduate_embassy_general" },
        eligibility: { same_as: "graduate_embassy_general", note: "Can apply to General or Specialization programs" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "graduate",
        track_type: "university",
        sub_track: "rd",
        year: 2026,
        total_slots: 403,
        announcement_date: "2026-02-01",
        application_start: "2026-02-15",
        application_end: "2026-03-31",
        review_period_start: "2026-04-01",
        review_period_end: "2026-06-15",
        result_date: "2026-06-30",
        benefits: { same_as: "graduate_embassy_general" },
        eligibility: { same_as: "graduate_embassy_general", note: "60 departments in 25 institutions" },
        contact_email: "gksniied@korea.kr",
      },
      {
        program_level: "graduate",
        track_type: "university",
        sub_track: "global_network",
        year: 2026,
        total_slots: 80,
        announcement_date: "2026-02-01",
        application_start: "2026-02-15",
        application_end: "2026-03-31",
        review_period_start: "2026-04-01",
        review_period_end: "2026-06-15",
        result_date: "2026-06-30",
        benefits: { same_as: "graduate_embassy_general" },
        eligibility: { same_as: "graduate_embassy_general", note: "7 departments in 6 institutions" },
        contact_email: "gksniied@korea.kr",
      },
    ];

    // Insert all program info
    const allPrograms = [...ugPrograms, ...gradPrograms];
    
    for (const prog of allPrograms) {
      const { error } = await supabase
        .from("gks_program_info")
        .upsert(prog, { onConflict: "program_level,track_type,sub_track,year" });
      if (error) {
        results.push(`ERROR inserting ${prog.program_level}/${prog.track_type}/${prog.sub_track}: ${error.message}`);
      } else {
        results.push(`OK: ${prog.program_level}/${prog.track_type}/${prog.sub_track} (${prog.total_slots} slots)`);
      }
    }

    // ============================================================
    // 3. DESIGNATED UNIVERSITIES - match by English name
    // ============================================================

    // Graduate Type A (35 institutions)
    const gradTypeA = [
      "Ajou University", "Chung-Ang University", "Dankook University",
      "Dongguk University", "Duksung Women's University", "Ewha Womans University",
      "Hankuk University of Foreign Studies", "Hanyang University",
      "Hongik University", "Incheon National University", "Inha University",
      "Konkuk University", "Kookmin University", "Korea University",
      "Kyung Hee University", "Sejong University", "Seokyeong University",
      "Seoul National University", "Sogang University", "Sookmyung Women's University",
      "Soongsil University", "Sungkyunkwan University", "Sungshin Women's University",
      "University of Seoul", "Yonsei University",
    ];

    // Graduate Type A - specialized institutions (also Type A)
    const gradTypeASpecial = [
      "DGIST", "GIST", "KAIST", "KDI School",
      "POSTECH", "SeoulTech", "UNIST",
      "National Cancer Center", "The Academy of Korean Studies",
    ];

    // Graduate Type B (41 institutions)
    const gradTypeB = [
      "Baeseok University", "Busan University of Foreign Studies", "Changwon National University",
      "Cheongju University", "Chonnam National University", "Chosun University",
      "Chungbuk National University", "Chungnam National University", "Daegu University",
      "Daejeon University", "Dong-A University", "Dongseo University",
      "Gyeongsang National University", "Hannam University",
      "Hoseo University", "Inje University", "Jeju National University",
      "Jeonbuk National University", "Kangwon National University", "Keimyung University",
      "Kongju National University", "Konyang University",
      "Kunsan National University", "Kyungpook National University", "Kyungsung University",
      "Kyungwoon University", "Mokwon University", "Pai Chai University",
      "Pukyong National University", "Pusan National University", "Semyung University",
      "Silla University", "Soonchunhyang University", "Sun Moon University",
      "Sunchon National University", "Tongmyong University", "University of Ulsan",
      "Wonkwang University", "Yeungnam University",
    ];

    // R&D designated universities (25 institutions)
    const rdUniversities = [
      "Ajou University", "Cheongju University", "Chonnam National University",
      "Dong-A University", "Ewha Womans University", "Gyeongsang National University",
      "Hannam University", "Incheon National University", "Inje University",
      "Jeju National University", "KAIST", "Keimyung University",
      "Konkuk University", "Kookmin University",
      "Kunsan National University", "Kyungpook National University",
      "Pukyong National University", "Pusan National University",
      "Seoul Theological University", "SeoulTech", "Sogang University",
      "Sunchon National University", "Yeungnam University", "Yonsei University",
    ];

    // Global Network (6 institutions)
    const globalNetworkUniversities = [
      "Ajou University", "Hongik University", "KDI School",
      "Pusan National University", "Seoul National University",
    ];

    // Fetch all program info IDs we just inserted
    const { data: programInfos } = await supabase
      .from("gks_program_info")
      .select("id, program_level, track_type, sub_track, year")
      .eq("year", 2026);

    if (!programInfos || programInfos.length === 0) {
      return new Response(JSON.stringify({ error: "No program info found", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Fetch all universities to match by name
    const { data: universities } = await supabase
      .from("universities")
      .select("id, name_en, name_ko");

    if (!universities) {
      return new Response(JSON.stringify({ error: "No universities found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Helper to find university by English name (fuzzy)
    const findUniversity = (name: string) => {
      const lower = name.toLowerCase();
      return universities.find((u) => {
        const en = (u.name_en || "").toLowerCase();
        // Exact match
        if (en === lower) return true;
        // Contains match
        if (en.includes(lower) || lower.includes(en)) return true;
        // Handle abbreviations
        if (lower === "kaist" && en.includes("korea advanced institute")) return true;
        if (lower === "postech" && en.includes("pohang")) return true;
        if (lower === "gist" && en.includes("gwangju institute")) return true;
        if (lower === "dgist" && en.includes("daegu gyeongbuk institute")) return true;
        if (lower === "unist" && en.includes("ulsan national institute")) return true;
        if (lower === "seoultech" && en.includes("seoul national university of science")) return true;
        if (lower === "kdi school" && en.includes("kdi")) return true;
        if (lower === "national cancer center" && en.includes("cancer")) return true;
        if (lower === "the academy of korean studies" && en.includes("korean studies")) return true;
        if (lower === "koreatech" && en.includes("korea university of technology")) return true;
        if (lower === "seoul theological university" && en.includes("seoul theological")) return true;
        if (lower === "gyeongsang national university" && en.includes("gyeongsang")) return true;
        if (lower === "gyeongkuk national university" && en.includes("gyeongkuk")) return true;
        return false;
      });
    };

    const getProgramId = (level: string, track: string, sub: string) => {
      return programInfos.find(
        (p) => p.program_level === level && p.track_type === track && p.sub_track === sub
      )?.id;
    };

    // Build designation records
    const designations: Array<{
      university_id: string;
      gks_program_info_id: string;
      university_type: string;
      is_uic: boolean;
      is_rd: boolean;
      is_global_network: boolean;
    }> = [];

    const unmatchedNames: string[] = [];

    const addDesignation = (
      name: string,
      programInfoId: string,
      uniType: string,
      flags: { is_uic?: boolean; is_rd?: boolean; is_global_network?: boolean } = {}
    ) => {
      const uni = findUniversity(name);
      if (!uni) {
        unmatchedNames.push(name);
        return;
      }
      designations.push({
        university_id: uni.id,
        gks_program_info_id: programInfoId,
        university_type: uniType,
        is_uic: flags.is_uic || false,
        is_rd: flags.is_rd || false,
        is_global_network: flags.is_global_network || false,
      });
    };

    // Graduate embassy general/overseas_korean - both use Type A and B
    const gradEmbassyGeneralId = getProgramId("graduate", "embassy", "general");
    const gradUniGeneralId = getProgramId("graduate", "university", "general");
    const gradUniRGKSId = getProgramId("graduate", "university", "r_gks");
    const gradUniRDId = getProgramId("graduate", "university", "rd");
    const gradUniGNId = getProgramId("graduate", "university", "global_network");

    if (gradEmbassyGeneralId) {
      for (const name of [...gradTypeA, ...gradTypeASpecial]) {
        addDesignation(name, gradEmbassyGeneralId, "A");
      }
      for (const name of gradTypeB) {
        addDesignation(name, gradEmbassyGeneralId, "B");
      }
    }

    // Graduate university general - Type A and B
    if (gradUniGeneralId) {
      for (const name of [...gradTypeA, ...gradTypeASpecial]) {
        addDesignation(name, gradUniGeneralId, "A");
      }
      for (const name of gradTypeB) {
        addDesignation(name, gradUniGeneralId, "B");
      }
    }

    // Graduate R-GKS - Type B only
    if (gradUniRGKSId) {
      for (const name of gradTypeB) {
        addDesignation(name, gradUniRGKSId, "B");
      }
    }

    // Graduate R&D
    if (gradUniRDId) {
      for (const name of rdUniversities) {
        const uniType = [...gradTypeA, ...gradTypeASpecial].some(
          (a) => a.toLowerCase() === name.toLowerCase()
        ) ? "A" : "B";
        addDesignation(name, gradUniRDId, uniType, { is_rd: true });
      }
    }

    // Graduate Global Network
    if (gradUniGNId) {
      for (const name of globalNetworkUniversities) {
        const uniType = [...gradTypeA, ...gradTypeASpecial].some(
          (a) => a.toLowerCase() === name.toLowerCase()
        ) ? "A" : "B";
        addDesignation(name, gradUniGNId, uniType, { is_global_network: true });
      }
    }

    // Insert designations in batches
    let insertedCount = 0;
    let errorCount = 0;
    const batchSize = 50;
    
    for (let i = 0; i < designations.length; i += batchSize) {
      const batch = designations.slice(i, i + batchSize);
      const { error } = await supabase
        .from("gks_designated_universities")
        .upsert(batch, { onConflict: "university_id,gks_program_info_id" });
      if (error) {
        errorCount += batch.length;
        results.push(`ERROR batch ${i}: ${error.message}`);
      } else {
        insertedCount += batch.length;
      }
    }

    results.push(`Inserted ${insertedCount} designations, ${errorCount} errors`);
    results.push(`Unmatched university names: ${unmatchedNames.length > 0 ? unmatchedNames.join(", ") : "none"}`);

    return new Response(
      JSON.stringify({ success: true, results, totalDesignations: designations.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
