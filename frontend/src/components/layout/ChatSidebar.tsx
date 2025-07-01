import React, { useState, useRef, useEffect } from "react";
import { Send, X, ChevronRight, ChevronLeft } from "lucide-react";
import MessageBubble from "@/components/ai/MessageBubble";
import AudioPlayer from "@/components/ai/AudioPlayer";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

interface ChatSidebarProps {
  onSendMessage: (message: string) => void;
  onToggleListening: () => void;
  isListening: boolean;
  messages: Message[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  onSendMessage,
  onToggleListening,
  isListening,
  messages,
  isCollapsed,
  onToggleCollapse
}) => {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to minimum
      textareaRef.current.style.height = '48px';
      
      // Calculate new height based on content
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // Approximate line height
      const maxLines = 5;
      const minHeight = 48; // Same as button height
      const maxHeight = minHeight + ((maxLines - 1) * lineHeight);
      
      // Set the height, but don't exceed max
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [inputValue]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  if (isCollapsed) {
    return (
      <div className="h-full bg-dark-secondary border-l border-white/5 w-12 flex flex-col items-center relative">
        <button 
          onClick={onToggleCollapse}
          className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-dark-secondary border border-white/10 rounded-full p-1 z-10 hover:bg-dark-tertiary transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex flex-col items-center justify-center h-full">
          <button 
            onClick={onToggleCollapse}
            className="p-2 rounded-full bg-violet text-white hover:bg-violet-light transition-colors"
            title="Open Chat"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-dark-secondary border-l border-white/5 w-80 flex flex-col relative">
      <button 
        onClick={onToggleCollapse}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-dark-secondary border border-white/10 rounded-full p-1 z-10 hover:bg-dark-tertiary transition-colors"
      >
        <ChevronRight size={16} />
      </button>
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex justify-center items-center">
        <h2 className="text-lg font-semibold text-white">Chat</h2>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-violet scrollbar-track-dark-tertiary">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/50 text-center">
              No messages yet. Start a conversation!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="p-4 border-t border-white/5">
        <div className="flex flex-col gap-2 items-center">
          <AudioPlayer isListening={isListening} onClick={onToggleListening} />
          
          <form onSubmit={handleSubmit} className="flex items-start gap-2 w-full">
            <textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-dark-tertiary text-white placeholder-white/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet resize-none overflow-y-auto scrollbar-thin"
              style={{
                height: '48px',
                minHeight: '48px',
                maxHeight: '144px',
              }}
            />
            
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="bg-violet rounded-lg p-3 text-white disabled:opacity-50 transition-opacity hover:opacity-90 active:scale-95 h-12 w-12 flex items-center justify-center flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar; 