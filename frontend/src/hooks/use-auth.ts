import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // Import the Supabase client
import { User } from '@supabase/supabase-js'; // Import the Supabase User type

// This interface defines the expected shape of the /status API response
interface AuthStatus {
  authenticated: boolean;
  message: string;
  user: User | null;
}

const isDevBypass = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [googleAuthenticated, setGoogleAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // This function fetches both the Supabase session and Google status
  const fetchStatus = useCallback(async () => {
    // --- DEV MODE BYPASS ---
    if (isDevBypass) {
      console.warn("Auth is in Dev Bypass Mode. All requests will use a mock user.");
      setUser({ id: "cbede3b0-2f68-47df-9c26-09a46e588567", email: "test@example.com" } as User);
      setGoogleAuthenticated(true); // Assume Google is connected in dev mode
      setIsLoading(false);
      return;
    }
    // --- END DEV MODE BYPASS ---

    setIsLoading(true);
    try {
      // 1. Check for an active Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session) {
        // 2. If Supabase session exists, check Google auth status
        const response = await fetch('/api/v1/auth/google/status', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data: AuthStatus = await response.json();
          setGoogleAuthenticated(data.authenticated);
        } else {
          setGoogleAuthenticated(false);
        }
      } else {
        setGoogleAuthenticated(false);
      }
    } catch (error) {
      console.error("Error fetching auth status:", error);
      setUser(null);
      setGoogleAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Listen for changes in Supabase auth state (e.g., login, logout)
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      fetchStatus(); // Re-check Google status when Supabase auth changes
    });

    fetchStatus(); // Initial fetch

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchStatus]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setGoogleAuthenticated(false);
  }, []);

  return {
    user, // The full Supabase user object (includes id, email, etc.)
    isAuthenticated: !!user, // True if user object is not null
    isGoogleAuthenticated: googleAuthenticated,
    isLoading,
    logout,
    fetchStatus
  };
}; 
