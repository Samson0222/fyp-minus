import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, ExternalLink, Users, User, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TelegramMessage {
  id: string;
  message_id: number;
  sender_name: string;
  telegram_sender_id: number;
  content: string;
  message_type: string;
  timestamp: string;
  is_read: boolean;
}

interface UnreadChat {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  unread_count: number;
  latest_message: string;
  latest_sender: string;
  latest_timestamp: string;
}

interface TelegramFocusModeProps {
  isOpen: boolean;
  onClose: () => void;
}

const TelegramFocusMode: React.FC<TelegramFocusModeProps> = ({ isOpen, onClose }) => {
  const [unreadChats, setUnreadChats] = useState<UnreadChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<UnreadChat | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchUnreadSummary();
    }
  }, [isOpen]);

  const fetchUnreadSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/telegram/unread_summary');
      const data = await response.json();
      
      if (data.success) {
        setUnreadChats(data.unread_chats || []);
        // Auto-select first chat if available
        if (data.unread_chats && data.unread_chats.length > 0) {
          handleChatSelect(data.unread_chats[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch unread summary:', error);
      toast({
        title: "Error",
        description: "Failed to load unread messages.",
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChatSelect = async (chat: UnreadChat) => {
    setSelectedChat(chat);
    setMessages([]);
    setReplyText('');
    
    try {
      const response = await fetch(`/api/v1/telegram/conversation/${chat.chat_id}`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages || []);
        // Update the unread count for this chat
        setUnreadChats(prev => 
          prev.map(c => 
            c.chat_id === chat.chat_id 
              ? { ...c, unread_count: 0 }
              : c
          )
        );
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation.",
        variant: 'destructive'
      });
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !replyText.trim()) return;

    setSending(true);
    try {
      const response = await fetch('/api/v1/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: selectedChat.chat_id,
          message: replyText
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setReplyText('');
        toast({
          title: "Message Sent",
          description: "Your message has been sent successfully."
        });
        // Optionally refresh the conversation
        handleChatSelect(selectedChat);
      } else {
        throw new Error(data.detail || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message.",
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const getChatTypeIcon = (chatType: string) => {
    switch (chatType) {
      case 'group':
      case 'supergroup':
        return <Users className="text-blue-400" size={14} />;
      case 'channel':
        return <Hash className="text-green-400" size={14} />;
      default:
        return <User className="text-purple-400" size={14} />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const openInTelegram = () => {
    if (selectedChat) {
      // Open Telegram desktop/web app (this is a simplified approach)
      window.open(`https://t.me/`, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Main Hub Container */}
      <div 
        className="relative w-full max-w-4xl h-[90%] max-h-[800px] bg-dark-secondary border border-white/20 rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing the modal
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-blue-400" size={20} />
            <h2 className="text-white text-lg font-medium">Telegram Focus Mode</h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Summarized Unread Chat List */}
          <div className="w-1/2 border-r border-white/10 flex flex-col">
            <div className="p-3 border-b border-white/10">
              <h3 className="text-white font-medium text-sm">Unread Conversations</h3>
            </div>
            
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 text-white/50 text-center">Loading...</div>
              ) : unreadChats.length === 0 ? (
                <div className="p-4 text-center text-white/50">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No unread messages</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {unreadChats.map((chat) => (
                    <div
                      key={chat.chat_id}
                      onClick={() => handleChatSelect(chat)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedChat?.chat_id === chat.chat_id
                          ? 'bg-violet/20 border border-violet/40'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* First Line: Name, Unread Count, Time */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getChatTypeIcon(chat.chat_type)}
                          <span className="text-white font-medium text-sm truncate">
                            {chat.chat_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          {chat.unread_count > 0 && (
                            <span className="bg-violet px-1.5 py-0.5 rounded-full text-white text-xs">
                              {chat.unread_count}
                            </span>
                          )}
                          <span>{formatTimestamp(chat.latest_timestamp)}</span>
                        </div>
                      </div>
                      
                      {/* Second Line: Last Message Preview */}
                      <div className="text-xs text-white/50 truncate">
                        <span className="font-medium">{chat.latest_sender}:</span>{' '}
                        {chat.latest_message || 'No message preview'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel - Telegram Chat Area */}
          <div className="w-1/2 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    {getChatTypeIcon(selectedChat.chat_type)}
                    <h4 className="text-white font-medium">{selectedChat.chat_name}</h4>
                  </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div key={message.id} className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white/70 text-xs font-medium">
                            {message.sender_name}
                          </span>
                          <span className="text-white/40 text-xs">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-white text-sm">
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Reply Input */}
                <div className="p-3 border-t border-white/10 space-y-2 flex-shrink-0">
                  <Textarea
                    placeholder={`Reply to ${selectedChat.chat_name}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none"
                    rows={3}
                  />
                  <div className="flex justify-end items-center">
                    <Button
                      onClick={handleSendMessage}
                      disabled={!replyText.trim() || sending}
                      className="bg-violet hover:bg-violet-light"
                      size="sm"
                    >
                      <Send size={14} className="mr-1" />
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/50">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-white/10 flex-shrink-0">
            <Button
              onClick={openInTelegram}
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-white/5"
            >
              <ExternalLink size={14} className="mr-2" />
              Open in Telegram
            </Button>
        </div>
      </div>
    </div>
  );
};

export default TelegramFocusMode; 