import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isSessionGoneError } from '@/lib/sessionCheck';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** How often an open tab re-checks that its session still exists server-side. */
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
/** Minimum gap between focus/visibility-triggered checks. */
const SESSION_CHECK_THROTTLE_MS = 30 * 1000;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signInGuest: (email: string, password: string) => Promise<{ error: Error | null; data?: any }>;
  signUpGuest: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; data?: any }>;
  signUpOwner: (username: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  createStaffAccount: (username: string, password: string, fullName: string, roles: string[]) => Promise<{ error: Error | null; userId?: string }>;
  signOut: () => Promise<void>;
  /**
   * Ask the auth server whether this tab's session still exists. Returns false
   * (and shows the "session ended" dialog) when it was revoked elsewhere.
   * Call it after an edge function answers 401.
   */
  verifySession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const lastCheckRef = useRef(0);
  const { t } = useTranslation();

  // A session can be revoked server-side (same account signed out on another
  // computer, password changed, account deleted) while this tab still holds a
  // valid-looking access token for up to an hour. Ask the server.
  const verifySession = useCallback(async (): Promise<boolean> => {
    lastCheckRef.current = Date.now();
    const { data: { session: current } } = await supabase.auth.getSession();
    if (!current) return false;
    const { error } = await supabase.auth.getUser();
    if (isSessionGoneError(error)) {
      setSessionExpired(true);
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    if (!session) return;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheckRef.current < SESSION_CHECK_THROTTLE_MS) return;
      void verifySession();
    };
    const interval = window.setInterval(check, SESSION_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [session, verifySession]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with username (converts to email format internally)
  const signInWithUsername = async (username: string, password: string) => {
    // Use username as email with a fixed domain
    const email = `${username.toLowerCase()}@hanguk.local`;
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInGuest = async (email: string, password: string) => {
    try {
      // Guest credentials are checked server-side (supabase/functions/guest-auth)
      // against a hash only server code can read; the reply names the guest
      // (id, name, email) and carries nothing else from the leads table.
      const { data, error } = await supabase.functions.invoke('guest-auth', {
        body: { action: 'login', email, password },
      });

      if (error && !data) {
        return { error: new Error(error.message || 'INVALID_CREDENTIALS') };
      }

      if (!data?.success) {
        // data.code: EMAIL_NOT_FOUND | INVALID_PASSWORD | TOO_MANY_ATTEMPTS | SERVER_ERROR
        return { error: new Error(data?.code || 'INVALID_CREDENTIALS') };
      }

      return { error: null, data: data.lead };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUpGuest = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('guest-auth', {
        body: { action: 'signup', email, password, fullName },
      });

      if (error && !data) {
        return { error: new Error(error.message || 'Signup failed') };
      }

      if (!data?.success) {
        return { error: new Error(data?.message || data?.code || 'Signup failed') };
      }

      return { error: null, data: data.lead };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Sign up owner account (first-time setup only)
  const signUpOwner = async (username: string, password: string, fullName: string) => {
    const email = `${username.toLowerCase()}@hanguk.local`;
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          username: username.toLowerCase(),
          preferred_language: localStorage.getItem('hanguk-language') || 'uz',
        },
      },
    });

    if (error) return { error };

    // Update profile with username
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ username: username.toLowerCase() })
        .eq('user_id', data.user.id);

      // Add owner role
      await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role: 'owner' });

      // Mark owner as created in settings
      await supabase
        .from('system_settings')
        .update({ owner_created: true, signup_enabled: false })
        .eq('id', 'main');
    }

    return { error: null };
  };

  // Create staff account via edge function (doesn't affect current session)
  const createStaffAccount = async (
    username: string, 
    password: string, 
    fullName: string, 
    roles: string[]
  ) => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        return { error: new Error('Not authenticated') };
      }

      const response = await supabase.functions.invoke('create-staff', {
        body: { username, password, fullName, roles },
      });

      if (response.error) {
        return { error: new Error(response.error.message) };
      }

      if (response.data?.error) {
        return { error: new Error(response.data.error) };
      }

      return { error: null, userId: response.data?.userId };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to create staff account') };
    }
  };

  const signOut = async () => {
    try {
      setSession(null);
      setUser(null);
      localStorage.removeItem('guest_session');
      // 'local' = sign out of THIS browser only. The supabase-js default
      // ('global') revoked every session of the account, so one person
      // pressing "Chiqish" on a shared login broke the other open tabs
      // (create-student 401 on 2026-10-29).
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    } finally {
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signInWithUsername, 
      signInGuest,
      signUpGuest,
      signUpOwner, 
      createStaffAccount,
      signOut,
      verifySession,
    }}>
      {children}
      <AlertDialog open={sessionExpired}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessionExpired.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('sessionExpired.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={async () => {
                await signOut();
                setSessionExpired(false);
                window.location.assign('/auth');
              }}
            >
              {t('sessionExpired.button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
