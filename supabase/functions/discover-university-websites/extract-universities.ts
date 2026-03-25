// ── Phase 1b: Extract universities from scraped content and insert into DB ──
export async function extractAndInsertUniversities(
  allScrapedContent: string,
  lovableApiKey: string,
  supabase: any,
): Promise<{ imported: number; total: number }> {
  console.log('=== extractAndInsertUniversities ===');

  if (!allScrapedContent) {
    console.error('No content to extract from');
    return { imported: 0, total: 0 };
  }

  const extractionPrompt = `Extract ALL universities and colleges from the following content about South Korean higher education institutions.

For each institution, provide:
- name_en: Full official English name (official romanization). If the university is commonly known by an abbreviation (e.g., KAIST, POSTECH, SNU, SKKU), put the FULL name here.
- name_en_abbr: Common abbreviation or short name if one exists (e.g., "KAIST", "POSTECH", "SNU"), or null if none
- name_ko: Korean name (한국어) — REQUIRED, always include this
- city: City/region in English
- type: "university", "college", "institute", or "graduate_school"

IMPORTANT:
- Include EVERY institution mentioned, even small ones
- Do NOT include branch campuses as separate entries
- Use official English names when available
- If only Korean name exists, transliterate it
- ALWAYS include the Korean name (name_ko) — this is critical for deduplication
- For well-known universities, ALWAYS include the abbreviation in name_en_abbr

Return a JSON array of objects. Return ONLY the JSON array, no other text.`;

  const chunks: string[] = [];
  const MAX_CHUNK = 30000;
  for (let i = 0; i < allScrapedContent.length; i += MAX_CHUNK) {
    chunks.push(allScrapedContent.substring(i, i + MAX_CHUNK));
  }

  const allExtracted: any[] = [];

  for (const chunk of chunks) {
    try {
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: extractionPrompt },
            { role: 'user', content: chunk },
          ],
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            allExtracted.push(...parsed);
            console.log(`Extracted ${parsed.length} universities from chunk`);
          } catch (parseErr) {
            console.error('JSON parse error from AI:', parseErr);
          }
        }
      }
    } catch (err) {
      console.error('AI extraction error:', err);
    }
  }

  console.log(`Total extracted from AI: ${allExtracted.length} institutions`);

  const normalizeEn = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const seen = new Map<string, any>();
  for (const uni of allExtracted) {
    if (!uni.name_en) continue;
    if (uni.name_ko) {
      const koKey = uni.name_ko.replace(/\s+/g, '');
      if (seen.has(`ko:${koKey}`)) continue;
      seen.set(`ko:${koKey}`, uni);
    }
    const enKey = normalizeEn(uni.name_en);
    if (!seen.has(`en:${enKey}`)) {
      seen.set(`en:${enKey}`, uni);
    }
    if (uni.name_en_abbr) {
      const abbrKey = normalizeEn(uni.name_en_abbr);
      if (!seen.has(`en:${abbrKey}`)) {
        seen.set(`en:${abbrKey}`, uni);
      }
    }
  }
  const uniqueExtracted = [...new Set(seen.values())];
  console.log(`After dedup: ${uniqueExtracted.length} unique institutions`);

  const { data: existing } = await supabase
    .from('universities')
    .select('id, name_en, name_ko');

  const existingEnNames = (existing || []).map((u: any) => ({
    normalized: normalizeEn(u.name_en || ''),
    original: u.name_en || '',
  }));
  const existingKoNames = new Set(
    (existing || []).filter((u: any) => u.name_ko).map((u: any) => u.name_ko.replace(/\s+/g, ''))
  );

  function isEnglishDuplicate(newName: string): boolean {
    const newNorm = normalizeEn(newName);
    for (const ex of existingEnNames) {
      if (ex.normalized === newNorm) return true;
      if (ex.normalized.length > 5 && newNorm.length > 5) {
        const shorter = Math.min(ex.normalized.length, newNorm.length);
        const longer = Math.max(ex.normalized.length, newNorm.length);
        if (shorter / longer > 0.7) {
          if (ex.normalized.includes(newNorm) || newNorm.includes(ex.normalized)) return true;
        }
      }
    }
    return false;
  }

  const newUniversities = uniqueExtracted.filter(u => {
    if (u.name_ko) {
      const koKey = u.name_ko.replace(/\s+/g, '');
      if (existingKoNames.has(koKey)) return false;
    }
    if (isEnglishDuplicate(u.name_en)) return false;
    if (u.name_en_abbr && isEnglishDuplicate(u.name_en_abbr)) return false;
    return true;
  });

  console.log(`New universities to insert: ${newUniversities.length}`);

  let imported = 0;
  const INSERT_BATCH = 20;
  for (let i = 0; i < newUniversities.length; i += INSERT_BATCH) {
    const batch = newUniversities.slice(i, i + INSERT_BATCH).map((u: any) => ({
      name_en: u.name_en,
      name_uz: u.name_en,
      name_ko: u.name_ko || null,
      city_en: u.city || null,
      is_visible_on_map: false,
      is_partner: false,
    }));

    const { error } = await supabase.from('universities').insert(batch);
    if (error) {
      console.error(`Insert batch error:`, error);
    } else {
      imported += batch.length;
      console.log(`Inserted batch: ${imported}/${newUniversities.length}`);
    }
  }

  const { count: totalCount } = await supabase
    .from('universities')
    .select('id', { count: 'exact', head: true });

  return { imported, total: totalCount || 0 };
}
