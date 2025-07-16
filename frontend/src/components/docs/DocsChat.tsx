import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import ChatSidebarUI, { Message, ToolDraftDetails } from "@/components/layout/ChatSidebarUI";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

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

// Define a union type for all possible AI actions
type AiAction =
  | { type: 'text'; response: string; verbal_response?: string }
  | { type: 'tool_draft'; tool_name: string; tool_input: ToolDraftDetails['tool_input']; assistant_message: string; verbal_response?: string }
  | { type: 'document_closed'; response: string; verbal_response?: string }
  | { type: 'navigation'; target_url: string, response: string, verbal_response?: string };


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
  
  // Voice integration state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const { startRecording, stopRecording, transcribeAudio, synthesizeSpeech, clearError } = useVoiceRecording();

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
    setIsListening(false); // This will trigger the useEffect cleanup
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
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const processAndDisplayMessage = async (action: AiAction) => {
    const aiMessage: Message = {
      id: `ai-${Date.now()}-${Math.random()}`,
      sender: 'ai',
      timestamp: new Date(),
      content: { type: 'text', text: 'An unexpected response was received.' } // Default
    };

    if (action.type === 'text') {
      aiMessage.content = { type: 'text', text: action.response };
    } else if (action.type === 'tool_draft') {
      aiMessage.content = { 
        type: 'tool_draft', 
        tool_name: action.tool_name,
        tool_input: action.tool_input,
        assistant_message: action.assistant_message
      };
    } else if (action.type === 'document_closed') {
      aiMessage.content = { type: 'text', text: action.response };
      toast({ title: 'Document Closed', description: 'Returning to dashboard...', duration: 3000 });
      navigate('/docs');
    } else if (action.type === 'navigation') {
        if (action.target_url) {
            navigate(action.target_url);
        }
        aiMessage.content = { type: 'text', text: action.response || 'Navigating...' };
    }
    
    setMessages(prev => [...prev, aiMessage]);
    
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
              };
            });

        } catch (speechError) {
            console.error('TTS synthesis error:', speechError);
            handleStopSpeaking();
        }
    }
    return Promise.resolve();
  };


  const processTextMessage = async (text: string) => {
    if (!documentId) {
      setError("No document is open.");
      return;
    }

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
          input: text,
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

      setIsLoading(false);

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

      if (data.type === 'multi_action') {
        for (const action of data.actions) {
          await processAndDisplayMessage(action);
          await new Promise(resolve => setTimeout(resolve, 500)); 
        }
      } else {
        await processAndDisplayMessage(data);
      }
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get a response.';
      setError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive', duration: 3000 });
      setIsLoading(false);
    }
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

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    
    await processTextMessage(currentInput);
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

export default DocsChat; 