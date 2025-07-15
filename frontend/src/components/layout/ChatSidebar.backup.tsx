import React, { useState, useRef, useEffect } from "react";
import { Send, X, ChevronRight, ChevronLeft } from "lucide-react";
import MessageBubble from "@/components/ai/MessageBubble";
import AudioPlayer from "@/components/ai/AudioPlayer";
import { toast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

interface ChatSidebarProps {
  onSendMessage: (message: string) => void;
  onToggleListening: () => void;
  isListening: boolean;
  messages: Message[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isProcessing?: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  onSendMessage,
  onToggleListening,
  isListening,
  messages,
  isCollapsed,
  onToggleCollapse,
  isProcessing = false
}) => {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isListeningState, setIsListening] = useState(isListening);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
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
    console.log('[CHAT] mic button clicked');
    if (!isListeningState) {
      try {
        console.log('[CHAT] requesting MediaStream…');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[CHAT] stream granted', stream);
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        const chunks: Blob[] = [];

        recorder.ondataavailable = e => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          console.log('[CHAT] recorded blob', blob);
          const form = new FormData();
          form.append('audio_file', blob, 'speech.webm');
          
          try {
            const res = await fetch('/api/v1/audio/transcribe', { method: 'POST', body: form });
            const data = await res.json();
            console.log('[CHAT] transcript', data.transcribed_text);
            
            // Add transcribed text as user message
            const userMessage: Message = {
              id: Date.now().toString(),
              text: data.transcribed_text,
              sender: "user",
              timestamp: new Date(),
            };
            onSendMessage(data.transcribed_text);
            
            // Show voice processing state
            setIsVoiceProcessing(true);
            
            // Send transcribed text to Gmail voice command processor
            try {
              const voiceRes = await fetch('/api/v1/gmail/voice-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: data.transcribed_text })
              });
              const voiceData = await voiceRes.json();
              console.log('[CHAT] voice command result', voiceData);
              
              // Hide voice processing state
              setIsVoiceProcessing(false);
              
              // Show the AI response
              if (voiceData.response) {
                const aiMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  text: voiceData.response,
                  sender: "ai",
                  timestamp: new Date(),
                };
                
                // Add AI response to chat
                setTimeout(() => {
                  // This will be handled by the parent component through onSendMessage
                  toast({ 
                    title: 'Voice Command Processed', 
                    description: voiceData.response,
                    duration: 1000
                  });
                }, 500);
              }
            } catch (voiceErr) {
              console.error('[CHAT] voice command error', voiceErr);
              setIsVoiceProcessing(false);
              toast({
                title: 'Voice Command Error',
                description: 'Failed to process voice command, but transcription was successful.',
                variant: 'destructive',
                duration: 1000
              });
            }
          } catch (err) {
            console.error('[CHAT] transcription error', err);
            setIsVoiceProcessing(false);
            toast({
              title: 'Transcription Error',
              description: 'Failed to transcribe audio. Please try again.',
              variant: 'destructive',
              duration: 1000
            });
          }
        };

        recorder.start();
        setIsListening(true);
        toast({ title: 'Voice Recognition Active', description: 'Speak now…', duration: 1000 });

        // Auto stop after 5 seconds
        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          stream.getTracks().forEach(track => track.stop());
          setIsListening(false);
        }, 5000);
      } catch (err) {
        console.error('[CHAT] getUserMedia error', err);
        toast({ 
          title: 'Microphone error', 
          description: String(err), 
          variant: 'destructive', 
          duration: 3000
        });
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
      const maxLines = 5;
      const minHeight = 48; // Same as button height
      const maxHeight = minHeight + ((maxLines - 1) * lineHeight);
      
      // Set the height, but don't exceed max
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [inputValue]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  if (isCollapsed) {
    return (
      <div className="h-full bg-dark-secondary border-l border-white/5 w-12 flex flex-col items-center relative">
        <button 
          onClick={onToggleCollapse}
          className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-dark-secondary border border-white/10 rounded-full p-1 z-10 hover:bg-dark-tertiary transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex flex-col items-center justify-center h-full">
          {/* <button 
            onClick={onToggleCollapse}
            className="p-2 rounded-full bg-violet text-white hover:bg-violet-light transition-colors"
            title="Open Chat"
          >
            <Send size={18} />
          </button> */}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-dark-secondary border-l border-white/5 w-80 flex flex-col relative">
      <button 
        onClick={onToggleCollapse}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-dark-secondary border border-white/10 rounded-full p-1 z-10 hover:bg-dark-tertiary transition-colors"
      >
        <ChevronRight size={16} />
      </button>
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex justify-center items-center">
        <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-violet scrollbar-track-dark-tertiary">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/50 text-center">
              No messages yet. Start a conversation!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        
        {/* Processing indicator */}
        {(isProcessing || isVoiceProcessing) && (
          <div className="flex items-center space-x-2 p-3 bg-dark-tertiary/50 rounded-lg border border-violet/20">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-violet rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-violet rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-violet rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-white/70 text-sm">
              {isVoiceProcessing ? 'Processing voice command...' : 'Processing your message...'}
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="p-4 border-t border-white/5">
        <div className="flex flex-col gap-2 items-center">
          {/* Voice status indicators */}
          <div className="h-6 flex items-center justify-center">
            {isListeningState && (
              <div className="flex items-center space-x-2 text-violet text-sm">
                <div className="w-2 h-2 bg-violet rounded-full animate-pulse"></div>
                <span>Listening...</span>
              </div>
            )}
            {(isProcessing || isVoiceProcessing) && (
              <div className="flex items-center space-x-2 text-violet text-sm">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-violet rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-violet rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 bg-violet rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span>{isVoiceProcessing ? 'Processing voice...' : 'Processing...'}</span>
              </div>
            )}
          </div>
          
          <AudioPlayer 
            isListening={isListeningState} 
            onClick={handleToggleListening}
            disabled={isProcessing || isVoiceProcessing}
          />
          
          <form onSubmit={handleSubmit} className="flex items-start gap-2 w-full">
            <textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing || isVoiceProcessing}
              className="w-full bg-dark-tertiary text-white placeholder-white/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet resize-none overflow-y-auto scrollbar-thin disabled:opacity-50"
              style={{
                height: '48px',
                minHeight: '48px',
                maxHeight: '144px',
              }}
            />
            
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing || isVoiceProcessing}
              className="bg-violet rounded-lg p-3 text-white disabled:opacity-50 transition-opacity hover:opacity-90 active:scale-95 h-12 w-12 flex items-center justify-center flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar; 