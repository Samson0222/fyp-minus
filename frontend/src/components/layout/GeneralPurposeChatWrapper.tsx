import React, { useState, Dispatch, SetStateAction, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatSidebarUI, { Message, DraftReviewDetails, ToolDraftDetails } from './ChatSidebarUI';
import { useAuth } from '../../hooks/use-auth';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import { toast } from '@/components/ui/use-toast';

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

// Define a union type for all possible AI actions
type AiAction = 
  | { type: 'text', response: string, verbal_response?: string }
  | { type: 'tool_draft', tool_name: string, tool_input: ToolDraftDetails['tool_input'], assistant_message: string, verbal_response?: string }
  | { type: 'draft_review', details: DraftReviewDetails, verbal_response?: string }
  | { type: 'navigation', target_url: string, response: string, verbal_response?: string }
  | { type: 'telegram_draft', details: TelegramDraft, response: string, verbal_response?: string };


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
  
  // Voice integration state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const { startRecording, stopRecording, transcribeAudio, synthesizeSpeech, clearError } = useVoiceRecording();

  const handleClearChat = () => {
    setMessages([]);
    setConversationState({}); // Also reset conversation state if needed
  };

  const handleStartListening = async () => {
    // Stop any currently playing speech before starting to listen.
    handleStopSpeaking();
    setError(null);
    clearError();
    
    try {
      await startRecording();
      setIsListening(true); // Set listening state only after recording has successfully started
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start voice recording';
      setError(errorMessage);
      toast({
        title: "Voice Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleStopListening = () => {
    if (!isListening) return;
    console.log("User stopped listening via tap.");
    handleStopAndProcess();
  };

  const handleCancelListening = async () => {
    console.log("User cancelled listening.");
    setIsListening(false);
    await stopRecording(); // Stop and discard audio blob
  };

  const handleStopAndProcess = async () => {
    if (!isListening) return; // Prevent multiple triggers
    setIsListening(false); // This will trigger the useEffect cleanup
    
    const audioBlob = await stopRecording();
    if (!audioBlob || audioBlob.size === 0) {
      console.log("No audio captured, aborting processing.");
      return;
    }
    
    try {
      const transcript = await transcribeAudio(audioBlob);
      if (transcript.trim()) {
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          sender: 'user',
          timestamp: new Date(),
          content: { type: 'text', text: transcript },
        };
        setMessages(prev => [...prev, userMessage]);
        await processTextMessage(transcript);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process voice input';
      setError(errorMessage);
    }
  };

  const handleStopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0; // Reset audio to the beginning
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const processAndDisplayMessage = async (action: AiAction) => {
    let aiMessage: Message | null = null;
    if (action.type === 'text') {
      aiMessage = {
        id: `ai-${Date.now()}-${Math.random()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: { type: 'text', text: action.response }
      };
    } else if (action.type === 'tool_draft') {
      aiMessage = {
        id: `ai-${Date.now()}-${Math.random()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: { 
          type: 'tool_draft', 
          tool_name: action.tool_name,
          tool_input: action.tool_input,
          assistant_message: action.assistant_message
        }
      };
    } else if (action.type === 'draft_review') {
      aiMessage = {
        id: `ai-${Date.now()}-${Math.random()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: {
          type: 'draft_review',
          details: action.details
        }
      };
    } else if (action.type === 'navigation') {
      if (action.target_url) {
        navigate(action.target_url);
      }
      aiMessage = {
        id: `ai-${Date.now()}-${Math.random()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: { type: 'text', text: action.response || 'Navigating...' }
      };
    } else if (action.type === 'telegram_draft') {
        setTelegramDraft(action.details);
        aiMessage = {
          id: `ai-${Date.now()}-${Math.random()}`,
          sender: 'ai',
          timestamp: new Date(),
          content: {
            type: 'text', // Display as a simple text message in the chat history
            text: action.response 
          }
        };
    }


    if (aiMessage) {
        setMessages((prev) => [...prev, aiMessage as Message]);
        
        const verbalResponse = (action.verbal_response || (aiMessage.content.type === 'text' ? aiMessage.content.text : null));
        if (verbalResponse) {
            try {
                handleStopSpeaking(); 
                setIsSpeaking(true);
                const audio = await synthesizeSpeech(verbalResponse);
                currentAudioRef.current = audio;
                
                return new Promise<void>((resolve) => {
                  audio.play();
                  audio.onended = () => {
                      handleStopSpeaking();
                      resolve();
                  };
                  audio.onerror = () => {
                      console.error("Error playing TTS audio.");
                      handleStopSpeaking();
                      resolve();
                  }
                });

            } catch (speechError) {
                console.error('TTS synthesis error:', speechError);
                handleStopSpeaking();
            }
        }
    }
    // If no audio, resolve immediately
    return Promise.resolve();
  };


  const processTextMessage = async (text: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const chat_history = buildChatHistory(messages);

    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          chat_history: chat_history,
          user_context: { user_id: user.id }, 
          conversation_state: conversationState,
          ui_context: {
            page: 'docs_dashboard',
            path: window.location.pathname
          }
        }),
      });

      setIsLoading(false);

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

      if (data.type === 'multi_action') {
        for (const action of data.actions) {
          await processAndDisplayMessage(action);
          // Optional: add a small delay between messages for a more natural feel
          await new Promise(resolve => setTimeout(resolve, 500)); 
        }
      } else {
        await processAndDisplayMessage(data);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get a response.';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !user) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date(),
      content: { type: 'text', text: inputValue },
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    
    await processTextMessage(currentInput);
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
      content: { type: 'text', text: `[User approved sending draft with ID: ${draftId}]` },
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    const chat_history_for_send = buildChatHistory(messages);
        
    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: JSON.stringify({ user_action: 'send_draft', draft_id: draftId }),
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
      onClearChat={handleClearChat}
      // Voice integration props
      isListening={isListening}
      isSpeaking={isSpeaking}
      onStartListening={handleStartListening}
      onStopListening={handleStopListening}
      onCancelListening={handleCancelListening}
      onStopSpeaking={handleStopSpeaking}
    />
  );
};

export default GeneralPurposeChatWrapper; 