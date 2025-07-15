import React, { useRef, useEffect } from "react";
import { Send, ThumbsUp, ThumbsDown, ChevronRight, ChevronLeft, AlertTriangle, X, Trash2 } from "lucide-react";
import MessageBubble from "@/components/ai/MessageBubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    tool_input: unknown;
    assistant_message: string;
  } | {
    type: 'draft_review';
    details: {
      draft_id: string;
      to: string;
      subject: string;
      body: string;
    };
  };
}

// Exporting these types so they can be used by the wrapper
export interface ToolDraftDetails {
  tool_name: string;
  tool_input: unknown;
  assistant_message: string;
}

// Type for document suggestion tool input
interface DocumentSuggestionInput {
  preview_type: 'document_edit';
  original_text: string;
  suggested_text: string;
}

export interface DraftReviewDetails {
  draft_id: string;
  to: string;
  subject: string;
  body: string;
}


// New props interface for the "dumb" UI component.
// It receives all data and handlers from its smart parent wrapper.
export interface ChatSidebarUIProps {
  messages: Message[];
  onSendMessage: () => void;
  onApproveTool: (toolName: string, toolInput: unknown) => void;
  onRejectTool: (toolName: string, toolInput: unknown) => void;
  onSendDraft: (draftId: string) => void;
  onCancelDraft: (details: DraftReviewDetails) => void;
  onClearChat?: () => void;

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

// Helper component for rendering document edit suggestions
interface DocumentSuggestionCardProps {
  message: Message;
  onApprove: (toolName: string, toolInput: DocumentSuggestionInput | unknown) => void;
  onReject: (toolName: string, toolInput: DocumentSuggestionInput | unknown) => void;
}
const DocumentSuggestionCard: React.FC<DocumentSuggestionCardProps> = ({ message, onApprove, onReject }) => {
  if (message.content.type !== 'tool_draft') return null;
  const { tool_name, tool_input, assistant_message } = message.content;

  // Type guard for document suggestion
  const isDocumentSuggestion = (input: unknown): input is DocumentSuggestionInput => {
    return (
      typeof input === 'object' &&
      input !== null &&
      'preview_type' in input &&
      (input as { preview_type: unknown }).preview_type === 'document_edit' &&
      'original_text' in input &&
      'suggested_text' in input
    );
  };

  if (isDocumentSuggestion(tool_input)) {
    const { original_text, suggested_text } = tool_input;
    
    return (
      <Card className="bg-dark-tertiary border-violet/30 my-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-violet-light flex items-center">
            AI Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-white/90 space-y-4">
          <p>{assistant_message}</p>
          
          <div className="space-y-3">
            <div className="bg-dark-primary/30 p-3 rounded border-l-4 border-red-500/50">
              <div className="text-xs font-semibold text-red-400 mb-2">ORIGINAL:</div>
              <div className="text-white/80 leading-relaxed">
                {original_text}
              </div>
            </div>
            
            <div className="bg-dark-primary/30 p-3 rounded border-l-4 border-green-500/50">
              <div className="text-xs font-semibold text-green-400 mb-2">SUGGESTED:</div>
              <div className="text-white/80 leading-relaxed">
                {suggested_text}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" size="sm" onClick={() => onReject(tool_name, tool_input)}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
          <Button variant="default" size="sm" className="bg-violet hover:bg-violet-light" onClick={() => onApprove(tool_name, tool_input)}>
            <ThumbsUp className="h-4 w-4 mr-1" /> Approve
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Fallback for other tool drafts
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

interface EmailDraftCardProps {
  message: Message;
  onSend: (draftId: string) => void;
  onCancel: (details: DraftReviewDetails) => void;
}
const EmailDraftCard: React.FC<EmailDraftCardProps> = ({ message, onSend, onCancel }) => {
  if (message.content.type !== 'draft_review') return null;
  const { details } = message.content;

  return (
    <Card className="bg-dark-tertiary border-violet/30 my-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-violet-light flex items-center">
          Review Email Draft
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-white/90 space-y-3">
        <div className="flex">
          <strong className="w-16">To:</strong>
          <span>{details.to}</span>
        </div>
        <div className="flex">
          <strong className="w-16">Subject:</strong>
          <span>{details.subject}</span>
        </div>
        <div className="border-t border-white/10 pt-3 mt-3">
          <p className="whitespace-pre-wrap">{details.body}</p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button variant="outline" size="sm" onClick={() => onCancel(details)}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button variant="default" size="sm" className="bg-violet hover:bg-violet-light" onClick={() => onSend(details.draft_id)}>
          <Send className="h-4 w-4 mr-1" /> Send Email
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
  onSendDraft,
  onCancelDraft,
  inputValue,
  onInputChange,
  isLoading,
  isCollapsed,
  onToggleCollapse,
  error,
  title = "AI Assistant",
  placeholder = "Type your message...",
  emptyStateMessage = "No messages yet. Start the conversation!",
  onClearChat,
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
        {/* <button onClick={onToggleCollapse} className="p-2 rounded-full bg-violet text-white hover:bg-violet-light transition-colors" title="Open Chat">
          <Send size={18} />
        </button> */}
      </div>
    );
  }

  return (
    <div
      className="bg-dark-secondary border-l border-white/5 flex flex-col relative transition-all duration-300 h-full w-full"
    >
      <button
        onClick={onToggleCollapse}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-dark-secondary border border-white/10 rounded-full p-1 z-10 hover:bg-dark-tertiary transition-colors"
      >
        <ChevronRight size={16} />
      </button>
      <div className="p-4 border-b border-white/5 flex justify-center items-center w-full relative">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {onClearChat && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearChat}
                    className="text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <Trash2 size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear Chat History</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-violet scrollbar-track-dark-tertiary w-full">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/50 text-center">{emptyStateMessage}</p>
          </div>
        )}

        {messages.map((message) => {
          switch (message.content.type) {
            case 'text':
              return <MessageBubble key={message.id} sender={message.sender} text={message.content.text} />;
            case 'tool_draft':
              return <DocumentSuggestionCard key={message.id} message={message} onApprove={onApproveTool} onReject={onRejectTool} />;
            case 'draft_review':
              return <EmailDraftCard key={message.id} message={message} onSend={onSendDraft} onCancel={onCancelDraft} />;
            default:
              return null;
          }
        })}
        
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
      <div className="p-4 border-t border-white/5 w-full">
        <form onSubmit={handleSubmit} className="relative flex items-center w-full">
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