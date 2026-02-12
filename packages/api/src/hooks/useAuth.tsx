// useAuth Hook - Casa Authentication
// Mission 02: Authentication & User Profiles

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { User, Session, AuthChangeEvent, Provider } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../client';
import type { UserRole } from '../types/database';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export interface OAuthOptions {
  redirectTo?: string;
  scopes?: string;
}

export interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<void>;
  signInWithOAuth: (provider: Provider, options?: OAuthOptions) => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

export interface AuthContextValue extends AuthState, AuthActions {
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      // If Supabase isn't configured, just mark as done loading (demo mode)
      if (!isSupabaseConfigured()) {
        if (mounted) {
          setState(prev => ({ ...prev, loading: false }));
        }
        return;
      }

      try {
        const supabase = getSupabaseClient();

        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (mounted) {
          setState({
            user: session?.user ?? null,
            session,
            loading: false,
            error: null,
          });
        }

        // Listen for auth changes
        const { data } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, session: Session | null) => {
            if (mounted) {
              setState({
                user: session?.user ?? null,
                session,
                loading: false,
                error: null,
              });
            }
          }
        );
        subscription = data.subscription;
      } catch (caught) {
        const errorMessage = caught instanceof Error ? caught.message : 'Failed to initialize auth';

        // If the refresh token is invalid/expired, clear the session entirely
        // so the app redirects to the login screen instead of showing an error
        const isTokenError = errorMessage.toLowerCase().includes('refresh token')
          || errorMessage.toLowerCase().includes('token not found')
          || errorMessage.toLowerCase().includes('invalid token');

        if (isTokenError) {
          try {
            const supabase = getSupabaseClient();
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Ignore signOut errors during recovery
          }
        }

        if (mounted) {
          setState({
            user: null,
            session: null,
            loading: false,
            error: isTokenError ? null : errorMessage,
          });
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const signInWithOAuth = useCallback(async (
    provider: Provider,
    options?: OAuthOptions
  ): Promise<string | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: options?.redirectTo,
          scopes: options?.scopes,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      setState(prev => ({ ...prev, loading: false }));
      return data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with OAuth';
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'owner'
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
        },
      });

      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign up';
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      // Note: redirectTo is handled by Supabase dashboard settings for React Native apps
      // The deep link URL should be configured in Supabase Auth settings
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) throw error;

      setState(prev => ({ ...prev, loading: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setState(prev => ({ ...prev, loading: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  return {
    ...state,
    isAuthenticated: !!state.session,
    signIn,
    signInWithOAuth,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
