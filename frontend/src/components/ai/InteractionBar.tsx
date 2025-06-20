
import React, { useState } from "react";
import { Send } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import AudioPlayer from "./AudioPlayer";

interface InteractionBarProps {
  onSendMessage: (message: string) => void;
  onToggleListening: () => void;
  isListening: boolean;
}

const InteractionBar: React.FC<InteractionBarProps> = ({
  onSendMessage,
  onToggleListening,
  isListening,
}) => {
  const [inputValue, setInputValue] = useState("");
  const isMobile = useIsMobile();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue("");
    }
  };
  
  return (
    <div className={`bg-transparent p-4 ${isMobile ? 'pb-20' : ''}`}>
      <div className="flex flex-col items-center gap-3 max-w-3xl mx-auto">
        {/* Audio player positioned above the input bar */}
        <AudioPlayer isListening={isListening} onClick={onToggleListening} />
        
        <form onSubmit={handleSubmit} className="w-full flex items-center gap-3 bg-dark-secondary border border-white/10 rounded-lg p-2 shadow-lg">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-dark-tertiary text-white placeholder-white/50 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-violet"
            />
          </div>
          
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-violet rounded-lg p-3 text-white disabled:opacity-50 transition-opacity hover:opacity-90 active:scale-95"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default InteractionBar;
