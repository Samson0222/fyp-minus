import React, { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/Sidebar";
import ChatSidebar from "@/components/layout/ChatSidebar";
import ContentHeader from "@/components/layout/ContentHeader";
import MobileTopNav from "@/components/layout/MobileTopNav";
import MobileSidebar from "@/components/layout/MobileSidebar";
import { toast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

// Voice command callback interface
interface VoiceCommandCallbacks {
  onUnreadFilter?: () => void;
  onRefreshEmails?: () => void;
  onComposeEmail?: () => void;
  onMarkAsUnread?: (emailId?: string) => void;
  onSearchEmails?: (query: string) => void;
  onClearFilters?: () => void;
  onReplyEmail?: () => void;
  onForwardEmail?: (recipient?: string) => void;
}

interface LayoutProps {
  children: React.ReactNode;
  onComposeEmail?: () => void;
  voiceCommandCallbacks?: VoiceCommandCallbacks;
}

const Layout: React.FC<LayoutProps> = ({ children, onComposeEmail, voiceCommandCallbacks }) => {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMenuClick = () => {
    setIsMobileSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  const handleToggleListening = () => {
    setIsListening(!isListening);
  };

  const handleSendMessage = async (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Set processing state
    setIsProcessing(true);

    try {
      // Check for compose email commands first
      const lowerText = text.toLowerCase();
      if ((lowerText.includes('compose') && lowerText.includes('email')) || 
          lowerText.includes('write email') || 
          lowerText.includes('new email') ||
          lowerText.includes('send email to')) {
        
        if (onComposeEmail) {
          onComposeEmail();
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: "Opening email composer for you!",
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          setIsProcessing(false);
          return;
        } else {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: "Email composition is available on the Inboxes page. Navigate there to compose emails.",
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          setIsProcessing(false);
          return;
        }
      }

      try {
        // First try Gmail voice command processing
        const voiceRes = await fetch('/api/v1/gmail/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: text })
        });

        if (voiceRes.ok) {
          const voiceData = await voiceRes.json();
          console.log('Voice command result:', voiceData);
          
          // Handle frontend actions based on command type
          if (voiceData.command_type && voiceCommandCallbacks) {
            switch (voiceData.command_type) {
              case 'read_unread':
                if (voiceCommandCallbacks.onUnreadFilter) {
                  voiceCommandCallbacks.onUnreadFilter();
                }
                break;
              case 'refresh_emails':
                if (voiceCommandCallbacks.onRefreshEmails) {
                  voiceCommandCallbacks.onRefreshEmails();
                }
                break;
              case 'send_email':
              case 'send_email_simple':
                if (voiceCommandCallbacks.onComposeEmail) {
                  voiceCommandCallbacks.onComposeEmail();
                }
                break;
              case 'search_emails':
                if (voiceCommandCallbacks.onSearchEmails && voiceData.parsed_parameters?.query) {
                  voiceCommandCallbacks.onSearchEmails(voiceData.parsed_parameters.query);
                }
                break;
              case 'mark_as_unread':
                if (voiceCommandCallbacks.onMarkAsUnread) {
                  voiceCommandCallbacks.onMarkAsUnread();
                }
                break;
              case 'reply_email':
                if (voiceCommandCallbacks.onReplyEmail) {
                  voiceCommandCallbacks.onReplyEmail();
                }
                break;
              case 'forward_email':
                if (voiceCommandCallbacks.onForwardEmail) {
                  const recipient = voiceData.parsed_parameters?.recipient;
                  voiceCommandCallbacks.onForwardEmail(recipient);
                }
                break;
            }
          }
          
          if (voiceData.response) {
            const aiMessage: Message = {
              id: (Date.now() + 1).toString(),
              text: voiceData.response,
              sender: "ai",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setIsProcessing(false);
            return; // Exit early if voice command was successful
          }
        }
      } catch (error) {
        console.error('Voice command error:', error);
      }

      try {
        // Fallback to general chat API
        const chatRes = await fetch('/api/v1/chat/text-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            context: 'chat',
            platform_context: {
              timestamp: new Date().toISOString(),
              interface: 'chat_sidebar',
            },
          })
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: chatData.reply || "I understand your message, but I'm not sure how to respond to that right now.",
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
        } else {
          throw new Error('Chat API failed');
        }
      } catch (error) {
        console.error('Chat API error:', error);
        
        // Final fallback - provide a helpful response
        const fallbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: getDefaultResponse(text),
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, fallbackMessage]);
      }
    } catch (error) {
      console.error('Message processing error:', error);
      toast({
        title: 'Processing Error',
        description: 'There was an error processing your message. Please try again.',
        variant: 'destructive'
      });
    } finally {
      // Always turn off processing state
      setIsProcessing(false);
    }
  };

  const getDefaultResponse = (text: string): string => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('email') || lowerText.includes('gmail') || lowerText.includes('mail')) {
      return "I can help you with Gmail! Try commands like 'read my emails', 'compose email', or navigate to the Inboxes page for full email functionality.";
    }
    
    if (lowerText.includes('task') || lowerText.includes('todo')) {
      return "I can help you manage tasks! You can create, view, and organize your tasks through the Tasks page.";
    }
    
    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('help')) {
      return "Hello! I'm your AI assistant. I can help you with Gmail management, tasks, and more. Try asking me to 'compose email' or 'read emails'.";
    }
    
    return "I understand your message. I'm here to help with Gmail, tasks, and other productivity features. Try asking me about emails or tasks!";
  };

  const handleToggleChatSidebar = () => {
    setIsChatSidebarCollapsed(!isChatSidebarCollapsed);
  };

  return (
    <div className="flex h-screen w-full bg-gradient-main overflow-hidden">
      {!isMobile && <Sidebar />}
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {isMobile && <MobileTopNav onMenuClick={handleMenuClick} />}
        {!isMobile && <ContentHeader />}
        
        <div className="w-full flex-1 flex flex-col h-full overflow-hidden">
          {children}
        </div>
      </main>
      
      {!isMobile && (
        <ChatSidebar 
          onSendMessage={handleSendMessage}
          onToggleListening={handleToggleListening}
          isListening={isListening}
          messages={messages}
          isCollapsed={isChatSidebarCollapsed}
          onToggleCollapse={handleToggleChatSidebar}
          isProcessing={isProcessing}
        />
      )}
      
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={handleCloseSidebar}
        />
      )}
    </div>
  );
};

export default Layout;
