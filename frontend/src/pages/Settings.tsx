import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle, Mail, Calendar, FileText, ExternalLink, LogOut } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import TelegramSettings from '@/components/telegram/TelegramSettings';

interface AuthStatus {
  authenticated: boolean;
  message: string;
}

const Settings = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check for auth success/error from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    if (authResult === 'success') {
      toast({
        title: "Google Account Connected!",
        description: "Successfully authenticated. All services should now be active.",
      });
      // Use history.replaceState to clean the URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authResult === 'error') {
      toast({
        title: "Authentication Failed",
        description: "Could not connect to Google. Please try again.",
        variant: 'destructive',
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Fetch initial status
    fetchStatus();
  }, [toast]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/google/status');
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error("Failed to fetch auth status", error);
      setAuthStatus({ authenticated: false, message: 'Could not fetch connection status.' });
      toast({ title: "Error", description: "Could not fetch connection status.", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/v1/auth/google/login';
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/v1/auth/google/disconnect', { method: 'POST' });
      toast({ title: "Disconnected", description: "Successfully disconnected from Google." });
      // Refetch status to update the UI
      fetchStatus();
    } catch (error) {
      toast({ title: "Error", description: "Failed to disconnect.", variant: 'destructive' });
    }
  };

  const ServiceStatus = ({ serviceName, icon, isConnected }: { serviceName: string, icon: React.ReactNode, isConnected: boolean }) => (
    <div className="flex items-center justify-between p-4 bg-dark-tertiary rounded-lg">
      <div className="flex items-center gap-4">
        {icon}
        <span className="text-white font-medium">{serviceName}</span>
      </div>
      {isConnected ? (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle size={16} />
          <span>Connected</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={16} />
          <span>Disconnected</span>
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="p-6 h-full space-y-8">
        <Card className="max-w-3xl mx-auto bg-dark-secondary border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Google Integration</CardTitle>
            <CardDescription className="text-white/70">
              Manage your connection to Google services like Gmail, Calendar, and Docs. A single connection powers all services.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full bg-white/10" />
                <Skeleton className="h-10 w-48 bg-white/10" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <ServiceStatus serviceName="Google Services (Gmail, Calendar, Docs)" icon={<Mail className="text-white/80" />} isConnected={authStatus?.authenticated ?? false} />
                </div>
                <div>
                  {authStatus?.authenticated ? (
                    <Button onClick={handleDisconnect} variant="destructive">
                      <LogOut size={16} className="mr-2" />
                      Disconnect Google Account
                    </Button>
                  ) : (
                    <Button onClick={handleConnect} className="bg-violet hover:bg-violet-light">
                      <ExternalLink size={16} className="mr-2" />
                      Connect to Google
                    </Button>
                  )}
                  <p className="text-xs text-white/50 mt-2">{authStatus?.message}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="max-w-3xl mx-auto">
          <TelegramSettings />
        </div>
      </div>
    </Layout>
  );
};

export default Settings; 