import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, MessageSquare, Send, ExternalLink, Users, User, Hash, Search, ChevronDown, Check, MailX, MoreHorizontal, Trash2 } from 'lucide-react';
import { format, utcToZonedTime } from 'date-fns-tz';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { TelegramDraft } from '../layout/GeneralPurposeChatWrapper';

// Interfaces
interface TelegramMessage {
  id: string | number;
  message_id: number;
  sender_name: string;
  telegram_sender_id: number;
  content: string;
  message_type: string;
  timestamp: string;
  is_read: boolean;
  sending?: boolean;
  error?: boolean;
}

interface ChatSummary {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  unread_count: number;
  latest_message: string;
  latest_sender: string;
  latest_timestamp: string;
}

interface ActiveChat {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  username?: string;
  members_count?: number;
}

interface TelegramFocusModeProps {
  isOpen: boolean;
  onClose: () => void;
  unreadChats: ChatSummary[];
  recentChats: ChatSummary[];
  loading: boolean;
  onRefresh: () => void;
  draft: TelegramDraft | null;
  clearDraft: () => void;
}

// Helper Functions & Components
const getChatTypeIcon = (chatType: string, size: number = 14) => {
    const className = "text-violet";
    switch (chatType) {
      case 'group':
      case 'supergroup':
        return <Users className={className} size={size} />;
      case 'channel':
        return <Hash className={className} size={size} />;
      default:
        return <User className={className} size={size} />;
    }
};

const formatTimestamp = (timestamp: string) => {
    try {
        const date = new Date(timestamp);
        const timeZone = 'Asia/Kuala_Lumpur';

        // Convert the UTC date from the server and the current browser time to the target timezone
        const zonedDate = utcToZonedTime(date, timeZone);
        const zonedNow = utcToZonedTime(new Date(), timeZone);
        
        // Compare the dates (day, month, year)
        const isSameDay = zonedDate.getFullYear() === zonedNow.getFullYear() &&
                        zonedDate.getMonth() === zonedNow.getMonth() &&
                        zonedDate.getDate() === zonedNow.getDate();

        if (isSameDay) {
          // It's today, show only time in 24h format
          return format(zonedDate, 'HH:mm', { timeZone });
        } else {
          // It's not today, show date and time
          return format(zonedDate, 'dd/MM/yyyy, HH:mm', { timeZone });
        }
    } catch (error) {
        console.error("Error formatting timestamp:", timestamp, error);
        return "Invalid date";
    }
};


