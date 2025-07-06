import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ChatSidebar from "@/components/layout/ChatSidebar";
import { toast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

interface DocsChatProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface CreateSuggestionResponse {
  success: boolean;
  message: string;
  suggestion_id?: string;
  target_text?: string;
  suggested_text?: string;
  error?: string;
}

const DocsChat: React.FC<DocsChatProps> = ({
  isCollapsed,
  onToggleCollapse
}) => {
  // Get document ID from URL params
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const documentTitle = searchParams.get('title') || 'Document';

  // State management for the Docs chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [conversationMemory, setConversationMemory] = useState<string[]>([]);

  // Add welcome message when component mounts
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      text: `I'm ready to help you edit "${documentTitle}"! Try commands like:
      
• "Find the phrase 'data indicates' and make it more casual"
• "Add a new section about conclusions after the current content"
• "Make the introduction paragraph more engaging"
• "Format the headings consistently"

What would you like me to help you with?`,
      sender: "ai",
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [documentTitle]);

  // Handle sending text messages to Google Docs API
  const handleSendMessage = async (text: string) => {
    if (!documentId) {
      toast({
        title: 'Error',
        description: 'No document ID found. Please refresh the page.',
        variant: 'destructive'
      });
      return;
    }

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Update conversation memory for context
    setConversationMemory((prev) => [...prev, text]);

    // Set processing state
    setIsProcessing(true);

    try {
      // Send command to Google Docs create suggestion endpoint
      const response = await fetch(`/api/v1/docs/${documentId}/create-suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          command: text,
          context: conversationMemory.slice(-3).join(' ') // Include recent context
        })
      });

      if (response.ok) {
        const data: CreateSuggestionResponse = await response.json();
        
        let aiResponseText = '';
        if (data.success) {
          aiResponseText = `✅ ${data.message}`;
          
          if (data.target_text && data.suggested_text) {
            aiResponseText += `\n\n**Original:** "${data.target_text}"\n**Suggested:** "${data.suggested_text}"`;
          }
          
          if (data.suggestion_id) {
            aiResponseText += `\n\n*Please review the suggestion in the document and accept or reject it.*`;
          }
        } else {
          aiResponseText = `❌ ${data.message}`;
          if (data.error) {
            aiResponseText += `\n\nError: ${data.error}`;
          }
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: aiResponseText,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Show success toast for successful suggestions
        if (data.success) {
          toast({
            title: 'Suggestion Created',
            description: 'I\'ve added a suggestion to your document. Please review it!',
            duration: 5000
          });
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error creating suggestion:', error);
      
      // Provide helpful fallback response
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: getDocsDefaultResponse(text),
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMessage]);

      toast({
        title: 'Processing Error',
        description: 'Failed to process your command. Please try again or rephrase your request.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle voice commands with enhanced processing
  const handleVoiceCommand = async (transcribedText: string) => {
    console.log('[DOCS CHAT] Processing voice command:', transcribedText);
    
    // Show voice processing state
    setIsVoiceProcessing(true);
    
    try {
      // Process voice command the same way as text commands
      await handleSendMessage(transcribedText);
    } catch (error) {
      console.error('[DOCS CHAT] Voice command error:', error);
      toast({
        title: 'Voice Command Error',
        description: 'Failed to process voice command. Please try typing your request.',
        variant: 'destructive'
      });
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  // Enhanced command handler with intelligent dialogue support
  const handleCommand = async (command: string, isVoice: boolean = false) => {
    // Enhance command with conversational context for better AI understanding
    let enhancedCommand = command;
    
    // Add context from recent conversation for pronouns like "it", "this", etc.
    if (conversationMemory.length > 0 && (
      command.toLowerCase().includes(' it ') ||
      command.toLowerCase().includes(' this ') ||
      command.toLowerCase().includes(' that ') ||
      command.toLowerCase().startsWith('make it ') ||
      command.toLowerCase().startsWith('change it ') ||
      command.toLowerCase().startsWith('update it ')
    )) {
      const recentContext = conversationMemory.slice(-2).join(' ');
      enhancedCommand = `Context: ${recentContext}. Command: ${command}`;
    }

    if (isVoice) {
      // Add the transcribed text as a user message first
      const userMessage: Message = {
        id: Date.now().toString(),
        text: command,
        sender: "user",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      
      // Then process as voice command
      await handleVoiceCommand(enhancedCommand);
    } else {
      await handleSendMessage(enhancedCommand);
    }
  };

  const handleToggleListening = () => {
    setIsListening(!isListening);
  };

  // Google Docs-specific default responses
  const getDocsDefaultResponse = (text: string): string => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('find') || lowerText.includes('search')) {
      return "I can help you find and modify text in your document! Try being more specific about what text to look for. For example: 'Find the sentence starting with \"The data shows\" and make it more engaging.'";
    }
    
    if (lowerText.includes('add') || lowerText.includes('insert')) {
      return "I can help you add content to your document! Try specifying where to add it: 'Add a new paragraph about conclusions after the current content' or 'Insert a heading called \"Summary\" at the end.'";
    }
    
    if (lowerText.includes('format') || lowerText.includes('style')) {
      return "I can help with formatting! Try commands like 'Make all headings consistent' or 'Format the bullet points properly' or 'Make the introduction more engaging.'";
    }
    
    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('help')) {
      return `Hello! I'm your Google Docs AI assistant for "${documentTitle}". I can help you:

• Find and edit specific text
• Add new content to your document  
• Improve formatting and style
• Make suggestions for better writing

Try giving me a specific command like "Find the word 'important' and make it stand out" or "Add a conclusion paragraph."`;
    }
    
    return "I'm here to help you edit your Google Doc! Try giving me specific instructions like:\n\n• 'Find [specific text] and [what to do with it]'\n• 'Add [content] to [location]'\n• 'Make [section] more [adjective]'\n\nWhat would you like me to help you with?";
  };

  return (
    <ChatSidebar 
      onCommand={handleCommand}
      onToggleListening={handleToggleListening}
      isListening={isListening}
      messages={messages}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      isProcessing={isProcessing || isVoiceProcessing}
      title="Docs Assistant"
      placeholder={`Edit "${documentTitle.length > 20 ? documentTitle.slice(0, 20) + '...' : documentTitle}"...`}
      emptyStateMessage="Ready to help you edit your document! Try giving me specific editing commands."
    />
  );
};

export default DocsChat; 