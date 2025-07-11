import { useState, useEffect, useCallback } from 'react';

interface AuthStatus {
  authenticated: boolean;
  message: string;
}

export const useAuth = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/auth/google/status');
      if (response.ok) {
        const data = await response.json();
        setAuthStatus(data);
      } else {
        setAuthStatus({ authenticated: false, message: 'Failed to fetch status' });
      }
    } catch (error) {
      setAuthStatus({ authenticated: false, message: 'Could not connect to server' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
        await fetch('/api/v1/auth/google/disconnect', { method: 'POST' });
        // After successful disconnect, refetch status to update UI
        await fetchStatus();
      } catch (error) {
        console.error("Failed to disconnect", error);
        // Handle logout error in UI if necessary
      }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    isAuthenticated: authStatus?.authenticated ?? false,
    isLoading,
    logout,
    fetchStatus // Exposing this allows components to manually refetch
  };
}; 
 
 
 
 
 
 
 
 
 
 