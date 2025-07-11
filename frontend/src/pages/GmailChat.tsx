import React, { useState } from "react";
import ChatSidebar from "@/components/layout/ChatSidebar";
import { toast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

// Voice command callback interface for Gmail-specific actions
interface VoiceCommandCallbacks {
  onUnreadFilter?: () => void;
  onRefreshEmails?: () => void;
  onComposeEmail?: () => void;
  onMarkAsUnread?: (emailId?: string) => void;
  onSearchEmails?: (query: string) => void;
  onClearFilters?: () => void;
  onReplyEmail?: () => void;
  onForwardEmail?: (recipient?: string) => void;
  onStarEmail?: () => void;
  onMarkImportant?: () => void;
}

interface GmailChatProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onComposeEmail?: () => void;
  voiceCommandCallbacks?: VoiceCommandCallbacks;
}

const GmailChat: React.FC<GmailChatProps> = ({
  isCollapsed,
  onToggleCollapse,
  onComposeEmail,
  voiceCommandCallbacks
}) => {
  // State management for the Gmail chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  // Handle sending messages (both text and voice)
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
          console.log('Gmail voice command result:', voiceData);
          
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
              case 'star_email':
                if (voiceCommandCallbacks.onStarEmail) {
                  voiceCommandCallbacks.onStarEmail();
                }
                break;
              case 'mark_important':
                if (voiceCommandCallbacks.onMarkImportant) {
                  voiceCommandCallbacks.onMarkImportant();
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
        console.error('Gmail voice command error:', error);
      }

      try {
        // Fallback to general chat API
        const chatRes = await fetch('/api/v1/chat/text-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            context: 'gmail_chat',
            platform_context: {
              timestamp: new Date().toISOString(),
              interface: 'gmail_chat_sidebar',
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
        
        // Final fallback - provide a helpful Gmail-specific response
        const fallbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: getGmailDefaultResponse(text),
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, fallbackMessage]);
      }
    } catch (error) {
      console.error('Gmail message processing error:', error);
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

  // Handle voice commands with transcription and Gmail-specific processing
  const handleVoiceCommand = async (transcribedText: string) => {
    console.log('[GMAIL CHAT] Processing voice command:', transcribedText);
    
    // Show voice processing state
    setIsVoiceProcessing(true);
    
    try {
      // Send transcribed text to Gmail voice command processor
      const voiceRes = await fetch('/api/v1/gmail/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: transcribedText })
      });
      
      if (voiceRes.ok) {
        const voiceData = await voiceRes.json();
        console.log('[GMAIL CHAT] Gmail voice command result:', voiceData);
        
        // Hide voice processing state
        setIsVoiceProcessing(false);
        
        // Handle voice command callbacks
        if (voiceData.command_type && voiceCommandCallbacks) {
          // Same switch logic as above but for voice commands
          switch (voiceData.command_type) {
            case 'read_unread':
              voiceCommandCallbacks.onUnreadFilter?.();
              break;
            case 'refresh_emails':
              voiceCommandCallbacks.onRefreshEmails?.();
              break;
            case 'send_email':
            case 'send_email_simple':
              voiceCommandCallbacks.onComposeEmail?.();
              break;
            case 'search_emails':
              if (voiceData.parsed_parameters?.query) {
                voiceCommandCallbacks.onSearchEmails?.(voiceData.parsed_parameters.query);
              }
              break;
            case 'mark_as_unread':
              voiceCommandCallbacks.onMarkAsUnread?.();
              break;
            case 'reply_email':
              voiceCommandCallbacks.onReplyEmail?.();
              break;
            case 'forward_email':
              voiceCommandCallbacks.onForwardEmail?.(voiceData.parsed_parameters?.recipient);
              break;
            case 'star_email':
              voiceCommandCallbacks.onStarEmail?.();
              break;
            case 'mark_important':
              voiceCommandCallbacks.onMarkImportant?.();
              break;
          }
        }
        
        // Show the AI response
        if (voiceData.response) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: voiceData.response,
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          
          toast({ 
            title: 'Gmail Voice Command Processed', 
            description: voiceData.response,
            duration: 5000
          });
        }
      } else {
        throw new Error('Gmail voice command failed');
      }
    } catch (voiceErr) {
      console.error('[GMAIL CHAT] Gmail voice command error:', voiceErr);
      setIsVoiceProcessing(false);
      toast({
        title: 'Gmail Voice Command Error',
        description: 'Failed to process Gmail voice command, but transcription was successful.',
        variant: 'destructive'
      });
    }
  };

  // Generic command handler that processes both text and voice
  const handleCommand = async (command: string, isVoice: boolean = false) => {
    if (isVoice) {
      // Add the transcribed text as a user message first
      const userMessage: Message = {
        id: Date.now().toString(),
        text: command,
        sender: "user",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      
      // Then process as voice command
      await handleVoiceCommand(command);
    } else {
      await handleSendMessage(command);
    }
  };

  const handleToggleListening = () => {
    setIsListening(!isListening);
  };

  // Gmail-specific default responses
  const getGmailDefaultResponse = (text: string): string => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('email') || lowerText.includes('gmail') || lowerText.includes('mail')) {
      return "I can help you with Gmail! Try commands like 'read my emails', 'compose email', 'search for emails from John', or 'mark as important'.";
    }
    
    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('help')) {
      return "Hello! I'm your Gmail assistant. I can help you read emails, compose messages, search your inbox, and manage your messages. What would you like to do?";
    }
    
    return "I'm here to help with Gmail management. Try asking me to 'read unread emails', 'compose email', or 'search emails'. What Gmail task can I help you with?";
  };

  return (
    <ChatSidebar 
      onCommand={handleCommand}
      onToggleListening={handleToggleListening}
      isListening={isListening}
      messages={messages}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      isProcessing={isProcessing || isVoiceProcessing}
      title="Gmail Assistant"
      placeholder="Ask me about your emails..."
      emptyStateMessage="Ready to help with Gmail! Try saying 'read my emails' or 'compose email'."
    />
  );
};

export default GmailChat; 