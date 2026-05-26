import { useQuery } from '@tanstack/react-query';
import { looseFrom, useTranslations, type TranslationLookup } from './useTranslations';

/**
 * Applicant-facing university notices: the uni_db `public.announcements` scraped
 * from each institution's notice board (joined via announcement_sources), with
 * their precomputed en/uz title translations. Distinct from the staff-posted
 * room announcements in useUniversityAnnouncements.
 */

export interface InstitutionNotice {
  id: string;
  title_ko: string | null;
  url_ko: string | null;
  posted_at: string | null;
  category: string | null;
}

interface NoticeRow {
  id: string;
  title_ko: string | null;
  url_ko: string | null;
  posted_at: string | null;
  classifier_label: string | null;
}

export interface InstitutionNoticesResult {
  notices: InstitutionNotice[];
  /** Translation lookup for each notice's title_ko. */
  titles: TranslationLookup;
  isLoading: boolean;
}

export function useInstitutionNotices(
  institutionId: string | null | undefined,
  limit = 30,
): InstitutionNoticesResult {
  const { data, isLoading } = useQuery({
    queryKey: ['institution-notices', institutionId, limit],
    enabled: !!institutionId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await looseFrom<NoticeRow>('announcements')
        .select('id, title_ko, url_ko, posted_at, classifier_label, announcement_sources!inner(institution_id)')
        .eq('announcement_sources.institution_id', institutionId as string)
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map(
        (r): InstitutionNotice => ({
          id: r.id,
          title_ko: r.title_ko,
          url_ko: r.url_ko,
          posted_at: r.posted_at,
          category: r.classifier_label,
        }),
      );
    },
  });

  const notices = data ?? [];
  const titles = useTranslations('announcements', notices.map((n) => n.id), ['title_ko']);

  return { notices, titles, isLoading: !!institutionId && isLoading };
}
