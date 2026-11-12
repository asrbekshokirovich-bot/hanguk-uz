import { useEffect } from 'react';

export const SITE_NAME = 'Hanguk Consulting';

/** "Maxfiylik siyosati — Hanguk Consulting"; a full title is used as it is. */
export function pageTitle(title: string, full = false): string {
  return full ? title : `${title} — ${SITE_NAME}`;
}

/**
 * The browser tab's title while a page is open. Every page used to carry the
 * home page's Uzbek title — the privacy policy, the terms and the support page
 * too, in whichever language they were read.
 *
 * The title that was there before is put back when the page closes, so the
 * CRM (which writes its own count of waiting chats into the title) is left as
 * it was.
 */
export function usePageTitle(title: string | null | undefined, options: { full?: boolean } = {}): void {
  const full = options.full === true;
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = pageTitle(title, full);
    return () => {
      document.title = before;
    };
  }, [title, full]);
}
