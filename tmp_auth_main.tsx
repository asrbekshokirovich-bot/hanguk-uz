import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Lock, Crown, KeyRound, GraduationCap, Briefcase } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { z } from 'zod';

const usernameSchema = z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores');
const passwordSchema = z.string().min(6);
const magicCodeSchema = z.string().min(6).max(10).regex(/^[A-Z0-9]+$/, 'Invalid code format');

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signInWithUsername, signUpOwner, user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [ownerExists, setOwnerExists] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [magicCode, setMagicCode] = useState('');

  // Check if owner account exists
  useEffect(() => {
    const checkOwnerExists = async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('owner_created')
        .eq('id', 'main')
        .maybeSingle();

      if (!error && data) {
        setOwnerExists(data.owner_created);
        setIsSetupMode(!data.owner_created);
      } else {
        // If no settings exist, we need setup
        setIsSetupMode(true);
      }
      setCheckingSetup(false);
    };

    checkOwnerExists();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!usernameSchema.safeParse(username).success) {
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
    const { error } = await signInWithUsername(username, password);
    setLoading(false);

    if (error) {
      toast({ title: t('auth.loginError'), description: 'Invalid username or password', variant: 'destructive' });
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
        description: 'Please enter a valid code (letters and numbers only)',
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
        throw new Error(data?.error || error?.message || 'Login failed');
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
      toast({
        title: t('auth.loginError'),
        description: error.message || 'Invalid code',
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

  if (checkingSetup) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-secondary">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.jpg" alt="Hanguk" className="h-12 w-12 rounded-xl object-cover animate-pulse" />
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-primary/10 via-background to-accent/5">
      {/* Header with Language Switcher */}
      <header className="flex justify-between items-center p-4">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Hanguk" className="h-10 w-10 rounded-lg object-cover" />
          <span className="text-xl font-bold text-primary">Hanguk</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      {/* Auth Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-border/50 backdrop-blur">
          <CardHeader className="text-center">
            <img src="/logo.jpg" alt="Hanguk" className="h-16 w-16 mx-auto rounded-xl object-cover mb-4 ring-2 ring-accent/20" />
            <CardTitle className="text-2xl text-primary">Hanguk</CardTitle>
            <CardDescription>
              {isSetupMode ? 'Initial Setup - Create Owner Account' : t('auth.loginSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSetupMode ? (
              // Owner Setup Form
              <form onSubmit={handleOwnerSetup} className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Crown className="h-5 w-5" />
                    <span className="font-medium">First-time Setup</span>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    Create the owner account. After this, public registration will be disabled.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-name">{t('auth.fullName')}</Label>
                  <Input
                    id="setup-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-username">Username</Label>
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
                    Letters, numbers, and underscores only
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
                  Create Owner Account
                </Button>
              </form>
            ) : (
              // Login Tabs - Staff vs Student
              <Tabs defaultValue="student" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="student" className="w-full gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Student
                  </TabsTrigger>
                  <TabsTrigger value="staff" className="w-full gap-2">
                    <Briefcase className="h-4 w-4" />
                    Staff
                  </TabsTrigger>
                </TabsList>

                {/* Student Login with Magic Code */}
                <TabsContent value="student">
                  <form onSubmit={handleStudentLogin} className="space-y-4 mt-4">
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-sm text-muted-foreground text-center">
                        Enter the code provided by your consultant
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="magic-code">Access Code</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="magic-code"
                          type="text"
                          value={magicCode}
                          onChange={(e) => setMagicCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                          placeholder="XXXXXXXX"
                          className="pl-9 text-center text-lg tracking-widest font-mono"
                          maxLength={10}
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('auth.loginButton')}
                    </Button>
                  </form>
                </TabsContent>

                {/* Staff Login with Username/Password */}
                <TabsContent value="staff">
                  <form onSubmit={handleLogin} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">Username</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-username"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase())}
                          placeholder="username"
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">{t('auth.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••"
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('auth.loginButton')}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
