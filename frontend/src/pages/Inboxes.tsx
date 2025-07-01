import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import InteractionArea from "@/components/ai/InteractionArea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  MailOpen, 
  Star, 
  Archive, 
  Trash2, 
  Reply, 
  Forward, 
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  LogOut,
  User
} from "lucide-react";

interface EmailSender {
  name?: string;
  email: string;
}

interface EmailMessage {
  id: string;
  thread_id: string;
  subject: string;
  sender: EmailSender;
  recipients: EmailSender[];
  body_plain?: string;
  body_html?: string;
  date: string;
  is_read: boolean;
  is_important: boolean;
  labels: string[];
  snippet?: string;
}

interface EmailListResponse {
  emails: EmailMessage[];
  total_count: number;
  next_page_token?: string;
}

const Inboxes = () => {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'not_authenticated'>('checking');
  const [isListening, setIsListening] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const { toast } = useToast();

  // Check Gmail authentication status
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load emails when authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadEmails();
    }
  }, [authStatus, showUnreadOnly, searchQuery]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/v1/gmail/auth-status');
      const data = await response.json();
      setAuthStatus(data.authenticated ? 'authenticated' : 'not_authenticated');
      
      if (!data.authenticated) {
        toast({
          title: "Gmail Authentication Required",
          description: "Please set up Gmail authentication to access your emails.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus('not_authenticated');
    }
  };

  const handleSwitchAccount = async () => {
    try {
      // Sign out from current account
      const response = await fetch('/api/v1/gmail/sign-out', { method: 'POST' });
      
      if (response.ok) {
        // Clear current data
        setEmails([]);
        setSelectedEmail(null);
        setAuthStatus('not_authenticated');
        
        toast({
          title: "Signed Out",
          description: "Click 'Setup Gmail Access' to sign in with a different account."
        });
      }
    } catch (error) {
      console.error('Error switching account:', error);
      toast({
        title: "Error",
        description: "Failed to switch account",
        variant: "destructive"
      });
    }
  };

  const loadEmails = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        count: '30',
        minimal: 'true',
        unread_only: showUnreadOnly.toString(),
        query: searchQuery
      });

      const response = await fetch(`/api/v1/gmail/emails?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load emails');
      }

      const data: EmailListResponse = await response.json();
      setEmails(data.emails);
    } catch (error) {
      console.error('Error loading emails:', error);
      toast({
        title: "Error Loading Emails",
        description: "Failed to load emails. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = async (email: EmailMessage) => {
    setSelectedEmail(email);

    // fetch full body if not present
    if (!email.body_plain && !email.body_html) {
      try {
        const res = await fetch(`/api/v1/gmail/message/${email.id}`);
        if (res.ok) {
          const full: EmailMessage = await res.json();
          setSelectedEmail(full);
          setEmails(prev => prev.map(e => e.id === email.id ? full : e));
        }
      } catch (err) {
        console.error('Error fetching full email', err);
      }
    }

    // Mark as read if it's unread
    if (!email.is_read) {
      try {
        await fetch(`/api/v1/gmail/mark-read/${email.id}`, { method: 'POST' });
        setEmails(prev => 
          prev.map(e => e.id === email.id ? { ...e, is_read: true } : e)
        );
      } catch (error) {
        console.error('Error marking email as read:', error);
      }
    }
  };

  const handleVoiceCommand = async (command: string) => {
    try {
      const response = await fetch('/api/v1/gmail/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      const result = await response.json();
      
      toast({
        title: "Voice Command Processed",
        description: result.response
      });

      // Refresh emails if the command was to read emails
      if (result.command_type === 'read_emails' || result.command_type === 'read_unread') {
        if (result.data && result.data.emails) {
          setEmails(result.data.emails);
        }
      }
    } catch (error) {
      console.error('Error processing voice command:', error);
      toast({
        title: "Error",
        description: "Failed to process voice command",
        variant: "destructive"
      });
    }
  };

  const handleToggleListening = () => {
    setIsListening(prev => !prev);
    if (!isListening) {
      toast({
        title: "Voice Recognition Active",
        description: "Say a command like 'Read my emails' or 'Send email to john@example.com'"
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays <= 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getSenderDisplay = (sender: EmailSender) => {
    return sender.name || sender.email.split('@')[0];
  };

  const unreadCount = emails.filter(email => !email.is_read).length;

  if (authStatus === 'checking') {
    return (
      <Layout>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-violet" />
              <p className="text-foreground/70">Checking Gmail authentication...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (authStatus === 'not_authenticated') {
    return (
      <Layout>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center flex-1">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <CardTitle>Gmail Authentication Required</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-foreground/70">
                  To access your emails, you need to authenticate with Gmail first.
                </p>
                <Button onClick={checkAuthStatus} className="w-full">
                  <Mail className="h-4 w-4 mr-2" />
                  Setup Gmail Access
                </Button>
                <p className="text-sm text-foreground/50">
                  This will redirect you to Google's secure authentication page.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-violet" />
              <h1 className="text-2xl font-bold">Inbox</h1>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-violet/20 text-violet">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showUnreadOnly ? 'All' : 'Unread'}
              </Button>
              <Button variant="outline" size="sm" onClick={loadEmails}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSwitchAccount}
                className="text-orange-400 border-orange-400/50 hover:bg-orange-400/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Switch Account
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground/50" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-secondary border border-white/10 rounded-lg focus:outline-none focus:border-violet/50"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email List */}
          <div className="w-1/3 border-r border-white/10 flex flex-col">
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              ) : emails.length === 0 ? (
                <div className="p-6 text-center">
                  <Mail className="h-12 w-12 mx-auto mb-4 text-foreground/30" />
                  <p className="text-foreground/70">No emails found</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => handleEmailClick(email)}
                      className={`p-4 cursor-pointer transition-colors hover:bg-white/5 ${
                        selectedEmail?.id === email.id ? 'bg-violet/10' : ''
                      } ${!email.is_read ? 'bg-blue/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {email.is_read ? (
                            <MailOpen className="h-4 w-4 text-foreground/50" />
                          ) : (
                            <Mail className="h-4 w-4 text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm truncate ${!email.is_read ? 'font-semibold' : ''}`}>
                              {getSenderDisplay(email.sender)}
                            </p>
                            <span className="text-xs text-foreground/50 flex-shrink-0 ml-2">
                              {formatDate(email.date)}
                            </span>
                          </div>
                          <p className={`text-sm mb-1 truncate ${!email.is_read ? 'font-medium' : 'text-foreground/70'}`}>
                            {email.subject}
                          </p>
                          <p className="text-xs text-foreground/50 line-clamp-2">
                            {email.snippet}
                          </p>
                          {email.is_important && (
                            <Star className="h-3 w-3 text-yellow-500 mt-1" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Email Content */}
          <div className="flex-1 flex flex-col">
            {selectedEmail ? (
              <>
                {/* Email Header */}
                <div className="flex-shrink-0 p-6 border-b border-white/10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-semibold mb-2">{selectedEmail.subject}</h2>
                      <div className="flex items-center gap-2 text-sm text-foreground/70">
                        <span className="font-medium">{getSenderDisplay(selectedEmail.sender)}</span>
                        <span>&lt;{selectedEmail.sender.email}&gt;</span>
                        <span>•</span>
                        <span>{new Date(selectedEmail.date).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="outline" size="sm">
                        <Reply className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                      <Button variant="outline" size="sm">
                        <Forward className="h-4 w-4 mr-2" />
                        Forward
                      </Button>
                      <Button variant="outline" size="sm">
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Email Body */}
                <ScrollArea className="flex-1 p-6">
                  <div className="prose prose-invert max-w-none">
                    {selectedEmail.body_html ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans">
                        {selectedEmail.body_plain || selectedEmail.snippet}
                      </pre>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-foreground/50">
                  <Mail className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>Select an email to read</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Voice Interaction */}
        <div className="flex-shrink-0 border-t border-white/10">
          <InteractionArea
            onSendMessage={handleVoiceCommand}
            onToggleListening={handleToggleListening}
            isListening={isListening}
          />
        </div>
      </div>
    </Layout>
  );
};

export default Inboxes;