import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/brand/Logo';
import { usePlatform } from '@/hooks/usePlatform';
import { Download, Share, Smartphone, CheckCircle, PartyPopper } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const { t } = useTranslation();
  const { isDespia, isIOS: isPlatformIOS, platform } = usePlatform();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check for iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // If running in Despia native app, show a success message
  if (isDespia) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary">
        <header className="flex justify-between items-center p-4">
          <div className="flex items-center gap-3">
            <Logo variant="glyph" className="h-10 w-10" />
            <span className="text-xl font-bold tracking-tight text-primary">Hanguk</span>
          </div>
          <LanguageSwitcher />
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 bg-success/10 rounded-full w-fit">
                <PartyPopper className="h-12 w-12 text-success" />
              </div>
              <CardTitle className="text-2xl">{t('install.usingNativeApp', "You're using the app!")}</CardTitle>
              <CardDescription className="text-base">
                {t('install.nativeAppDesc', 'You already have the best experience with our native app.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-success p-4 bg-success/10 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  {platform === 'despia-ios' ? 'iOS App' : 'Android App'}
                </span>
              </div>
              <Button variant="outline" className="w-full" onClick={() => window.location.href = '/'}>
                {t('common.back')}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary">
      {/* Header */}
      <header className="flex justify-between items-center p-4">
        <div className="flex items-center gap-3">
          <Logo variant="glyph" className="h-10 w-10" />
          <span className="text-xl font-bold tracking-tight text-primary">Hanguk</span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
              <Smartphone className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('install.title')}</CardTitle>
            <CardDescription className="text-base">
              {t('install.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="flex items-center justify-center gap-2 text-success p-4 bg-success/10 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{t('install.alreadyInstalled')}</span>
              </div>
            ) : isIOS ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Share className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {t('install.iosInstructions')}
                  </p>
                </div>
              </div>
            ) : deferredPrompt ? (
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="mr-2 h-5 w-5" />
                {t('install.installButton')}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Download className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {t('install.androidInstructions')}
                  </p>
                </div>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/'}>
              {t('common.back')}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}