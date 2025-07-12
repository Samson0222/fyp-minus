import React, { useState } from 'react';
import ChatSidebarUI, { Message } from './ChatSidebarUI'; // Assuming Message is exported from ChatSidebarUI
import { useAuth } from '../../hooks/use-auth'; // Import the real auth hook

const GeneralPurposeChatWrapper: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth(); // Get the authenticated user object

  // This function will be called when the user sends a message.
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    if (!user) {
        setError("You must be logged in to chat with the assistant.");
        setIsLoading(false);
        return;
    }

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

    // Prepare conversation history for the backend.
    // This logic is now more robust: it explicitly handles the message types
    // that are valid for history and filters out any others (like errors or system messages).
    const chat_history = messages
      .filter(m => m.sender !== 'system')
      .map(m => {
        const role = m.sender === 'ai' ? 'model' : 'user';
        let contentText: string | undefined;

        if (m.content.type === 'text') {
            // Handles both user messages and standard AI text responses.
            contentText = m.content.text;
        } else if (m.content.type === 'tool_draft') {
            // Handles AI messages that propose a tool action.
            contentText = m.content.assistant_message;
        }
        
        // If contentText was successfully extracted, return a valid history object.
        // Otherwise, this will result in a null, which is filtered out below.
        if (contentText) {
            return { role, content: contentText };
        }
        return null;
      })
      .filter(Boolean); // This removes any null entries from the array.

    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputValue,
          chat_history: chat_history,
          // Use the real user ID and remove the placeholder credentials
          user_context: { user_id: user.id } 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // The detail from a 422 error can be a complex object, stringify it.
        const errorMessage = typeof errorData.detail === 'string' 
          ? errorData.detail 
          : JSON.stringify(errorData.detail, null, 2);
        throw new Error(errorMessage || 'An unknown error occurred');
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
  const handleApproveTool = async (toolName: string, toolInput: any) => {
    console.log("Approving and executing tool:", toolName, toolInput);
    setIsLoading(true);
    setError(null);

    // Add a system message to inform the user that the action is running
    const executingMessage: Message = {
      id: `system-${Date.now()}`,
      sender: 'system',
      timestamp: new Date(),
      content: { type: 'text', text: `Executing: ${toolName}...` }
    };
    setMessages(prev => [...prev, executingMessage]);

    if (!user) {
        setError("You must be logged in to approve a tool.");
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/v1/assistant/execute_tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: toolName,
          tool_input: toolInput,
          // Use the real user ID and remove the placeholder credentials
          user_context: { user_id: user.id }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Tool execution failed');
      }

      const result = await response.json();

      // Display the result of the tool execution as a final system message
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