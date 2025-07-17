
import React from "react";
import { cn } from "@/lib/utils";
import MarkdownRenderer from "./MarkdownRenderer";

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
      <div
        className={cn(
          "rounded-2xl p-4 shadow-lg max-w-xl break-words overflow-x-hidden",
          isUser 
            ? "bg-violet text-white rounded-tr-none" 
            : "bg-dark-tertiary text-white/90 rounded-tl-none"
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{text}</p>
        ) : (
          <MarkdownRenderer content={text} />
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
