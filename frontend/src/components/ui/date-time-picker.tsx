"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DateTimePicker({
  date,
  setDate,
}: {
  date: Date;
  setDate: (date: Date) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  const timeOptions = React.useMemo(() => {
    const options = [];
    for (let i = 0; i < 24 * 2; i++) {
      const hour = Math.floor(i / 2);
      const minute = (i % 2) * 30;
      options.push({
        value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        label: format(new Date(2000, 0, 1, hour, minute), "hh:mm a"),
      });
    }
    return options;
  }, []);

  const handleTimeChange = (timeValue: string) => {
    const [hours, minutes] = timeValue.split(":").map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes);
    setDate(newDate);
  };

  const selectedTime = format(date, "HH:mm");

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal bg-dark-tertiary border-slate-700 text-white placeholder:text-gray-400 hover:bg-slate-700 hover:text-white",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP p") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-dark-secondary border-slate-700">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            if (selectedDate) {
              const newDate = new Date(date);
              newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
              setDate(newDate);
            }
          }}
          initialFocus
        />
        <div className="p-2 border-t border-slate-700">
          <Select onValueChange={handleTimeChange} value={selectedTime}>
            <SelectTrigger className="bg-dark-tertiary border-slate-700 text-white">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent className="bg-dark-secondary border-slate-700 text-white">
              {timeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="hover:bg-slate-700">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
 