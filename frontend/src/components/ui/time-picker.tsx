import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
}

const generateTimeOptions = () => {
  const options = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 15) {
      const hour = i.toString().padStart(2, '0');
      const minute = j.toString().padStart(2, '0');
      options.push(`${hour}:${minute}`);
    }
  }
  return options;
};

export function TimePicker({ date, setDate, className }: TimePickerProps) {
  const timeOptions = React.useMemo(() => generateTimeOptions(), []);
  const [isOpen, setIsOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const currentTime = date 
    ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    : "";
  
  React.useEffect(() => {
    if (isOpen && contentRef.current) {
      // Radix UI uses aria-selected to mark the selected item
      const selectedItem = contentRef.current.querySelector<HTMLDivElement>('[aria-selected="true"]');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "center" });
      }
    }
  }, [isOpen]);

  const handleTimeChange = (value: string) => {
    if (date) {
      const [hours, minutes] = value.split(':').map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes);
      setDate(newDate);
    }
  };

  return (
    <Select onValueChange={handleTimeChange} value={currentTime} onOpenChange={setIsOpen}>
      <SelectTrigger
        className={cn(
          "w-full justify-start text-left font-normal bg-dark-tertiary border-slate-700 text-white hover:bg-dark-secondary hover:text-white",
          !date && "text-muted-foreground",
          className
        )}
      >
        <Clock className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Select time" />
      </SelectTrigger>
      <SelectContent 
        ref={contentRef}
        className="bg-dark-secondary border-slate-700 text-white max-h-[10.5rem] overflow-y-auto"
      >
        {timeOptions.map(option => (
          <SelectItem 
            key={option} 
            value={option} 
            className={cn(
              "focus:bg-slate-700",
              currentTime === option && "bg-violet-600 text-white focus:bg-violet-700"
            )}
          >
            {new Date(`1970-01-01T${option}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 