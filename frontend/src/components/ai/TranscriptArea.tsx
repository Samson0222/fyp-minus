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
  
  // If no messages, render a transparent container that doesn't interfere with the cards
  if (messages.length === 0) {
    return (
      <div className="pointer-events-none">
        <div ref={messagesEndRef} />
      </div>
    );
  }
  
  // If there are messages, show them with a background
  return (
    <div className="bg-dark-primary/95 backdrop-blur-sm border-t border-white/10 max-h-80 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default TranscriptArea;
