import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ChatSidebarUI, { Message } from "@/components/layout/ChatSidebarUI";
import { toast } from "@/components/ui/use-toast";

interface DocsChatProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const DocsChat: React.FC<DocsChatProps> = ({
  isCollapsed,
  onToggleCollapse
}) => {
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const documentTitle = searchParams.get('title') || 'Document';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      sender: "ai",
      timestamp: new Date(),
      content: {
        type: 'text',
        text: `I'm ready to help you with "${documentTitle}"! Try commands like:\n\n• "Find the phrase 'data indicates' and make it more casual."\n• "Add a new section about conclusions."`,
      }
    };
    setMessages([welcomeMessage]);
  }, [documentTitle]);

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
          message: currentInput,
          conversation_history: conversation_history,
          ui_context: {
            page: 'docs',
            document_id: documentId,
            document_title: documentTitle
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'An unknown server error occurred');
      }

      const data = await response.json();

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
      }
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get a response.';
        setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveTool = (toolName: string, toolInput: any) => {
    // In a real implementation, we would send this back to the orchestrator to execute.
    // For now, just show a confirmation.
    const systemMessage: Message = {
      id: `system-${Date.now()}`,
      sender: 'system',
        timestamp: new Date(),
      content: { type: 'text', text: `Action Approved: ${toolName}. (Mock confirmation)` }
    };
    setMessages(prev => [...prev, systemMessage]);
    toast({ title: 'Action Approved', description: `The action '${toolName}' was approved.` });
  };

  const handleRejectTool = (toolName: string, toolInput: any) => {
    const systemMessage: Message = {
      id: `system-${Date.now()}`,
      sender: 'system',
      timestamp: new Date(),
      content: { type: 'text', text: `Action Rejected: ${toolName}.` }
    };
    setMessages(prev => [...prev, systemMessage]);
    toast({ title: 'Action Rejected', variant: 'destructive' });
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
      title="Docs Assistant"
      placeholder="e.g., 'Make this sound more professional...'"
      emptyStateMessage="I'm ready to help you with this document!"
    />
  );
};

export default DocsChat; 