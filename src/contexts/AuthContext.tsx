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
      // Guest credentials are validated server-side (service role) so the
      // `leads` table — which stores plaintext passwords — is never exposed to
      // the anon key. See supabase/functions/guest-auth.
      const { data, error } = await supabase.functions.invoke('guest-auth', {
        body: { action: 'login', email, password },
      });

      if (error && !data) {
        return { error: new Error(error.message || 'INVALID_CREDENTIALS') };
      }

      if (!data?.success) {
        // data.code is one of EMAIL_NOT_FOUND | INVALID_PASSWORD | SERVER_ERROR
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
      await supabase.auth.signOut();
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
