/**
 * Guessing which university a blocked link belongs to.
 *
 * `proposed_sources` carries no institution_id — the finder only knows the URL
 * and, for its own researched candidates, the school's Korean name (it passes
 * `row["name_ko"]` as `candidate_title`, see
 * guideline_finder_worker.ingest_one_url). Uploading a PDF needs a real
 * institution, so we reconstruct it here: exact Korean name first (68 of the 72
 * pending rows match that way), then the longest `primary_domain` that the URL
 * host actually ends with.
 *
 * Domain matching is deliberately the fallback: several institutions share a
 * parent domain, so a substring hit is not proof. Every guess stays overridable
 * in the UI — the match only pre-selects, it never uploads on its own.
 */

export interface MatchableInstitution {
  id: string;
  name_ko: string | null;
  name_en: string | null;
  primary_domain: string | null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** `admission.yewon.ac.kr` matches `yewon.ac.kr`, but never `notyewon.ac.kr`. */
function hostMatchesDomain(host: string, domain: string): boolean {
  const d = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!d) return false;
  return host === d || host.endsWith(`.${d}`);
}

export function matchInstitution(
  institutions: MatchableInstitution[],
  url: string,
  candidateTitle: string | null,
): MatchableInstitution | null {
  const title = candidateTitle?.trim();
  if (title) {
    const byName = institutions.find(
      (i) => i.name_ko?.trim() === title || i.name_en?.trim() === title,
    );
    if (byName) return byName;
  }

  const host = hostOf(url);
  if (!host) return null;

  // Longest domain wins so a specific campus domain beats its parent.
  let best: MatchableInstitution | null = null;
  let bestLen = 0;
  for (const i of institutions) {
    if (!i.primary_domain) continue;
    if (!hostMatchesDomain(host, i.primary_domain)) continue;
    if (i.primary_domain.length > bestLen) {
      best = i;
      bestLen = i.primary_domain.length;
    }
  }
  return best;
}

export function institutionLabel(i: MatchableInstitution): string {
  const ko = i.name_ko?.trim();
  const en = i.name_en?.trim();
  if (ko && en) return `${ko} · ${en}`;
  return ko || en || i.id;
}
