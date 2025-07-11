
import React from "react";
import { cn } from "@/lib/utils";

// Updated props to be more direct and simple.
// The component is now only responsible for displaying text.
interface MessageBubbleProps {
  sender: "user" | "ai" | "system";
  text: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ sender, text }) => {
  const isUser = sender === "user";
  
  return (
    <div
      className={cn(
        "flex w-full max-w-[85%] mb-4",
        isUser ? "ml-auto justify-end" : "mr-auto justify-start"
      )}
    >
      {!isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet to-violet-light flex items-center justify-center mr-3 flex-shrink-0 border border-violet-light/50 shadow-[0_0_10px_rgba(138,107,244,0.5)]">
          <span className="font-bold text-white text-sm">AI</span>
        </div>
      )}
      
      <div className={cn(
        "rounded-2xl p-4 shadow-lg",
        isUser 
          ? "bg-violet text-white rounded-tr-none" 
          : "bg-dark-tertiary text-white/90 rounded-tl-none"
      )}>
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
      
      {isUser && (
        <div className="w-10 h-10 rounded-full bg-dark-tertiary flex items-center justify-center ml-3 flex-shrink-0 border border-white/10">
          <span className="font-bold text-white/80 text-lg">U</span>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
