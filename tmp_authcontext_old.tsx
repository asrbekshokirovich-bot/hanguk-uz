import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthContext] Auth event:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Initial session check:', !!session, session?.user?.id);
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
      console.log('[AuthContext] Attempting guest sign in for:', email);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Sign in error:', error);
        throw error;
      }

      if (!data) {
        console.warn('[AuthContext] No guest found with provided credentials');
        return { error: new Error('Invalid email or password') };
      }

      // Update login count and history directly in Supabase
      const loginCount = (data.login_count || 0) + 1;
      const now = new Date().toISOString();
      const loginHistory = [now, ...(data.login_history || [])].slice(0, 20);

      const { error: updateError } = await supabase
        .from('leads')
        .update({
          login_count: loginCount,
          login_history: loginHistory,
          updated_at: now
        })
        .eq('id', data.id);

      if (updateError) {
        console.error('[AuthContext] Error updating guest login history:', updateError);
        // We still return data even if history update fails
      }

      return { error: null, data: { ...data, login_count: loginCount, login_history: loginHistory } };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUpGuest = async (email: string, password: string, fullName: string) => {
    try {
      console.log('[AuthContext] Starting guest sign up for:', email);
      // Check for duplicate email in Supabase
      const { data: existing, error: checkError } = await supabase
        .from('leads')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (checkError) {
        console.error('[AuthContext] Error checking existing email:', checkError);
        throw checkError;
      }

      if (existing) {
        return { error: new Error('Bu email allaqachon ro\'yxatdan o\'tgan.') };
      }

      const now = new Date().toISOString();
      const newRegistration = {
        full_name: fullName,
        email: email,
        password: password,
        created_at: now,
        updated_at: now,
        login_count: 1,
        login_history: [now],
        source: 'Public Registration',
        status: 'new'
      };

      console.log('[AuthContext] Inserting new lead into Supabase:', newRegistration);
      const { data, error } = await supabase
        .from('leads')
        .insert(newRegistration)
        .select()
        .single();

      if (error) {
        console.error('[AuthContext] Supabase insert error:', error);
        throw error;
      }

      console.log('[AuthContext] New lead created successfully:', data.id);
      return { error: null, data };
    } catch (err: any) {
      console.error('[AuthContext] Catch block error in signUpGuest:', err);
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
      console.log('[AuthContext] Signing out...');
      // 1. Clear local session/user state immediately for instant UI response
      setSession(null);
      setUser(null);

      // 2. Clear known local identifiers
      localStorage.removeItem('guest_session');

      // 3. Clear Supabase session server-side
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    } finally {
      // Force local state cleanup to ensure UI responds even if network/server fails
      setSession(null);
      setUser(null);
      console.log('[AuthContext] Local auth state cleared');
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
      signOut
    }}>
      {children}
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
