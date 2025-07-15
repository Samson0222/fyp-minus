import React, { useState, Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatSidebarUI, { Message, DraftReviewDetails, ToolDraftDetails } from './ChatSidebarUI';
import { useAuth } from '../../hooks/use-auth';

// Define the shape of the conversation state object
interface ConversationState {
  last_event_id?: string | null;
  last_email_id?: string | null;
  last_thread_id?: string | null;
  last_draft_id?: string | null;
  last_recipient_email?: string | null;
  last_telegram_chat_id?: number | null;
  last_message_body?: string | null;
  // Google Docs fields
  last_document_id?: string | null;
  last_document_title?: string | null;
  last_suggestion_id?: string | null;
}

export interface TelegramDraft {
  chat_id: number;
  chat_name: string;
  body: string;
}

interface GeneralPurposeChatWrapperProps {
  setTelegramDraft: Dispatch<SetStateAction<TelegramDraft | null>>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Helper function to build a safe chat history
const buildChatHistory = (messages: Message[]): { role: string; content: string }[] => {
  return messages
    .map(m => {
      if (m.sender === 'system') return null;

      const role = m.sender === 'ai' ? 'model' : 'user';
      let contentText: string | null = null;

      switch (m.content.type) {
        case 'text':
          contentText = m.content.text;
          break;
        case 'tool_draft':
          contentText = m.content.assistant_message;
          break;
        case 'draft_review':
          contentText = `[The user was reviewing a draft to ${m.content.details.to} with subject "${m.content.details.subject}"]`;
          break;
        default:
          break;
      }

      if (contentText) {
        return { role, content: contentText };
      }
      return null;
    })
    .filter((m): m is { role: string; content: string } => m !== null);
};


const GeneralPurposeChatWrapper: React.FC<GeneralPurposeChatWrapperProps> = ({ setTelegramDraft, isCollapsed = false, onToggleCollapse }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState>({});

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !user) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date(),
      content: { type: 'text', text: inputValue },
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    const chat_history = buildChatHistory(messages);

    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputValue,
          chat_history: chat_history,
          user_context: { user_id: user.id }, 
          conversation_state: conversationState,
          ui_context: {
            page: 'docs_dashboard',
            path: window.location.pathname
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = typeof errorData.detail === 'string' 
          ? errorData.detail 
          : JSON.stringify(errorData.detail, null, 2);
        throw new Error(errorMessage || 'An unknown error occurred');
      }

      const data = await response.json();
      
      if (data.state) {
        setConversationState(data.state);
      }

      if (data.type === 'telegram_draft') {
        setTelegramDraft(data.details);
        const confirmationMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: {
            type: 'text',
            text: data.response
          }
        };
        setMessages((prev) => [...prev, confirmationMessage]);

      } else {
        let aiMessage: Message | null = null;
      if (data.type === 'text') {
          aiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            timestamp: new Date(),
            content: { type: 'text', text: data.response }
          };
      } else if (data.type === 'tool_draft') {
          aiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            timestamp: new Date(),
            content: { 
            type: 'tool_draft', 
            tool_name: data.tool_name,
            tool_input: data.tool_input,
            assistant_message: data.assistant_message
            }
        };
      } else if (data.type === 'draft_review') {
          aiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            timestamp: new Date(),
            content: {
            type: 'draft_review',
            details: data.details
            }
        };
      } else if (data.type === 'navigation') {
          // Handle navigation commands from AI
          if (data.target_url) {
            navigate(data.target_url);
          }
          aiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            timestamp: new Date(),
            content: { type: 'text', text: data.response || 'Navigating...' }
        };
      }

        if (aiMessage) {
            setMessages((prev) => [...prev, aiMessage as Message]);
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get a response.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDraft = async (draftId: string) => {
    if (!user) return;
    console.log("Approving and sending draft:", draftId);
    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date(),
      content: { type: 'text', text: JSON.stringify({ user_action: 'send_draft', draft_id: draftId }) },
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    const chat_history_for_send = buildChatHistory(messages);
        
    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: userMessage.content.text,
          chat_history: chat_history_for_send,
          user_context: { user_id: user.id },
          conversation_state: conversationState
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send the draft.');
      }

      const data = await response.json();
      if (data.state) {
        setConversationState(data.state);
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: { type: 'text', text: data.response }
      };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelDraft = (draftDetails: DraftReviewDetails) => {
    console.log("Cancelling draft:", draftDetails);
    const systemMessage: Message = {
        id: `system-${Date.now()}`,
        sender: 'system',
        timestamp: new Date(),
        content: { type: 'text', text: `Draft to ${draftDetails.to} with subject "${draftDetails.subject}" was cancelled.` }
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleApproveTool = async (toolName: string, toolInput: ToolDraftDetails['tool_input']) => {
    if (!user) return;
    console.log("Approving and executing tool:", toolName, toolInput);
    setIsLoading(true);
    setError(null);

    const executingMessage: Message = {
      id: `system-${Date.now()}`,
      sender: 'system',
      timestamp: new Date(),
      content: { type: 'text', text: `Executing: ${toolName}...` }
    };
    setMessages(prev => [...prev, executingMessage]);

    try {
      const response = await fetch('/api/v1/assistant/execute_tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: toolName,
          tool_input: toolInput,
          user_context: { user_id: user.id }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Tool execution failed');
      }

      const result = await response.json();

      const resultMessage: Message = {
        id: `system-${Date.now()}-result`,
        sender: 'system',
        timestamp: new Date(),
        content: { type: 'text', text: `Execution Result: ${JSON.stringify(result)}` }
      };
      setMessages(prev => [...prev, resultMessage]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute the tool.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectTool = (toolName: string, toolInput: ToolDraftDetails['tool_input']) => {
    console.log("Rejecting tool:", toolName, toolInput);
    const systemMessage: Message = {
        id: `system-${Date.now()}`,
        sender: 'system',
        timestamp: new Date(),
        content: { type: 'text', text: `Action Rejected: ${toolName}.` }
    };
    setMessages(prev => [...prev, systemMessage]);
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
      onSendDraft={handleSendDraft}
      onCancelDraft={handleCancelDraft}
    />
  );
};

export default GeneralPurposeChatWrapper; 