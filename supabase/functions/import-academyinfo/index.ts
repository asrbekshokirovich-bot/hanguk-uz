import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// XML parser helper
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractAllItems(xml: string, itemTag: string): string[] {
  const regex = new RegExp(`<${itemTag}>(.*?)</${itemTag}>`, "gis");
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(xml)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

async function handleTuition(supabase: any, serviceKey: string) {
  const results: string[] = [];
  const apiUrl = `http://openapi.academyinfo.go.kr/openapi/service/rest/FinancesService/getComparisonTuitionCrntSt?serviceKey=${encodeURIComponent(serviceKey)}&svyYr=2024&pageNo=1&numOfRows=500`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    const text = await response.text();
    return { error: `API returned ${response.status}`, body: text.slice(0, 500) };
  }

  const xml = await response.text();
  const items = extractAllItems(xml, "item");
  results.push(`Fetched ${items.length} tuition records from API`);
  if (items.length === 0) {
    results.push(`Raw XML preview: ${xml.slice(0, 1000)}`);
  }

  const tuitionByUni: Record<string, { min: number; max: number; name: string }> = {};
  for (const item of items) {
    const schoolName = extractTag(item, "schlNm");
    const avgTuition = parseInt(extractTag(item, "avrgAmt") || "0", 10);
    if (!schoolName || avgTuition <= 0) continue;
    if (!tuitionByUni[schoolName]) {
      tuitionByUni[schoolName] = { min: avgTuition, max: avgTuition, name: schoolName };
    } else {
      tuitionByUni[schoolName].min = Math.min(tuitionByUni[schoolName].min, avgTuition);
      tuitionByUni[schoolName].max = Math.max(tuitionByUni[schoolName].max, avgTuition);
    }
  }

  const { data: universities } = await supabase
    .from("universities")
    .select("id, name_ko, tuition_min, tuition_max");

  if (!universities) return { error: "Could not fetch universities" };

  let matchedCount = 0;
  let updatedCount = 0;
  for (const [, data] of Object.entries(tuitionByUni)) {
    const uni = universities.find((u: any) => u.name_ko && u.name_ko === data.name);
    if (!uni) continue;
    matchedCount++;
    const { error } = await supabase
      .from("universities")
      .update({ tuition_min: data.min, tuition_max: data.max })
      .eq("id", uni.id);
    if (!error) updatedCount++;
  }

  results.push(`Matched ${matchedCount} universities, updated ${updatedCount}`);
  return { results };
}

async function handleScholarships(supabase: any, serviceKey: string) {
  const results: string[] = [];
  const apiUrl = `http://openapi.academyinfo.go.kr/openapi/service/rest/FinancesService/getComparisonScholarCrntSt?serviceKey=${encodeURIComponent(serviceKey)}&svyYr=2024&pageNo=1&numOfRows=500`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    const text = await response.text();
    return { error: `API returned ${response.status}`, body: text.slice(0, 500) };
  }

  const xml = await response.text();
  const items = extractAllItems(xml, "item");
  results.push(`Fetched ${items.length} scholarship records from API`);

  const { data: universities } = await supabase
    .from("universities")
    .select("id, name_ko");

  if (!universities) return { error: "Could not fetch universities" };

  let matchedCount = 0;
  let upsertedCount = 0;

  for (const item of items) {
    const schoolName = extractTag(item, "schlNm");
    const scholarPerStudent = parseInt(extractTag(item, "avrgAmt") || "0", 10);
    const scholarRatio = parseFloat(extractTag(item, "bnfitRt") || "0");

    if (!schoolName) continue;

    const uni = universities.find((u: any) => u.name_ko && u.name_ko === schoolName);
    if (!uni) continue;
    matchedCount++;

    const { error } = await supabase.from("scholarships").upsert(
      {
        university_id: uni.id,
        name: `University Scholarship (${schoolName})`,
        type: "university",
        amount_krw: scholarPerStudent,
        coverage_percentage: scholarRatio,
        source: "academyinfo",
      },
      { onConflict: "university_id,name" }
    );

    if (!error) upsertedCount++;
  }

  results.push(`Matched ${matchedCount} universities, upserted ${upsertedCount} scholarship records`);
  return { results };
}

async function handleDepartments(supabase: any, serviceKey: string, offset: number, batchSize: number) {
  const results: string[] = [];
  const pageNo = Math.floor(offset / batchSize) + 1;
  const apiUrl = `https://api.data.go.kr/B490001/SchoolMajorInfoService/getSchoolMajorInfo?serviceKey=${encodeURIComponent(serviceKey)}&pageNo=${pageNo}&numOfRows=${batchSize}&type=xml`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    const text = await response.text();
    return { error: `API returned ${response.status}`, body: text.slice(0, 500) };
  }

  const xml = await response.text();
  const totalCount = parseInt(extractTag(xml, "totalCount") || "0", 10);
  const items = extractAllItems(xml, "item");
  results.push(`Page ${pageNo}: ${items.length} department records (total: ${totalCount})`);

  const { data: universities } = await supabase
    .from("universities")
    .select("id, name_ko");

  if (!universities) return { error: "Could not fetch universities" };

  let insertedCount = 0;
  for (const item of items) {
    const schoolName = extractTag(item, "schlNm");
    const deptName = extractTag(item, "subjNm");
    const degreeLevel = extractTag(item, "dgreeNm");
    if (!schoolName || !deptName) continue;

    const uni = universities.find((u: any) => u.name_ko && u.name_ko === schoolName);
    if (!uni) continue;

    let programLevel = "bachelor";
    if (degreeLevel?.includes("석사")) programLevel = "master";
    else if (degreeLevel?.includes("박사")) programLevel = "doctoral";

    const { error } = await supabase.from("university_programs").upsert(
      {
        university_id: uni.id,
        program_name: deptName,
        program_level: programLevel,
        language_track: "korean",
        faculty_name: deptName,
      },
      { onConflict: "university_id,program_name,program_level" }
    );
    if (!error) insertedCount++;
  }

  results.push(`Inserted/updated ${insertedCount} programs`);
  const hasMore = pageNo * batchSize < totalCount;
  if (hasMore) results.push(`More data available. Call again with offset=${offset + batchSize}`);
  return { results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
    );

    const serviceKey = Deno.env.get("DATA_GO_KR_SERVICE_KEY");
    if (!serviceKey) {
      return new Response(
        JSON.stringify({ error: "DATA_GO_KR_SERVICE_KEY secret not configured." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "tuition";
    const offset = body.offset || 0;
    const batchSize = body.batchSize || 20;

    let result: any;

    if (mode === "tuition") {
      result = await handleTuition(supabase, serviceKey);
    } else if (mode === "scholarships") {
      result = await handleScholarships(supabase, serviceKey);
    } else if (mode === "departments") {
      result = await handleDepartments(supabase, serviceKey, offset, batchSize);
    } else {
      result = { error: `Unknown mode: ${mode}` };
    }

    if (result.error) {
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, mode, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
