
import React from "react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: {
    id: string;
    text: string;
    sender: "user" | "ai" | "system";
    timestamp: Date;
  };
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === "user";
  
  return (
    <div
      className={cn(
        "flex w-full max-w-[85%] mb-6",
        isUser ? "ml-auto justify-end" : "mr-auto justify-start"
      )}
    >
      {!isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-violet flex items-center justify-center mr-3 flex-shrink-0 border border-violet-light/50 shadow-[0_0_10px_rgba(138,107,244,0.5)]">
          <span className="font-bold text-white text-sm">M</span>
        </div>
      )}
      
      <div className={cn(
        "rounded-2xl p-4",
        isUser 
          ? "bg-violet text-white rounded-tr-none" 
          : "bg-dark-tertiary text-white rounded-tl-none"
      )}>
        <p className="text-sm">{message.text}</p>
        <div className={cn(
          "text-xs mt-2",
          isUser ? "text-white/70" : "text-white/50"
        )}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      
      {isUser && (
        <div className="w-10 h-10 rounded-full bg-violet flex items-center justify-center ml-3 flex-shrink-0 border border-violet-light/30 shadow-[0_0_10px_rgba(138,107,244,0.3)]">
          <span className="font-bold text-white text-lg">M</span>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
