import React, { useRef, useEffect } from "react";
import { Send, ThumbsUp, ThumbsDown, ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";
import MessageBubble from "@/components/ai/MessageBubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Expanded Message type to support structured tool drafts from the AI agent.
export interface Message {
  id: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
  content: {
    type: 'text';
    text: string;
  } | {
    type: 'tool_draft';
    tool_name: string;
    tool_input: any;
    assistant_message: string;
  };
}

// New props interface for the "dumb" UI component.
// It receives all data and handlers from its smart parent wrapper.
export interface ChatSidebarUIProps {
  messages: Message[];
  onSendMessage: () => void;
  onApproveTool: (toolName: string, toolInput: any) => void;
  onRejectTool: (toolName: string, toolInput: any) => void;

  inputValue: string;
  onInputChange: (value: string) => void;

  isLoading: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;

  error: string | null;

  title?: string;
  placeholder?: string;
  emptyStateMessage?: string;
}

// Helper component for rendering the "Draft, Review, Approve" UI
const ToolDraftCard: React.FC<{ message: Message, onApprove: Function, onReject: Function }> = ({ message, onApprove, onReject }) => {
  if (message.content.type !== 'tool_draft') return null;
  const { tool_name, tool_input, assistant_message } = message.content;

  return (
    <Card className="bg-dark-tertiary border-violet/30 my-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-violet-light flex items-center">
          Action Required
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-white/90 space-y-2">
        <p>{assistant_message}</p>
        <div className="bg-dark-primary/50 p-2 rounded text-xs font-mono overflow-x-auto">
          <strong>Tool:</strong> {tool_name}<br/>
          <strong>Details:</strong> <pre>{JSON.stringify(tool_input, null, 2)}</pre>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button variant="outline" size="sm" onClick={() => onReject(tool_name, tool_input)}>
          <ThumbsDown className="h-4 w-4 mr-1" /> Reject
        </Button>
        <Button variant="default" size="sm" className="bg-violet hover:bg-violet-light" onClick={() => onApprove(tool_name, tool_input)}>
          <ThumbsUp className="h-4 w-4 mr-1" /> Approve
        </Button>
      </CardFooter>
    </Card>
  );
};


const ChatSidebarUI: React.FC<ChatSidebarUIProps> = ({
  messages,
  onSendMessage,
  onApproveTool,
  onRejectTool,
  inputValue,
  onInputChange,
  isLoading,
  isCollapsed,
  onToggleCollapse,
  error,
  title = "AI Assistant",
  placeholder = "Type your message...",
  emptyStateMessage = "No messages yet. Start the conversation!"
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // Approx 5 lines
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isCollapsed) {
    return (
      <div className="h-full bg-dark-secondary border-l border-white/5 w-12 flex flex-col items-center justify-center relative transition-all duration-300">
        <button
          onClick={onToggleCollapse}
          className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-dark-secondary border border-white/10 rounded-full p-1 z-10 hover:bg-dark-tertiary transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button onClick={onToggleCollapse} className="p-2 rounded-full bg-violet text-white hover:bg-violet-light transition-colors" title="Open Chat">
          <Send size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-dark-secondary border-l border-white/5 w-96 flex flex-col relative transition-all duration-300">
       <button
        onClick={onToggleCollapse}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-dark-secondary border border-white/10 rounded-full p-1 z-10 hover:bg-dark-tertiary transition-colors"
      >
        <ChevronRight size={16} />
      </button>

      <div className="p-4 border-b border-white/5 flex justify-center items-center">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-violet scrollbar-track-dark-tertiary">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/50 text-center">{emptyStateMessage}</p>
          </div>
        )}

        {messages.map((message) =>
          message.content.type === 'text' ? (
            <MessageBubble key={message.id} sender={message.sender} text={message.content.text} />
          ) : (
            <ToolDraftCard key={message.id} message={message} onApprove={onApproveTool} onReject={onRejectTool} />
          )
        )}
        
        {isLoading && (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-violet rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-violet rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-violet rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-white/70 text-sm">Thinking...</span>
          </div>
        )}
        
        {error && (
            <div className="flex items-start space-x-2 text-red-400 p-2 bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div className="flex flex-col">
                    <span className="font-semibold">Error</span>
                    <span className="text-sm">{error}</span>
                </div>
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/5">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full bg-dark-tertiary border-white/10 rounded-lg p-3 pr-12 resize-none scrollbar-thin scrollbar-thumb-dark-primary"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-violet hover:bg-violet-light" disabled={isLoading || !inputValue.trim()}>
            <Send size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatSidebarUI; 