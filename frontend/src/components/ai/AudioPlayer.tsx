import React from "react";
import { cn } from "@/lib/utils";
import { Mic } from "lucide-react";

interface AudioPlayerProps {
  isListening: boolean;
  onClick: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ isListening, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-14 h-14 rounded-full bg-gradient-violet flex items-center justify-center transition-all shadow-[0_0_15px_rgba(138,107,244,0.5)]",
        isListening ? "scale-105" : "hover:scale-105 active:scale-95"
      )}
    >
      {/* Display microphone icon instead of the M logo */}
      <Mic className="text-white" size={24} />
      
      {isListening && (
        <>
          <span className="absolute inset-0 rounded-full border-4 border-violet-light animate-pulse-ring"></span>
          <div className="absolute flex h-5 items-end space-x-1 justify-center">
            <span className="h-full w-1 bg-white animate-wave-1 origin-bottom"></span>
            <span className="h-full w-1 bg-white animate-wave-2 origin-bottom"></span>
            <span className="h-full w-1 bg-white animate-wave-3 origin-bottom"></span>
            <span className="h-full w-1 bg-white animate-wave-4 origin-bottom"></span>
            <span className="h-full w-1 bg-white animate-wave-5 origin-bottom"></span>
          </div>
        </>
      )}
    </button>
  );
};

export default AudioPlayer;
