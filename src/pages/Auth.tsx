import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { Logo } from '@/components/brand/Logo';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, User, Lock, Crown, GraduationCap, Briefcase, Eye, EyeOff, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { z } from 'zod';

const usernameSchema = z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores');
const passwordSchema = z.string().min(6);
const magicCodeSchema = z.string().min(6).max(10).regex(/^[A-Z0-9]+$/, 'Invalid code format');

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signInWithUsername, signInGuest, signUpGuest, signUpOwner, user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(() => {
    return !(typeof window !== 'undefined' && (window as any).__OWNER_CHECK_CACHED__);
  });
  const [ownerExists, setOwnerExists] = useState(() => {
    return (typeof window !== 'undefined' && (window as any).__OWNER_EXISTS_CACHED__) || false;
  });
  const [isSetupMode, setIsSetupMode] = useState(() => {
    return (typeof window !== 'undefined' && (window as any).__IS_SETUP_MODE_CACHED__) || false;
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [magicCode, setMagicCode] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmSignUpPassword, setConfirmSignUpPassword] = useState('');
  const [signUpFullName, setSignUpFullName] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmSignUpPassword, setShowConfirmSignUpPassword] = useState(false);
  const [isGuestLoginMode, setIsGuestLoginMode] = useState(false);
  const [activeTab, setActiveTab] = useState('student');

  // Check if owner account exists
  useEffect(() => {
    const checkOwnerExists = async () => {
      // If already checked in this session, skip fetching
      if ((window as any).__OWNER_CHECK_CACHED__) {
        setCheckingSetup(false);
        return;
      }

      const { data, error } = await supabase
        .from('system_settings')
        .select('owner_created')
        .eq('id', 'main')
        .maybeSingle() as { data: { owner_created: boolean } | null, error: any };

      if (!error && data) {
        setOwnerExists(data.owner_created);
        setIsSetupMode(!data.owner_created);

        // Cache findings
        (window as any).__OWNER_EXISTS_CACHED__ = data.owner_created;
        (window as any).__IS_SETUP_MODE_CACHED__ = !data.owner_created;
      } else {
        // If no settings exist, we need setup
        setIsSetupMode(true);
        (window as any).__IS_SETUP_MODE_CACHED__ = true;
      }

      (window as any).__OWNER_CHECK_CACHED__ = true;
      setCheckingSetup(false);
    };

    checkOwnerExists();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
      return;
    }

    // Also redirect guests if they visit /auth while logged in
    const guestSession = localStorage.getItem('guest_session');
    if (guestSession) {
      navigate('/guest-portal');
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation - Allow emails for guests, otherwise enforce username schema
    const isEmail = username.includes('@');
    if (!isEmail && !usernameSchema.safeParse(username).success) {
      toast({
        title: t('auth.loginError'),
        description: 'Username must be 3-20 characters (letters, numbers, underscores)',
        variant: 'destructive'
      });
      return;
    }
    if (!passwordSchema.safeParse(password).success) {
      toast({ title: t('auth.loginError'), description: t('auth.invalidPassword'), variant: 'destructive' });
      return;
    }

    setLoading(true);

    if (isEmail) {
      if (activeTab !== 'registrate') {
        setLoading(false);
        toast({
          title: t('auth.loginError'),
          description: "Staff login must use a username.",
          variant: 'destructive'
        });
        return;
      }

      // Check if user exists first to give better error message
      const { data: existingUser } = await supabase
        .from('leads')
        .select('email')
        .eq('email', username)
        .maybeSingle();

      if (!existingUser) {
        setLoading(false);
        toast({
          title: t('auth.loginError'),
          description: t('auth.emailNotFound'),
          variant: 'destructive'
        });
        return;
      }

      const { data: guestData, error: guestError } = await signInGuest(username, password);

      if (guestError) {
        setLoading(false);
        toast({
          title: t('auth.loginError'),
          description: guestError.message === 'Invalid email or password' ? t('auth.invalidCredentials') : (guestError.message || t('auth.invalidCredentials')),
          variant: 'destructive'
        });
        return;
      }

      if (guestData) {
        localStorage.setItem('guest_session', JSON.stringify(guestData));
        setLoading(false);
        toast({ title: t('auth.loginSuccess') });
        navigate('/guest-portal');
        return;
      }
    }

    const { error } = await signInWithUsername(username, password);
    setLoading(false);

    if (error) {
      toast({ title: t('auth.loginError'), description: t('auth.invalidCredentials'), variant: 'destructive' });
    } else {
      toast({ title: t('auth.loginSuccess') });
      navigate('/');
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCode = magicCode.trim().toUpperCase().replace(/\s+/g, '');

    if (!magicCodeSchema.safeParse(normalizedCode).success) {
      toast({
        title: t('auth.loginError'),
        description: t('auth.invalidFormat'),
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('student-login', {
        body: { magicCode: normalizedCode },
      });

      if (error || data?.error) {
        // If it's a generic Supabase client error for non-2xx, 
        // the actual error message might be in the data body
        const msg = data?.error || error?.message || 'Login failed';
        throw new Error(msg);
      }

      if (data?.session) {
        // Set the session in Supabase client
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          throw sessionError;
        }

        toast({
          title: t('auth.loginSuccess'),
          description: `Welcome, ${data.profile?.full_name || 'Student'}!`
        });
        navigate('/'); // Let Index.tsx handle role-based routing
      }
    } catch (error: any) {
      console.error('[Auth] Student login error details:', error);

      // Agar xato "non-2xx" yoki "Invalid code" bo'lsa, demak talaba topilmagan
      const errorStr = error.message || '';
      const isNotFound =
        errorStr.includes('Invalid code') ||
        errorStr.includes('No profile found') ||
        errorStr.includes('non-2xx') ||
        errorStr.includes('401');

      toast({
        title: t('auth.loginError'),
        description: isNotFound ? t('auth.studentNotFound') : (error.message || 'Error occurred'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!usernameSchema.safeParse(username).success) {
      toast({
        title: 'Setup Error',
        description: 'Username must be 3-20 characters (letters, numbers, underscores)',
        variant: 'destructive'
      });
      return;
    }
    if (!passwordSchema.safeParse(password).success) {
      toast({ title: 'Setup Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Setup Error', description: t('auth.passwordMismatch'), variant: 'destructive' });
      return;
    }
    if (!fullName.trim()) {
      toast({ title: 'Setup Error', description: 'Full name is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await signUpOwner(username, password, fullName);
    setLoading(false);

    if (error) {
      toast({ title: 'Setup Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Owner account created successfully!' });
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signUpPassword !== confirmSignUpPassword) {
      toast({
        title: t('auth.loginError'),
        description: t('auth.passwordMismatch'),
        variant: 'destructive'
      });
      return;
    }

    if (!signUpFullName.trim()) {
      toast({
        title: t('auth.loginError'),
        description: 'Full name is required',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { data: guestData, error: guestError } = await signUpGuest(signUpEmail, signUpPassword, signUpFullName);

      if (guestError) {
        throw guestError;
      }

      // Keep guest_session for immediate access
      localStorage.setItem('guest_session', JSON.stringify(guestData));

      toast({
        title: t('auth.registeredSuccess'),
        description: t('auth.dataSaved'),
      });

      // Clear fields and navigate
      setSignUpEmail('');
      setSignUpPassword('');
      setConfirmSignUpPassword('');
      setSignUpFullName('');
      navigate('/guest-portal');
    } catch (error: any) {
      toast({
        title: t('auth.loginError'),
        description: error.message || 'Signup failed',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-secondary">
        <div className="flex flex-col items-center gap-4">
          <Logo variant="glyph" className="h-12 w-12 animate-pulse" />
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background lg:grid lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-app-gradient p-12 lg:flex">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-accent/10" />
        <div className="relative flex items-center">
          <Logo variant="lockup" onDark className="h-10" />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white">
            {t('auth.brandHeadline', { defaultValue: 'Welcome back to your journey' })}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            {t('auth.brandSub', { defaultValue: 'Track your applications, documents and interviews — all the way to your South Korean university.' })}
          </p>
          <div className="mt-9 flex flex-col gap-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10"><Check className="h-4 w-4 text-accent" /></div>
              <span className="text-sm font-medium text-white/90">{t('auth.tick1', { defaultValue: '94% acceptance rate' })}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10"><ShieldCheck className="h-4 w-4 text-accent" /></div>
              <span className="text-sm font-medium text-white/90">{t('auth.tick2', { defaultValue: 'Documents handled for you' })}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10"><Sparkles className="h-4 w-4 text-accent" /></div>
              <span className="text-sm font-medium text-white/90">{t('auth.tick3', { defaultValue: 'AI interview practice' })}</span>
            </div>
          </div>
        </div>
        <div className="relative text-xs text-white/45">© 2025 Hanguk Consulting · hanguk.uz</div>
      </div>

      {/* Form side */}
      <div className="flex min-h-[100dvh] flex-col lg:min-h-0">
        <header className="flex items-center justify-between p-4">
          <div className="lg:invisible">
            <Logo variant="lockup" className="h-9" />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggleButton />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-10">
          <div className="w-full max-w-sm">
            {isSetupMode ? (
              // Owner Setup Form
              <form onSubmit={handleOwnerSetup} className="space-y-4">
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-warning">
                    <Crown className="h-5 w-5" />
                    <span className="font-medium">{t('auth.firstTimeSetup')}</span>
                  </div>
                  <p className="text-sm text-warning/90 mt-1">
                    {t('auth.setupWarning')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-name">{t('auth.fullName')}</Label>
                  <Input
                    id="setup-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value.toUpperCase())}
                    placeholder={t('auth.fullName')}
                    className="uppercase"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-username">{t('auth.username')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="owner"
                      className="pl-9"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('auth.usernameOnlyChars')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-confirm">{t('auth.confirmPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('auth.createOwnerBtn')}
                </Button>
              </form>
            ) : activeTab === 'registrate' ? (
              <div>
                <button type="button" onClick={() => setActiveTab('student')} className="mb-3 text-sm font-medium text-muted-foreground hover:text-foreground">← {t('common.back', { defaultValue: 'Back' })}</button>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t('auth.tabRegistrate')}</h1>
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-center text-sm text-muted-foreground">{t('auth.registerTabHelper')}</p>
                </div>
                {isGuestLoginMode ? (
                  <form onSubmit={handleLogin} className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="guest-email">{t('auth.email')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="guest-email" type="email" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="example@gmail.com" className="pl-9" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guest-password">{t('auth.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="guest-password" type={showLoginPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className="pl-9 pr-10" required />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                          {showLoginPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('auth.loginSystem')}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleSignUp} className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
                      <Input id="signup-name" type="text" value={signUpFullName} onChange={(e) => setSignUpFullName(e.target.value.toUpperCase())} placeholder={t('auth.fullName')} className="uppercase" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">{t('auth.email')}</Label>
                      <Input id="signup-email" type="email" value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} placeholder="example@gmail.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">{t('auth.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-password" type={showSignUpPassword ? 'text' : 'password'} value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} placeholder="••••••" className="pl-9 pr-10" required />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowSignUpPassword(!showSignUpPassword)}>
                          {showSignUpPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm">{t('auth.confirmPassword')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-confirm" type={showConfirmSignUpPassword ? 'text' : 'password'} value={confirmSignUpPassword} onChange={(e) => setConfirmSignUpPassword(e.target.value)} placeholder="••••••" className="pl-9 pr-10" required />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmSignUpPassword(!showConfirmSignUpPassword)}>
                          {showConfirmSignUpPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('auth.registerBtn')}
                    </Button>
                  </form>
                )}
                <div className="mt-4 text-center">
                  <Button variant="link" size="sm" onClick={() => setIsGuestLoginMode(!isGuestLoginMode)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    {isGuestLoginMode ? t('auth.registerNewAccount') : t('auth.haveAccountMsg')}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t('auth.signIn', { defaultValue: 'Sign in' })}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">{t('auth.chooseContinue', { defaultValue: "Choose how you'd like to continue." })}</p>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setActiveTab('student')} className={cn('flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors', activeTab === 'student' ? 'border-primary bg-info/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    <GraduationCap className="h-4 w-4" />
                    {t('auth.tabStudent')}
                  </button>
                  <button type="button" onClick={() => setActiveTab('staff')} className={cn('flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors', activeTab === 'staff' ? 'border-primary bg-info/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    <Briefcase className="h-4 w-4" />
                    {t('auth.tabStaff')}
                  </button>
                </div>
                {activeTab === 'staff' ? (
                  <form onSubmit={handleLogin} className="mt-5 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">{t('auth.username')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="login-username" type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="username" className="pl-9" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">{t('auth.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="login-password" type={showLoginPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className="pl-9 pr-10" required />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                          {showLoginPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('auth.loginButton')}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleStudentLogin} className="mt-5 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="magic-code">{t('auth.accessCode')}</Label>
                      <input id="magic-code" type="text" value={magicCode} onChange={(e) => setMagicCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="XXXXXXXX" maxLength={10} required className={cn('h-14 w-full rounded-md border bg-card text-center font-mono text-2xl uppercase tracking-[0.3em] text-foreground outline-none transition-colors focus:ring-2 focus:ring-ring', magicCode.length >= 8 ? 'border-accent' : 'border-input')} />
                      <p className="text-xs text-muted-foreground">{t('auth.studentCodeDesc')}</p>
                    </div>
                    <Button type="submit" variant="highlight" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('auth.loginButton')}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      {t('auth.noCodeQ', { defaultValue: "Don't have a code?" })}{' '}
                      <button type="button" onClick={() => setActiveTab('registrate')} className="font-semibold text-primary hover:underline">{t('auth.contactConsultant', { defaultValue: 'Contact a consultant' })}</button>
                    </p>
                  </form>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
