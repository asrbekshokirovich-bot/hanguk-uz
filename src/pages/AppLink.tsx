import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { APP_STORE_URL, androidIntent, appUri, deviceOf, linkCode, playUrl, webUrl } from '@/lib/appLink';

/**
 * hanguk.uz/l/<code>: the link an operator sends a lead (app analytics, stage
 * 2; B2 — the operator decides to whom). On a phone with the app it opens the
 * app at once; on Android without it, Google Play — and the app, once
 * installed, receives the code; elsewhere, the web app. Whichever way, the
 * phone is tied to the lead, so the lead's card shows what they do in the app.
 */
export default function AppLink() {
  const { t } = useTranslation();
  const { code: raw } = useParams();
  const code = linkCode(raw);
  const device = useMemo(() => deviceOf(navigator.userAgent), []);
  const [tried, setTried] = useState(false);

  // A phone tries the app straight away; the buttons stay for a second try.
  useEffect(() => {
    if (!code || device === 'other') return;
    setTried(true);
    window.location.href = device === 'android' ? androidIntent(code) : appUri(code);
  }, [code, device]);

  const open = () => {
    if (!code) return;
    window.location.href = device === 'android' ? androidIntent(code) : appUri(code);
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <header className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10 rounded-lg" />
          <span className="text-xl font-bold tracking-tight text-primary">Hanguk</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-4">
              <Smartphone className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('appLink.title')}</CardTitle>
            <CardDescription className="text-base">{t('appLink.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {code && device !== 'other' && (
              <Button className="w-full" size="lg" onClick={open}>
                {t('appLink.open')}
              </Button>
            )}
            {tried && <p className="text-center text-[13px] text-muted-foreground">{t('appLink.notOpened')}</p>}
            {device !== 'ios' && (
              <Button asChild variant={device === 'android' ? 'outline' : 'default'} className="w-full" size="lg">
                <a href={playUrl(code)}>{t('appLink.googlePlay')}</a>
              </Button>
            )}
            {device !== 'android' && APP_STORE_URL && (
              <Button asChild variant="outline" className="w-full" size="lg">
                <a href={APP_STORE_URL}>{t('appLink.appStore')}</a>
              </Button>
            )}
            {device === 'ios' && <p className="text-center text-[13px] text-muted-foreground">{t('appLink.iosAfterInstall')}</p>}
            <Button asChild variant="ghost" className="w-full">
              <a href={webUrl(code)}>
                <Globe className="mr-2 h-4 w-4" />
                {t('appLink.web')}
              </a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
