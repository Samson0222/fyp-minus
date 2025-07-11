import React, { useState } from 'react';
import ChatSidebarUI, { Message } from './ChatSidebarUI'; // Assuming Message is exported from ChatSidebarUI

const GeneralPurposeChatWrapper: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // This function will be called when the user sends a message.
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date(),
      content: { type: 'text', text: inputValue },
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    // Prepare conversation history for the backend, excluding the latest user message
    const conversation_history = messages.map(m => ({
        role: m.sender,
        content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content)
    }));

    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          conversation_history: conversation_history,
          ui_context: { page: 'dashboard' } // Example context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'An unknown error occurred');
      }

      const data = await response.json();
      
      // The backend now returns a structured response, either text or tool_draft
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        timestamp: new Date(),
        content: {
            type: data.type, // 'text' or 'tool_draft'
            text: data.response, // For text type
            tool_name: data.tool_name, // For tool_draft type
            tool_input: data.tool_input, // For tool_draft type
            assistant_message: data.assistant_message // For tool_draft type
        }
      };
      
      // Handle cases where some fields might be undefined based on type
      if (data.type === 'text') {
        aiMessage.content = { type: 'text', text: data.response };
      } else if (data.type === 'tool_draft') {
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

  // Placeholder for approving a tool action
  const handleApproveTool = (toolName: string, toolInput: any) => {
    console.log("Approving tool:", toolName, toolInput);
    // In a real implementation, this would send another request to the backend
    // to execute the approved action.
    const systemMessage: Message = {
        id: `system-${Date.now()}`,
        sender: 'system',
        timestamp: new Date(),
        content: { type: 'text', text: `Action Approved: ${toolName}. (This is a mock confirmation)` }
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  // Placeholder for rejecting a tool action
  const handleRejectTool = (toolName: string, toolInput: any) => {
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
      onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      onApproveTool={handleApproveTool}
      onRejectTool={handleRejectTool}
    />
  );
};

export default GeneralPurposeChatWrapper; 