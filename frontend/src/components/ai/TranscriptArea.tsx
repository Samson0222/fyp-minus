
import React, { useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";

interface TranscriptAreaProps {
  messages: Array<{
    id: string;
    text: string;
    sender: "user" | "ai" | "system";
    timestamp: Date;
  }>;
}

const TranscriptArea: React.FC<TranscriptAreaProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pr-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
      
      {messages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-center px-4">
          {/* New layout with tagline first */}
          <h3 className="text-lg font-medium mb-6 relative">
            <span className="relative text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">Less clicking. More doing.</span>
          </h3>
          
          {/* Sound wave visualization image */}
          <div className="mb-6 w-64">
            <img src="/lovable-uploads/4c9d8666-84f1-4207-85a2-70a60a1cec03.png" alt="Voice assistant visualization" className="w-full" />
          </div>
          
          {/* Welcome title with gradient styling */}
          <h2 className="text-2xl font-bold mb-2 relative">
            <span className="relative text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">Welcome to Minus AI</span>
          </h2>
          
          {/* Description without line break */}
          <p className="text-foreground/70 max-w-md">
            Your personal AI assistant. Start a conversation by typing a
            <br />
            message or say "Hey Minus" to activate.
          </p>
        </div>
      )}
    </div>
  );
};

export default TranscriptArea;
