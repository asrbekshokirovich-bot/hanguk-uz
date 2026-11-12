import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Instagram, Phone, Send } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { CONTACTS } from '@/lib/contacts';

/**
 * The home page's footer: how to reach the company and the pages every visitor
 * may look for (support, privacy, terms). Until 2026-11-12 the home page had
 * no link at all — not to a phone number, not to Telegram, not to the privacy
 * policy; the only way on was «Kirish».
 */
export function SiteFooter() {
  const { t } = useTranslation();
  const link = 'inline-flex min-h-[32px] items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground';

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-5 py-8 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5">
          <Logo variant="badge" className="h-9 w-9 rounded-lg" />
          <div>
            <div className="text-sm font-bold">Hanguk Consulting</div>
            <div className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} · {t('landing.footerCity', { defaultValue: 'Tashkent' })}
            </div>
          </div>
        </div>

        <nav
          aria-label={t('landing.footerContact', { defaultValue: 'Contact' })}
          className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium"
        >
          <a href={CONTACTS.telegramDirect} target="_blank" rel="noopener noreferrer" className={link}>
            <Send className="h-4 w-4" aria-hidden />
            Telegram
          </a>
          <a href={CONTACTS.instagram} target="_blank" rel="noopener noreferrer" className={link}>
            <Instagram className="h-4 w-4" aria-hidden />
            Instagram
          </a>
          <a href={`tel:${CONTACTS.phone}`} className={link}>
            <Phone className="h-4 w-4" aria-hidden />
            {CONTACTS.phoneDisplay}
          </a>
        </nav>

        <nav
          aria-label={t('landing.footerLinks', { defaultValue: 'Information' })}
          className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm"
        >
          <Link to="/support" className={link}>
            {t('landing.footerSupport', { defaultValue: 'Support' })}
          </Link>
          <Link to="/privacy" className={link}>
            {t('landing.footerPrivacy', { defaultValue: 'Privacy Policy' })}
          </Link>
          <Link to="/terms" className={link}>
            {t('landing.footerTerms', { defaultValue: 'Terms of Service' })}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
