
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import SecondaryButton from "@/components/ui/SecondaryButton";

interface MoodSelectorProps {
  selectedMood: string;
  onChange: (mood: string) => void;
}

const moods = ["Professional", "Creative", "Friendly", "Direct", "Enthusiastic", "Analytical", "Poetic", "Humorous"];

const MoodSelector: React.FC<MoodSelectorProps> = ({
  selectedMood,
  onChange
}) => {
  return (
    <div className="flex justify-center py-2">
      <div className="flex gap-2 flex-wrap justify-center">
        {moods.map(mood => (
          <SecondaryButton 
            key={mood} 
            active={selectedMood === mood} 
            onClick={() => onChange(mood)} 
            className="whitespace-nowrap text-xs px-3 py-1"
          >
            {mood}
          </SecondaryButton>
        ))}
      </div>
    </div>
  );
};

export default MoodSelector;
