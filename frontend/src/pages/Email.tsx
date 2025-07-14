import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import ComposeEmailModal from "@/components/email/ComposeEmailModal";
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
  User,
  Edit,
  X,
  ChevronDown,
  Check
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UnauthorizedPage from "@/components/layout/UnauthorizedPage";

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

const Email = () => {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'not_authenticated'>('checking');
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showSentOnly, setShowSentOnly] = useState(false);
  const [showImportantOnly, setShowImportantOnly] = useState(false);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { toast } = useToast();

  // Check Gmail authentication status
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load emails when authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadEmails(true); // Initial load with loading state
    }
  }, [authStatus, showUnreadOnly, showSentOnly, showImportantOnly]);

  // Debounced search effect - triggers 500ms after user stops typing
  useEffect(() => {
    if (authStatus === 'authenticated') {
      const debounceTimer = setTimeout(() => {
        loadEmails(true); // Search with loading state
      }, 500);

      return () => clearTimeout(debounceTimer);
    }
  }, [searchQuery, authStatus]);

  // Smart auto-refresh only when tab is active and less frequent
  useEffect(() => {
    if (authStatus === 'authenticated') {
      let refreshInterval: NodeJS.Timeout;
      
      const handleVisibilityChange = () => {
        // Clear existing interval
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
        
                // Only set up auto-refresh when tab is visible
        if (!document.hidden) {
          console.log('Tab is active - setting up smart refresh...');
          refreshInterval = setInterval(() => {
            console.log('Smart auto-refresh (tab active)...');
            refreshEmails(); // Background refresh without loading state
          }, 300000); // 5 minutes instead of 30 seconds
        }
      };
      
      // Set up initial interval and visibility listener
      handleVisibilityChange();
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        clearInterval(refreshInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
      }, [authStatus, showUnreadOnly, showSentOnly, showImportantOnly, searchQuery]); // Re-setup interval when filters change

  // Keyboard shortcuts for refresh
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (authStatus === 'authenticated') {
        // Ctrl+R or F5 for refresh
        if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
          event.preventDefault(); // Prevent browser refresh
          manualRefresh();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authStatus]); // Only depends on authStatus

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

  const loadEmails = async (showLoader: boolean = true) => {
    try {
      const previousEmailCount = emails.length;
      
      if (showLoader) {
        setLoading(true);
      } else {
        setBackgroundRefreshing(true);
      }
      
      const params = new URLSearchParams({
        count: '15', // Reduced from 30 to 15 for faster loading
        minimal: 'true',
        unread_only: showUnreadOnly.toString(),
        sent_only: showSentOnly.toString(),
        query: searchQuery.trim()
      });

      console.log('Loading emails with params:', Object.fromEntries(params));
      
      const response = await fetch(`/api/v1/gmail/emails?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load emails');
      }

      const data: EmailListResponse = await response.json();
      console.log(`Search results: ${data.emails.length} emails found for query: "${searchQuery.trim()}"`);
      
      // Apply client-side filtering for important emails
      let filteredEmails = data.emails;
      if (showImportantOnly) {
        filteredEmails = data.emails.filter(email => email.is_important);
      }
      
      const newEmailCount = filteredEmails.length;
      const isBackgroundRefresh = !showLoader && previousEmailCount > 0;
      
      setEmails(filteredEmails);
      setLastRefresh(new Date());
      
      // Check for new emails during background refresh
      if (isBackgroundRefresh && newEmailCount > previousEmailCount) {
        const newEmailsFound = newEmailCount - previousEmailCount;
        toast({
          title: "📧 New Email" + (newEmailsFound > 1 ? "s" : ""),
          description: `${newEmailsFound} new email${newEmailsFound > 1 ? 's' : ''} received!`,
          variant: "default",
          duration: 4000
        });
      }
      
      // Show search feedback only when there's actually a search query or filters applied
      if ((searchQuery.trim() || showImportantOnly) && filteredEmails.length === 0) {
        const filterDescription = showImportantOnly ? "important emails" : "emails";
        const searchDescription = searchQuery.trim() ? ` for "${searchQuery.trim()}"` : "";
        toast({
          title: "No Results Found",
          description: `No ${filterDescription} found${searchDescription}. Try different search terms or filters.`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error loading emails:', error);
      if (showLoader) { // Only show error toast for initial loads, not background refreshes
        toast({
          title: "Error Loading Emails",
          description: "Failed to load emails. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      } else {
        setBackgroundRefreshing(false);
      }
    }
  };

  const refreshEmails = async () => {
    await loadEmails(false); // Background refresh without loading state
  };

  const manualRefresh = async () => {
    await loadEmails(true); // Manual refresh with loading feedback
    toast({
      title: "Refreshed",
      description: "Inbox updated with latest emails.",
      variant: "default"
    });
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

  const handleMarkAsUnread = async (emailId: string) => {
    try {
      const response = await fetch(`/api/v1/gmail/mark-unread/${emailId}`, { 
        method: 'POST' 
      });
      
      if (response.ok) {
        // Update the email in both the list and selected email
        setEmails(prev => 
          prev.map(e => e.id === emailId ? { ...e, is_read: false } : e)
        );
        
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail(prev => prev ? { ...prev, is_read: false } : null);
        }

        toast({
          title: "Marked as Unread",
          description: "Email has been marked as unread."
        });
      } else {
        throw new Error('Failed to mark as unread');
      }
    } catch (error) {
      console.error('Error marking email as unread:', error);
      toast({
        title: "Error",
        description: "Failed to mark email as unread.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Convert both to Malaysia timezone for comparison
    const malaysiaOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kuala_Lumpur'
    };
    
    const emailDate = new Date(date.toLocaleString('en-US', malaysiaOptions));
    const currentDate = new Date(now.toLocaleString('en-US', malaysiaOptions));
    
    const diffInMs = currentDate.getTime() - emailDate.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    // Check if it's today
    const isToday = emailDate.toDateString() === currentDate.toDateString();
    
    // Check if it's yesterday
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = emailDate.toDateString() === yesterday.toDateString();

    if (isToday) {
      // Show time for today's emails (e.g., "1:33 PM")
      return date.toLocaleTimeString('en-MY', { 
        timeZone: 'Asia/Kuala_Lumpur',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      });
    } else if (isYesterday) {
      // Show time for yesterday's emails (e.g., "Yesterday 2:15 PM")
      return 'Yesterday ' + date.toLocaleTimeString('en-MY', { 
        timeZone: 'Asia/Kuala_Lumpur',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      });
    } else if (diffInDays < 7) {
      // Show day and time for this week (e.g., "Mon 10:30 AM")
      return date.toLocaleDateString('en-MY', { 
        timeZone: 'Asia/Kuala_Lumpur',
        weekday: 'short' 
      }) + ' ' + date.toLocaleTimeString('en-MY', { 
        timeZone: 'Asia/Kuala_Lumpur',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      });
    } else if (diffInDays < 365) {
      // Show date for this year (e.g., "Jan 15")
      return date.toLocaleDateString('en-MY', { 
        timeZone: 'Asia/Kuala_Lumpur',
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      // Show date with year for older emails (e.g., "Jan 15, '23")
      return date.toLocaleDateString('en-MY', { 
        timeZone: 'Asia/Kuala_Lumpur',
        year: '2-digit', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const getSenderDisplay = (sender: EmailSender) => {
    return sender.name || sender.email.split('@')[0];
  };

  const unreadCount = emails.filter(email => !email.is_read).length;

  // Helper functions for filter management
  const getActiveFilters = () => {
    const filters = [];
    if (showUnreadOnly) filters.push('Unread');
    if (showSentOnly) filters.push('Sent');
    if (showImportantOnly) filters.push('Important');
    return filters;
  };

  const clearAllFilters = () => {
    setShowUnreadOnly(false);
    setShowSentOnly(false);
    setShowImportantOnly(false);
  };

  const getFilterButtonText = () => {
    const activeFilters = getActiveFilters();
    if (activeFilters.length === 0) return 'All Emails';
    if (activeFilters.length === 1) return activeFilters[0];
    return `${activeFilters.length} Filters`;
  };

  // Add handler for when email is sent
  const handleEmailSent = () => {
    // Refresh the email list to include the sent email if it shows up in inbox
    refreshEmails(); // Use background refresh for faster experience
    toast({
      title: "Email Sent",
      description: "Your email has been sent successfully!"
    });
  };

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
          <UnauthorizedPage serviceName="Gmail" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="flex-1 flex overflow-hidden">
          {/* Email List */}
          <div className="min-w-[320px] max-w-[400px] flex-shrink-0 border-r border-white/10 flex flex-col">
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
                      className={`p-4 h-[88px] cursor-pointer transition-colors hover:bg-white/5 ${
                        selectedEmail?.id === email.id ? 'bg-violet/10' : ''
                      } ${!email.is_read ? 'bg-blue/5' : ''}`}
                    >
                      <div className="flex items-start gap-3 h-full">
                        <div className="flex-shrink-0 mt-1">
                          {email.is_read ? (
                            <MailOpen className="h-4 w-4 text-foreground/50" />
                          ) : (
                            <Mail className="h-4 w-4 text-violet" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                          {/* Row 1: Sender and Timestamp */}
                          <div className="flex items-start justify-between mb-1">
                            <p className={`text-sm truncate flex-1 mr-2 ${!email.is_read ? 'font-semibold' : ''}`}>
                              {getSenderDisplay(email.sender)}
                            </p>
                            <span className="text-xs text-foreground/50 flex-shrink-0 min-w-[70px] text-right">
                              {formatDate(email.date)}
                            </span>
                          </div>
                          {/* Row 2: Subject (full line, no truncation) */}
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm flex-1 mr-2 ${!email.is_read ? 'font-medium' : 'text-foreground/70'}`}>
                              {email.subject}
                            </p>
                            {email.is_important && (
                              <Star className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                            )}
                          </div>
                          {/* Row 3: Snippet (can be truncated) */}
                          <div className="flex items-end">
                            <p className="text-xs text-foreground/50 line-clamp-1 flex-1">
                              {email.snippet}
                            </p>
                          </div>
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
                  {/* Email Title */}
                  <div className="mb-3">
                    <h2 className="text-xl font-semibold mb-2">{selectedEmail.subject}</h2>
                  </div>
                  
                  {/* Sender Info */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm text-foreground/70 mb-1">
                      <span className="font-medium text-foreground">{getSenderDisplay(selectedEmail.sender)}</span>
                      <span className="text-foreground/50">({selectedEmail.sender.email})</span>
                    </div>
                    <div className="text-xs text-foreground/50">
                      {new Date(selectedEmail.date).toLocaleDateString('en-MY', { 
                        timeZone: 'Asia/Kuala_Lumpur',
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                    <Button variant="outline" size="sm">
                      <Forward className="h-4 w-4 mr-2" />
                      Forward
                    </Button>
                    {selectedEmail.is_read && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleMarkAsUnread(selectedEmail.id)}
                      >
                        <MailOpen className="h-4 w-4 mr-2" />
                        Mark Unread
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
      </div>

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={isComposeModalOpen}
        onOpenChange={setIsComposeModalOpen}
        onEmailSent={handleEmailSent}
      />
    </Layout>
  );
};

export default Email; 