// Main Component
const TelegramFocusMode: React.FC<TelegramFocusModeProps> = ({ 
  isOpen, 
  onClose, 
  unreadChats, 
  recentChats, 
  loading, 
  onRefresh,
  draft,
  clearDraft
}) => {
  // State
  const [activeSearchChats, setActiveSearchChats] = useState<ActiveChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSummary | ActiveChat | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [replyText, setReplyText] = useState('');

  // Loading & UI state
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [isSearchFocused, setSearchFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Effects
  useEffect(() => {
    if (draft && selectedChat && draft.chat_id === selectedChat.chat_id) {
      setReplyText(draft.body);
      clearDraft(); // Clear the draft from the parent once it's been set in the component
    }
  }, [draft, selectedChat, clearDraft]);

  const ChatListItem: React.FC<{
    chat: ChatSummary;
    isSelected: boolean;
    onSelect: () => void;
    listType: 'unread' | 'recent';
  }> = ({ chat, isSelected, onSelect, listType }) => (
      <div
        className={`p-3 rounded-lg cursor-pointer transition-colors relative border ${
          isSelected
            ? 'bg-violet/20 border-violet/40'
            : 'border-transparent hover:bg-white/5'
        }`}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getChatTypeIcon(chat.chat_type)}
            <span className="text-white font-medium text-sm truncate">
              {chat.chat_name}
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/70 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-white" onClick={(e) => { e.stopPropagation(); handleOpenInTelegram(chat); }}>
                <ExternalLink size={14} />
            </Button>
            {listType === 'unread' ? (
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-white" onClick={(e) => { e.stopPropagation(); handleMarkAsRead(chat.chat_id); }}>
                    <Check size={16} />
                </Button>
            ) : (
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-white" onClick={(e) => { e.stopPropagation(); handleMarkAsUnread(chat.chat_id); }}>
                    <MailX size={14} />
                </Button>
            )}
          </div>
        </div>

        <div className="mt-2 text-xs text-white/50">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate min-w-0">
              <span className="font-medium">{chat.latest_sender}:</span>{' '}
              {chat.latest_message || 'No message preview'}
            </span>
            <span className="text-white/60 flex-shrink-0">{formatTimestamp(chat.latest_timestamp)}</span>
          </div>
        </div>
      </div>
  );

  // Effects
  useEffect(() => {
    if (isOpen) {
      fetchAllActiveChats();
    } else {
        // When the focus mode is closed, mark the last viewed chat as read.
        if (selectedChat) {
          const wasUnread = unreadChats.some(c => c.chat_id === selectedChat.chat_id);
          if (wasUnread) {
            handleMarkAsRead(selectedChat.chat_id);
          }
        }
        // Reset state on close
        setSelectedChat(null);
        setMessages([]);
    }
  }, [isOpen]); // Dependency array cleaned up to prevent extra re-renders

  // This effect was causing the search selection bug and has been removed.

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Data Fetching
  const fetchAllActiveChats = async () => {
    try {
      const response = await fetch('/api/v1/telegram/active_chats');
      const data = await response.json();
      if (data.success) {
        setActiveSearchChats(data.chats || []);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load active chats for search.", variant: 'destructive' });
    }
  };

  const handleMarkAsRead = async (chatId: number) => {
    try {
        await fetch(`/api/v1/telegram/conversation/${chatId}/mark_read`, { method: 'POST' });
        // toast({ title: "Success", description: "Chat marked as read." }); // Removed
        onRefresh(); // Refresh lists
    } catch (error) {
        toast({ title: "Error", description: "Failed to mark chat as read.", variant: 'destructive' });
    }
  };

  const handleMarkAsUnread = async (chatId: number) => {
    try {
        await fetch(`/api/v1/telegram/conversation/${chatId}/mark_unread`, { method: 'POST' });
        // toast({ title: "Success", description: "Chat marked as unread." }); // Removed
        if (selectedChat?.chat_id === chatId) {
            setSelectedChat(null); // Deselect if it's the active chat
            setMessages([]);
        }
        onRefresh(); // Refresh lists
    } catch (error) {
        toast({ title: "Error", description: "Failed to mark chat as unread.", variant: 'destructive' });
    }
  };

  const handleOpenInTelegram = (chat: ChatSummary | ActiveChat) => {
    const fullChatInfo = activeSearchChats.find(c => c.chat_id === chat.chat_id);
    const username = fullChatInfo?.username;

    if (username) {
        window.open(`https://t.me/${username}`, '_blank');
    } else if (String(chat.chat_id).startsWith('-')) {
        // For private groups/channels, use the web.telegram.org/k/ format.
        // This is based on user feedback for modern web clients.
        window.open(`https://web.telegram.org/k/#${chat.chat_id}`, '_blank');
    } else {
        toast({
            title: "Cannot Open Chat",
            description: "This chat is likely a direct message that cannot be opened directly via a web link.",
            variant: 'destructive',
        });
    }
  };

  const handleClearHistory = async (chatId: number) => {
    try {
      await fetch(`/api/v1/telegram/conversation/${chatId}/clear_history`, { method: 'POST' });
      onRefresh(); // Refresh lists
      if (selectedChat?.chat_id === chatId) {
        setMessages([]); // Clear messages in the view
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to clear history.", variant: 'destructive' });
    }
  }

  const handleChatSelect = async (chat: ChatSummary | ActiveChat) => {
    // If clicking the same chat again, do nothing.
    if (selectedChat?.chat_id === chat.chat_id) {
      return;
    }

    // If switching FROM a different chat, mark the PREVIOUS one as read.
    if (selectedChat) {
      const wasUnread = unreadChats.some(c => c.chat_id === selectedChat.chat_id);
      if (wasUnread) {
        handleMarkAsRead(selectedChat.chat_id);
      }
    }

    // Now, select the new chat and load its conversation.
    setSearchFocused(false);
    setSearchTerm('');
    setSelectedChat(chat);
    setLoadingConversation(true);
    setMessages([]);

    try {
      const response = await fetch(`/api/v1/telegram/conversation/${chat.chat_id}`);
      const data = await response.json();

      if (data.success) {
        setMessages(data.messages);
        // onRefresh(); // No longer need to refresh here
      } else {
        toast({ title: "Error", description: "Failed to load conversation.", variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load conversation.", variant: 'destructive' });
    } finally {
        setLoadingConversation(false);
    }
  };

  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedChat) return;

    const optimisticId = `temp_${Date.now()}`;
    const optimisticMessage: TelegramMessage = {
        id: optimisticId,
        message_id: 0,
        sender_name: 'You',
        telegram_sender_id: 0, // Placeholder
        content: replyText,
        message_type: 'text',
        timestamp: new Date().toISOString(),
        is_read: true,
        sending: true,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setReplyText(''); // Clear input immediately

    try {
      const response = await fetch(`/api/v1/telegram/conversation/${selectedChat.chat_id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: replyText }),
      });

      const result = await response.json();

      if (result.success) {
        // Optimistic update successful, replace placeholder with real message
        setMessages(prev =>
          prev.map(msg =>
            msg.id === optimisticId ? { ...result.message, id: result.message.message_id } : msg
          )
        );
        onRefresh(); // Refresh summary to get latest message status
      } else {
        // Optimistic update failed
        setMessages(prev => prev.map(msg => msg.id === optimisticId ? { ...msg, error: true } : msg));
        toast({ title: "Error", description: "Failed to send message.", variant: 'destructive' });
      }
    } catch (error) {
      setMessages(prev => prev.map(msg => msg.id === optimisticId ? { ...msg, error: true } : msg));
      toast({ title: "Error", description: "Failed to send message.", variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const filteredSearchChats = useMemo(() => {
      if (!searchTerm) return activeSearchChats;
      return activeSearchChats.filter(chat =>
          chat.chat_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [searchTerm, activeSearchChats]);

  // Render logic
  if (!isOpen) return null;

  const renderConversation = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/60">Loading chats...</div>
        </div>
      );
    }
    if (!selectedChat) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-white/50">
                <MessageSquare size={48} className="mb-4 opacity-50"/>
                <p>Select a conversation to view messages</p>
            </div>
        );
    }
    return (
      <div className="flex-1 flex flex-col bg-dark-secondary h-full">
        {/* Conversation Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            {getChatTypeIcon(selectedChat.chat_type, 18)}
            <span className="font-bold text-lg">{selectedChat.chat_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white">
                  <MoreHorizontal size={20} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 bg-dark-tertiary border-white/20 text-white p-2">
                <Button variant="ghost" className="w-full justify-start" onClick={() => handleOpenInTelegram(selectedChat)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in Telegram
                </Button>
                {unreadChats.some(c => c.chat_id === selectedChat.chat_id) ? (
                    <Button variant="ghost" className="w-full justify-start" onClick={() => handleMarkAsRead(selectedChat.chat_id)}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark as Read
                    </Button>
                ) : (
                    <Button variant="ghost" className="w-full justify-start" onClick={() => handleMarkAsUnread(selectedChat.chat_id)}>
                      <MailX className="mr-2 h-4 w-4" />
                      Mark as Unread
                    </Button>
                )}
                <Button variant="ghost" className="w-full justify-start text-red-500/90 hover:text-red-500" onClick={() => handleClearHistory(selectedChat.chat_id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear History
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Messages Area */}
        {loadingConversation ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-white/60">Loading conversation...</div>
          </div>
        ) : (
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, index) => {
                const isSentByUser = msg.sender_name === 'You';
                return (
                  <div 
                    key={msg.id || index} 
                    className={`flex items-end gap-2 ${isSentByUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`p-3 rounded-lg max-w-xl ${isSentByUser ? 'bg-violet-500 text-white rounded-br-none' : 'bg-dark-tertiary rounded-bl-none'}`}>
                      {!isSentByUser && (
                        <p className="text-sm font-bold text-violet-400 mb-1">{msg.sender_name}</p>
                      )}
                      <p className="text-sm text-white/90 whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${isSentByUser ? 'text-white/70' : 'text-white/50'} text-right`}>
                        {formatTimestamp(msg.timestamp)}
                        {msg.sending && ' (Sending...)'}
                        {msg.error && ' (Failed to send)'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>
        )}

        {/* Reply Box */}
        <div className="p-4 border-t border-white/10">
          <div className="relative">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Message ${selectedChat.chat_name}`}
              className="bg-dark-tertiary pr-12 text-sm"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={sending}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 bg-violet hover:bg-violet/90"
              onClick={handleSendMessage}
              disabled={!replyText.trim() || sending}
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    );
  };
  
  const renderChatList = (chats: ChatSummary[], type: 'unread' | 'recent') => {
    if (loading) {
      return Array.from({ length: type === 'unread' ? 3 : 5 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="h-4 w-1/2 bg-white/10 rounded"></div>
                <div className="h-3 w-1/4 bg-white/10 rounded"></div>
            </div>
            <div className="h-3 w-3/4 bg-white/10 rounded"></div>
        </div>
      ));
    }

    if (chats.length === 0) {
      return <div className="text-center text-xs text-white/50 py-4">No {type} chats.</div>;
    }
    return chats.map((chat) => (
      <ChatListItem
        key={chat.chat_id}
        chat={chat}
        isSelected={selectedChat?.chat_id === chat.chat_id}
        onSelect={() => handleChatSelect(chat)}
        listType={type}
      />
    ));
  };

  const renderSearchResults = () => {
      if (filteredSearchChats.length === 0) {
          return <p className="p-3 text-sm text-white/50">No chats found.</p>;
      }
      return filteredSearchChats.map(chat => (
        <div key={chat.chat_id} onMouseDown={() => handleChatSelect(chat)} className="p-3 hover:bg-violet/20 cursor-pointer flex items-center gap-3">
            {getChatTypeIcon(chat.chat_type, 16)}
            <span className="text-sm">{chat.chat_name}</span>
        </div>
    ));
  }

  return (
    <div className="absolute inset-0 bg-dark-primary/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-dark-secondary rounded-2xl w-[95%] max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Global Header */}
          <header className="flex items-center justify-between p-4 border-b border-white/20 bg-dark-tertiary rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <Send size={22} className="text-violet" />
              <h1 className="text-xl font-bold">Telegram Focus Mode</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X size={20} />
            </Button>
          </header>

          <div className="flex flex-1 overflow-hidden">
              {/* Left Panel: Chat Lists & Search */}
              <aside className="w-1/3 max-w-sm min-w-[300px] bg-dark-tertiary/50 border-r border-white/10 flex flex-col">
                  {/* Search Bar */}
                  <div className="p-3 border-b border-white/10">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                          <Input
                              type="text"
                              placeholder="Search all active chats..."
                              className="bg-dark-tertiary pl-10"
                              onFocus={() => setSearchFocused(true)}
                              onBlur={() => setTimeout(() => setSearchFocused(false), 150)} // Delay to allow click
                              onChange={(e) => setSearchTerm(e.target.value)}
                          />
                      </div>
                  </div>
                  
                  {isSearchFocused ? (
                    <div className="flex-1 flex flex-col">
                      <h3 className="p-3 text-sm font-semibold text-white/80">Search Results</h3>
                      <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                          {renderSearchResults()}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1">
                        {/* Unread Chats */}
                        <Collapsible defaultOpen>
                            <CollapsibleTrigger className="w-full">
                                <h3 className="p-3 text-sm font-semibold text-white/80 text-left">Unread</h3>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="px-2 space-y-1">
                                    {renderChatList(unreadChats, 'unread')}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>

                        {/* Recent Chats */}
                        <Collapsible defaultOpen>
                            <CollapsibleTrigger className="w-full">
                              <h3 className="p-3 text-sm font-semibold text-white/80 text-left">Recent</h3>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-2 space-y-1">
                                  {renderChatList(recentChats, 'recent')}
                              </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </ScrollArea>
                  )}
              </aside>

              {/* Right Panel: Conversation */}
              <section className="flex-1 flex flex-col">
                  {renderConversation()}
              </section>
          </div>
      </div>
    </div>
  );
};

export default TelegramFocusMode; 