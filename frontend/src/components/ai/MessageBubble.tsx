
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
        "flex w-full mb-4",
        isUser ? "ml-auto justify-end" : "mr-auto justify-start"
      )}
    >
      {/* Remove AI avatar */}
      {/* Remove User avatar */}
      <div
        className={cn(
          "rounded-2xl p-4 shadow-lg max-w-xl break-words whitespace-pre-wrap overflow-x-hidden",
          isUser 
            ? "bg-violet text-white rounded-tr-none" 
            : "bg-dark-tertiary text-white/90 rounded-tl-none"
        )}
      >
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
};

export default MessageBubble;
