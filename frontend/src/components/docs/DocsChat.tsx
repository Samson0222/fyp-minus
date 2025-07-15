import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import ChatSidebarUI, { Message, ToolDraftDetails } from "@/components/layout/ChatSidebarUI";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface ConversationState {
  last_event_id?: string | null;
  last_email_id?: string | null;
  last_thread_id?: string | null;
  last_draft_id?: string | null;
  last_recipient_email?: string | null;
  last_telegram_chat_id?: number | null;
  last_message_body?: string | null;
  last_document_id?: string | null;
  last_document_title?: string | null;
  last_suggestion_id?: string | null;
}

interface DocsChatProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const DocsChat: React.FC<DocsChatProps> = ({
  isCollapsed,
  onToggleCollapse
}) => {
  const { user } = useAuth();
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const documentTitle = searchParams.get('title') || 'Document';
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState>({});

  const getWelcomeMessage = () => ({
    id: 'welcome',
    sender: "ai" as const,
    timestamp: new Date(),
    content: {
      type: 'text' as const,
      text: `I'm ready to help you with "${documentTitle}"!`,
    }
  });

  useEffect(() => {
    setMessages([getWelcomeMessage()]);
  }, [documentTitle]);

  const handleClearChat = () => {
    setMessages([getWelcomeMessage()]);
    setConversationState({});
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !documentId) {
        if (!documentId) setError("No document is open.");
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      timestamp: new Date(),
      content: { type: 'text', text: inputValue },
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);
    setError(null);

    const conversation_history = messages.map(m => ({
        role: m.sender,
        content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content)
    }));

    try {
      const response = await fetch(`/api/v1/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: currentInput,
          chat_history: conversation_history,
          user_context: { user_id: user?.id },
          conversation_state: conversationState,
          ui_context: {
            page: 'docs',
            document_id: documentId,
            document_title: documentTitle
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (Array.isArray(errorData.detail)) {
            const errorMessages = errorData.detail.map((err: { loc: string[], msg: string }) => `${err.loc.join(' → ')}: ${err.msg}`).join('; ');
            throw new Error(errorMessages);
        }
        throw new Error(errorData.detail || 'An unknown server error occurred');
      }

      const data = await response.json();

      if (data.state) {
        setConversationState(data.state);
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
          timestamp: new Date(),
        content: { type: 'text', text: 'An unexpected response was received.' } // Default
      };

      if (data.type === 'text') {
        aiMessage.content = { type: 'text', text: data.response };
      } else if (data.type === 'tool_draft') {
        // This will render the "Approve/Reject" card in the UI
        aiMessage.content = { 
            type: 'tool_draft', 
            tool_name: data.tool_name,
            tool_input: data.tool_input,
            assistant_message: data.assistant_message
        };
      } else if (data.type === 'document_closed') {
        aiMessage.content = { type: 'text', text: data.response };
        toast({ title: 'Document Closed', description: 'Returning to dashboard...', duration: 3000 });
        navigate('/docs');
      }
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get a response.';
        setError(errorMessage);
        toast({ title: 'Error', description: errorMessage, variant: 'destructive', duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveTool = async (toolName: string, toolInput: ToolDraftDetails['tool_input']) => {
    if (!documentId || !user) {
      setError("No document is open or user is not authenticated.");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Add user approval message
    const userApprovalMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date(),
      content: { type: 'text', text: 'approve' }
    };
    setMessages(prev => [...prev, userApprovalMessage]);

    const conversation_history = messages.map(m => ({
      role: m.sender,
      content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content)
    }));

    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: 'approve',
          chat_history: conversation_history,
          user_context: { user_id: user.id },
          conversation_state: conversationState,
          ui_context: {
            page: 'docs',
            document_id: documentId,
            document_title: documentTitle
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (Array.isArray(errorData.detail)) {
          const errorMessages = errorData.detail.map((err: { loc: string[], msg: string }) => `${err.loc.join(' → ')}: ${err.msg}`).join('; ');
          throw new Error(errorMessages);
        }
        throw new Error(errorData.detail || 'An unknown server error occurred');
      }

      const data = await response.json();

      if (data.state) {
        setConversationState(data.state);
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: { type: 'text', text: data.response || 'Suggestion has been applied.' }
    };

      setMessages(prev => [...prev, aiMessage]);
      toast({ title: 'Action Approved', description: `The suggestion has been applied to your document.`, duration: 3000 });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply the suggestion.';
      setError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive', duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectTool = async (toolName: string, toolInput: ToolDraftDetails['tool_input']) => {
    if (!documentId || !user) {
      setError("No document is open or user is not authenticated.");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Add user rejection message
    const userRejectionMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date(),
      content: { type: 'text', text: 'reject' }
    };
    setMessages(prev => [...prev, userRejectionMessage]);

    const conversation_history = messages.map(m => ({
      role: m.sender,
      content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content)
    }));

    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: 'reject',
          chat_history: conversation_history,
          user_context: { user_id: user.id },
          conversation_state: conversationState,
          ui_context: {
            page: 'docs',
            document_id: documentId,
            document_title: documentTitle
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (Array.isArray(errorData.detail)) {
          const errorMessages = errorData.detail.map((err: { loc: string[], msg: string }) => `${err.loc.join(' → ')}: ${err.msg}`).join('; ');
          throw new Error(errorMessages);
        }
        throw new Error(errorData.detail || 'An unknown server error occurred');
      }

      const data = await response.json();

      if (data.state) {
        setConversationState(data.state);
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: { type: 'text', text: data.response || 'Suggestion has been rejected.' }
      };

      setMessages(prev => [...prev, aiMessage]);
      toast({ title: 'Action Rejected', description: 'The suggestion has been rejected.', duration: 3000 });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject the suggestion.';
      setError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive', duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatSidebarUI
      messages={messages}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onSendMessage={handleSendMessage}
      isLoading={isLoading}
      error={error}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      onApproveTool={handleApproveTool}
      onRejectTool={handleRejectTool}
      onSendDraft={() => {}} // Placeholder for now
      onCancelDraft={() => {}} // Placeholder for now
      onClearChat={handleClearChat}
      title="Docs Assistant"
      placeholder="Type your message here..."
      emptyStateMessage="I'm ready to help you with this document!"
    />
  );
};

export default DocsChat; 