import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import AudioPlayer from "./AudioPlayer";
import { toast } from "@/components/ui/use-toast";

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
  const [isListeningState, setIsListening] = useState(isListening);
  
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

  const handleToggleListening = async () => {
    console.log('[MIC] button clicked');
    if (!isListeningState) {
      try {
        console.log('[MIC] requesting MediaStream…');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[MIC] stream granted', stream);
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        const chunks: Blob[] = [];

        recorder.ondataavailable = e => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          console.log('[MIC] recorded blob', blob);
          const form = new FormData();
          form.append('audio_file', blob, 'speech.webm');
          try {
            const res = await fetch('/api/v1/audio/transcribe', { method: 'POST', body: form });
            const data = await res.json();
            console.log('[MIC] transcript', data.transcribed_text);
            
            // Send transcribed text to Gmail voice command processor
            try {
              const voiceRes = await fetch('/api/v1/gmail/voice-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: data.transcribed_text })
              });
              const voiceData = await voiceRes.json();
              console.log('[MIC] voice command result', voiceData);
              
              // Show the response to user
              onSendMessage(data.transcribed_text);
              if (voiceData.response) {
                toast({ 
                  title: 'Voice Command Processed', 
                  description: voiceData.response,
                  duration: 5000
                });
              }
            } catch (voiceErr) {
              console.error('[MIC] voice command error', voiceErr);
              // Still show the transcribed text even if voice command fails
              onSendMessage(data.transcribed_text);
            }
          } catch (err) {
            console.error('[MIC] transcription error', err);
          }
        };

        recorder.start();
        setIsListening(true);
        toast({ title: 'Voice Recognition Active', description: 'Speak now…' });

        // auto stop after 5s
        setTimeout(() => {
          recorder.state !== 'inactive' && recorder.stop();
          setIsListening(false);
        }, 5000);
      } catch (err) {
        console.error('[MIC] getUserMedia error', err);
        toast({ title: 'Microphone error', description: String(err), variant: 'destructive' });
      }
    } else {
      setIsListening(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to minimum
      textareaRef.current.style.height = '48px';
      
      // Calculate new height based on content
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // Approximate line height
      const maxLines = 7;
      const minHeight = 48; // Same as button height
      const maxHeight = minHeight + ((maxLines - 1) * lineHeight); // 48 + (6 * 24) = 192px
      
      // Set the height, but don't exceed max
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [inputValue]);
  
  return (
    <div className="bg-dark-primary/95 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center gap-4 max-w-3xl mx-auto">
        {/* AI Assistant / Mic */}
        <div className="flex flex-col items-center gap-2">
          <AudioPlayer isListening={isListeningState} onClick={handleToggleListening} />
          {/* <span className="text-white/70 text-sm font-medium">AI Assistant</span> */}
        </div>
        
        {/* Text Area - Same initial size as button, expandable */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl flex items-start gap-3 bg-dark-secondary border border-white/10 rounded-lg p-3 shadow-lg">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-dark-tertiary text-white placeholder-white/50 rounded-lg px-4 focus:outline-none focus:ring-1 focus:ring-violet resize-none overflow-y-auto scrollbar-custom border-0 outline-none"
              rows={1}
              style={{
                height: '48px',
                minHeight: '48px',
                maxHeight: '192px',
                lineHeight: '24px',
                paddingTop: '12px',
                paddingBottom: '12px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.3) transparent'
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-violet rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90 active:scale-95 flex-shrink-0 h-[48px] w-[48px] flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </form>

        {/* Slogan */}
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