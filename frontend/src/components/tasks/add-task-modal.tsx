import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import 'react-day-picker/dist/style.css';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreate: (task: Omit<Task, 'id'>) => void;
  initialDate?: Date;
  initialAllDay?: boolean;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreate,
  initialDate,
  initialAllDay = true
}) => {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date>(initialDate || new Date());
  const [isAllDay, setIsAllDay] = useState(initialAllDay);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Reset form when modal opens/closes or initial date changes
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setDueDate(initialDate || new Date());
      setIsAllDay(initialAllDay);
      setStartTime('09:00');
      setEndTime('10:00');
      setPriority('medium');
      setSyncToCalendar(true);
      setShowDatePicker(false);
    }
  }, [isOpen, initialDate, initialAllDay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    const newTask: Omit<Task, 'id'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      isAllDay,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      priority,
      isCompleted: false,
      syncedToCalendar: syncToCalendar,
    };

    onTaskCreate(newTask);
    onClose();
  };

  const formatDateForDisplay = (date: Date) => {
    return format(date, 'MMM d, yyyy');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              type="text"
              placeholder="Enter task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter task description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start text-left font-normal"
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                {formatDateForDisplay(dueDate)}
              </Button>
              
              {showDatePicker && (
                <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                  <DayPicker
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => {
                      if (date) {
                        setDueDate(date);
                        setShowDatePicker(false);
                      }
                    }}
                    className="p-3"
                  />
                </div>
              )}
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="all-day"
              checked={isAllDay}
              onCheckedChange={setIsAllDay}
            />
            <Label htmlFor="all-day">All Day</Label>
          </div>

          {/* Time Fields (shown only if not all day) */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors",
                    priority === p
                      ? "bg-violet text-white border-violet"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Sync to Calendar */}
          <div className="flex items-center space-x-2">
            <Switch
              id="sync-calendar"
              checked={syncToCalendar}
              onCheckedChange={setSyncToCalendar}
            />
            <Label htmlFor="sync-calendar">Sync to Calendar</Label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 bg-violet hover:bg-violet/90"
            >
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskModal; 