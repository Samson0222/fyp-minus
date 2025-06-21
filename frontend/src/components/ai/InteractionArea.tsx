import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import AudioPlayer from "./AudioPlayer";

interface InteractionAreaProps {
  onSendMessage: (message: string) => void;
  onToggleListening: () => void;
  isListening: boolean;
}

const InteractionArea: React.FC<InteractionAreaProps> = ({
  onSendMessage,
  onToggleListening,
  isListening,
}) => {
  const [inputValue, setInputValue] = useState("");
  const isMobile = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px'; // Reset to button height
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 48 + (6 * 24); // 48px base + 6 additional lines (7 total lines)
      textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [inputValue]);
  
  return (
    <div className="bg-dark-primary/95 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center gap-4 max-w-3xl mx-auto">
        {/* AI Assistant / Mic */}
        <div className="flex flex-col items-center gap-2">
          <AudioPlayer isListening={isListening} onClick={onToggleListening} />
          {/* <span className="text-white/70 text-sm font-medium">AI Assistant</span> */}
        </div>
        
        {/* Text Area - Fixed width, expandable height */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl flex items-start gap-3 bg-dark-secondary border border-white/10 rounded-lg p-3 shadow-lg">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-dark-tertiary text-white placeholder-white/50 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-violet resize-none h-[48px] leading-6 scrollbar-custom overflow-y-auto"
              rows={1}
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.3) transparent'
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-violet rounded-lg p-3 text-white disabled:opacity-50 transition-opacity hover:opacity-90 active:scale-95 flex-shrink-0 h-[48px] w-[48px] flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </form>

        {/* Slogan - Smaller font */}
        <div className="text-center">
          <h3 className="text-sm font-medium relative">
            <span className="relative text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">Less clicking. More doing.</span>
          </h3>
        </div>
      </div>
    </div>
  );
};

export default InteractionArea; 