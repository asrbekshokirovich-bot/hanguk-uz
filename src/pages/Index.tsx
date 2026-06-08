import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { Logo } from '@/components/Logo';
import {
  ArrowRight,
  Play,
  Check,
  Trophy,
  FileText,
  GraduationCap,
  MessageSquare,
  Target,
  ShieldCheck,
  Headphones,
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
          <Logo className="h-16 w-16" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Logged in — show loading while redirecting
  if (user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Logo className="h-16 w-16" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const stats: [string, string][] = [
    ['38', t('landing.statUniversities', { defaultValue: 'Universities' })],
    ['1,200+', t('landing.statStudents', { defaultValue: 'Students' })],
    ['94%', t('landing.statAcceptance', { defaultValue: 'Acceptance' })],
  ];

  const features: [typeof FileText, string, string][] = [
    [FileText, t('landing.featDocsTitle', { defaultValue: 'Documents & translation' }), t('landing.featDocsBody', { defaultValue: 'We collect, translate and apostille every document — no guesswork.' })],
    [GraduationCap, t('landing.featMatchTitle', { defaultValue: 'University matching' }), t('landing.featMatchBody', { defaultValue: 'Hanguk AI matches your profile to the right programs and universities.' })],
    [MessageSquare, t('landing.featInterviewTitle', { defaultValue: 'AI interview practice' }), t('landing.featInterviewBody', { defaultValue: 'Rehearse real admission interviews with a voice AI before the real thing.' })],
    [Target, t('landing.featTrackTitle', { defaultValue: 'Application tracking' }), t('landing.featTrackBody', { defaultValue: 'Follow every application stage in real time, from your phone.' })],
    [ShieldCheck, t('landing.featVisaTitle', { defaultValue: 'Visa & arrival' }), t('landing.featVisaBody', { defaultValue: 'Visa paperwork, flights and housing — handled together.' })],
    [Headphones, t('landing.featConsultantTitle', { defaultValue: 'Personal consultant' }), t('landing.featConsultantBody', { defaultValue: 'A dedicated consultant with you the whole journey.' })],
  ];

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <Logo variant="badge" className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-bold tracking-tight">Hanguk</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <ThemeToggleButton />
          <Button variant="outline" onClick={() => navigate('/auth')}>
            {t('auth.login')}
          </Button>
          <Button variant="highlight" className="hidden sm:inline-flex" onClick={() => navigate('/auth')}>
            {t('landing.getStarted', { defaultValue: 'Get started' })}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-5 py-12 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <div className="min-w-0 animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t('landing.trustedBy', { defaultValue: 'Trusted by 1,200+ students in Uzbekistan' })}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {t('landing.heroLine1', { defaultValue: 'Your path to a' })}{' '}
            <span className="text-primary">{t('landing.heroHighlight', { defaultValue: 'South Korean' })}</span>{' '}
            {t('landing.heroLine2', { defaultValue: 'university' })}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            {t('landing.heroSub', { defaultValue: 'Hanguk Consulting guides you from first inquiry to enrolment — documents, translation, applications, interviews and visa. All in one place.' })}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="highlight" onClick={() => navigate('/auth')}>
              {t('landing.startJourney', { defaultValue: 'Start your journey' })}
              <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/install')}>
              <Play className="mr-1 h-5 w-5" />
              {t('landing.watchHow', { defaultValue: 'Watch how it works' })}
            </Button>
          </div>
          <div className="mt-10 flex items-center gap-8">
            {stats.map(([value, label]) => (
              <div key={label}>
                <div className="text-2xl font-extrabold tracking-tight">{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero visual: application-preview card */}
        <div className="relative min-w-0 animate-fade-up">
          <div className="absolute -inset-5 rounded-[40px] bg-[radial-gradient(circle_at_70%_30%,hsl(var(--accent)/0.18),transparent_60%)]" />
          <Card className="relative p-6 shadow-float">
            <div className="mb-5 flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarFallback className="bg-primary/10 font-semibold text-primary">AK</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Aziz Karimov</div>
                <div className="truncate text-xs text-muted-foreground">Application to Seoul National University</div>
              </div>
              <span className="shrink-0 rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-semibold text-info">Submitted</span>
            </div>
            <div className="mb-5 flex items-start">
              {['Docs', 'Trans', 'Apost', 'Submit', 'Visa'].map((step, i) => {
                const done = i < 3;
                const current = i === 3;
                return (
                  <div key={step} className="relative flex flex-1 flex-col items-center">
                    {i < 4 && <div className={`absolute left-1/2 top-3 h-0.5 w-full ${done ? 'bg-accent' : 'bg-border'}`} />}
                    <div className={`z-10 flex h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-accent text-accent-foreground' : current ? 'bg-accent/15 ring-2 ring-accent' : 'bg-muted'}`}>
                      {done && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>
                    <span className={`mt-1.5 text-[10px] ${done || current ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{step}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-md bg-muted p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">TOPIK</div>
                <div className="text-lg font-bold">Level 4</div>
              </div>
              <div className="rounded-md bg-muted p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Documents</div>
                <div className="text-lg font-bold">6 / 7</div>
              </div>
            </div>
          </Card>
          <Card className="absolute -bottom-6 -left-4 flex items-center gap-2.5 p-3 shadow-pop sm:-left-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
              <Trophy className="h-4 w-4 text-success" />
            </div>
            <div>
              <div className="text-xs font-bold">{t('landing.accepted', { defaultValue: 'Accepted!' })}</div>
              <div className="text-[11px] text-muted-foreground">Sardor → Hanyang Univ.</div>
            </div>
          </Card>
        </div>
      </section>

      {/* Trust band */}
      <div className="border-y border-border bg-card">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-10">
          <span className="text-sm font-semibold text-muted-foreground">
            {t('landing.partnerUniversities', { defaultValue: 'Partner universities' })}
          </span>
          {['Seoul National', 'Yonsei', 'Korea Univ.', 'KAIST', 'Hanyang', 'Ewha'].map((u) => (
            <span key={u} className="text-base font-bold text-muted-foreground/70">{u}</span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-16 sm:px-10">
        <div className="mb-11 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-foreground/80">
            {t('landing.howItWorks', { defaultValue: 'How it works' })}
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
            {t('landing.featuresHeading', { defaultValue: 'Everything you need, end to end' })}
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([Icon, title, body]) => (
            <Card key={title} className="p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-info/10 text-info">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mb-2 font-bold">{title}</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto mb-16 w-full max-w-[1200px] px-5 sm:px-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[hsl(217_56%_42%)] px-8 py-14 text-center shadow-[0_8px_24px_hsl(217_61%_26%/0.28)]">
          <div className="absolute -right-5 -top-10 h-52 w-52 rounded-full bg-accent/15" />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white">
            {t('landing.ctaHeading', { defaultValue: 'Ready to study in South Korea?' })}
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-lg text-white/80">
            {t('landing.ctaSub', { defaultValue: 'Get your magic code from a consultant and start today.' })}
          </p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="highlight" onClick={() => navigate('/auth')}>
              {t('landing.startJourney', { defaultValue: 'Start your journey' })}
              <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => navigate('/install')}
            >
              {t('landing.getApp', { defaultValue: 'Get the app' })}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
