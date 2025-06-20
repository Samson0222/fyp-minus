import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import TranscriptArea from "@/components/ai/TranscriptArea";
import InteractionBar from "@/components/ai/InteractionBar";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const responseText = getAIResponse(text);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: "ai",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleToggleListening = () => {
    setIsListening(prev => !prev);
    if (!isListening) {
      toast({
        title: "Listening...",
        description: "Say something or click again to stop."
      });

      // Simulate stopping the recording after 5 seconds
      setTimeout(() => {
        if (isListening) {
          setIsListening(false);
          handleSendMessage("This is a simulated voice message");
        }
      }, 5000);
    } else {
      setIsListening(false);
    }
  };

  return (
    <Layout>
      <div className="relative flex flex-col h-full w-full">
        <TranscriptArea messages={messages} />
        <InteractionBar onSendMessage={handleSendMessage} onToggleListening={handleToggleListening} isListening={isListening} />
      </div>
    </Layout>
  );
};

// Helper function to simulate AI responses
const getAIResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
    return "Hello there. How may I assist you today?";
  }
  if (lowerMessage.includes("help") || lowerMessage.includes("can you")) {
    return "I'd be happy to assist with your request. Could you provide more details about what you need help with?";
  }
  return "I understand. How would you like me to proceed with this information?";
};

export default Index;