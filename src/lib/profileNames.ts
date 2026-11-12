import { supabase } from '@/integrations/supabase/client';

/**
 * The names of several people in one request.
 *
 * Lists used to ask for each row's person separately — «Vazifalar» made two
 * requests per task (assignee, creator): 138 `profiles` requests for 69 tasks
 * on every opening of the page or the calendar, each waiting seconds behind
 * the others.
 *
 * A person who has no profile is simply not in the map.
 */
export type ProfileName = { full_name: string | null };

const CHUNK = 150; // ids per request: keeps the URL well under any limit

export async function fetchProfileNames(
  ids: Iterable<string | null | undefined>,
): Promise<Map<string, ProfileName>> {
  const unique = [...new Set([...ids].filter((id): id is string => typeof id === 'string' && id !== ''))];
  const names = new Map<string, ProfileName>();
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', unique.slice(i, i + CHUNK));
    if (error) {
      console.error('Error fetching profile names:', error);
      continue;
    }
    for (const p of data ?? []) names.set(p.user_id, { full_name: p.full_name });
  }
  return names;
}
