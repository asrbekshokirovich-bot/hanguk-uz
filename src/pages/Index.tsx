import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  Download,
  ChevronRight
} from 'lucide-react';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isStaff, isUniversityStaff, loading: roleLoading } = useUserRole();

  // Redirect logged-in users based on role - must be before any conditional returns
  useEffect(() => {
    if (user && !loading && !roleLoading) {
      if (isUniversityStaff) {
        navigate('/university-portal');
      } else if (isStaff) {
        navigate('/crm');
      } else {
        navigate('/portal');
      }
    }
  }, [user, isStaff, isUniversityStaff, loading, roleLoading, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <img src="/logo.jpg" alt="Hanguk" className="h-16 w-16 rounded-xl object-cover" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Not logged in - show welcome screen
  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        {/* Header */}
        <header className="flex justify-between items-center p-4">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Hanguk" className="h-10 w-10 rounded-lg object-cover" />
            <span className="text-xl font-bold text-white">Hanguk</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="highlight" onClick={() => navigate('/auth')}>
              {t('auth.login')}
            </Button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <img src="/logo.jpg" alt="Hanguk" className="h-24 w-24 mx-auto rounded-2xl object-cover shadow-xl ring-4 ring-accent/30" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Hanguk Consulting
            </h1>
            <p className="text-xl text-white/80 max-w-md mx-auto">
              {t('auth.signupSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" variant="highlight" onClick={() => navigate('/auth')}>
                {t('auth.login')}
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" onClick={() => navigate('/install')}>
                <Download className="mr-2 h-5 w-5" />
                {t('install.installButton')}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Logged in - show loading while redirecting
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <img src="/logo.jpg" alt="Hanguk" className="h-16 w-16 rounded-xl object-cover" />
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    </div>
  );
};

export default Index;
