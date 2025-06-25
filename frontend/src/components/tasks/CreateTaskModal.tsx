import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

// Task interface matching the one in TasksWorking.tsx
export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'inprogress' | 'done';
  syncedToCalendar: boolean;
  createDateTime: Date;
  lastUpdateDateTime: Date;
}

// Form validation schema
const createTaskSchema = z.object({
  title: z.string()
    .min(1, 'Task title is required')
    .max(100, 'Title must be less than 100 characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  dueDate: z.date({
    required_error: 'Due date is required',
  }),
  isAllDay: z.boolean().default(true),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  syncedToCalendar: z.boolean().default(true),
}).refine((data) => {
  // If not all day, both start and end times should be provided
  if (!data.isAllDay) {
    if (!data.startTime || !data.endTime) {
      return false;
    }
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(data.startTime) || !timeRegex.test(data.endTime)) {
      return false;
    }
    // Validate that end time is after start time
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  }
  return true;
}, {
  message: 'Invalid time configuration. End time must be after start time.',
  path: ['endTime'],
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (task: Task) => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
}) => {
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      dueDate: new Date(),
      isAllDay: true,
      startTime: '09:00',
      endTime: '10:00',
      priority: 'medium',
      syncedToCalendar: true,
    },
  });

  const { watch, setValue } = form;
  const isAllDay = watch('isAllDay');

  const onSubmit = (data: CreateTaskForm) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description || undefined,
      dueDate: data.dueDate,
      isAllDay: data.isAllDay,
      startTime: data.isAllDay ? undefined : data.startTime,
      endTime: data.isAllDay ? undefined : data.endTime,
      priority: data.priority,
      status: 'todo',
      syncedToCalendar: data.syncedToCalendar,
      createDateTime: new Date(),
      lastUpdateDateTime: new Date(),
    };

    onCreateTask(newTask);
    form.reset();
    onClose();
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-dark-secondary border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-violet-500" />
            Create New Task
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Task Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter task title..."
                      className="bg-dark-tertiary border-gray-600 text-white placeholder:text-gray-400 focus:border-violet-500 focus:ring-violet-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a description..."
                      className="bg-dark-tertiary border-gray-600 text-white placeholder:text-gray-400 focus:border-violet-500 focus:ring-violet-500 min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            {/* Due Date */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Due Date *</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-dark-tertiary border-gray-600 text-white hover:bg-dark-tertiary hover:border-violet-500",
                            !field.value && "text-gray-400"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-dark-secondary border-gray-700" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setCalendarOpen(false);
                        }}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                        className="bg-dark-secondary text-white"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            {/* All Day Toggle */}
            <FormField
              control={form.control}
              name="isAllDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-600 p-4 bg-dark-tertiary">
                  <div className="space-y-0.5">
                    <FormLabel className="text-white font-medium">All Day</FormLabel>
                    <div className="text-sm text-gray-400">
                      This task doesn't have specific start and end times
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-violet-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Time Fields (only show if not all day) */}
            {!isAllDay && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Start Time
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-dark-tertiary border-gray-600 text-white focus:border-violet-500">
                            <SelectValue placeholder="Select start time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-dark-secondary border-gray-700 max-h-48">
                          {timeOptions.map((time) => (
                            <SelectItem 
                              key={time} 
                              value={time}
                              className="text-white hover:bg-dark-tertiary focus:bg-dark-tertiary"
                            >
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        End Time
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-dark-tertiary border-gray-600 text-white focus:border-violet-500">
                            <SelectValue placeholder="Select end time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-dark-secondary border-gray-700 max-h-48">
                          {timeOptions.map((time) => (
                            <SelectItem 
                              key={time} 
                              value={time}
                              className="text-white hover:bg-dark-tertiary focus:bg-dark-tertiary"
                            >
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-dark-tertiary border-gray-600 text-white focus:border-violet-500">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-dark-secondary border-gray-700">
                      <SelectItem value="low" className="text-white hover:bg-dark-tertiary focus:bg-dark-tertiary">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-400" />
                          <span>Low Priority</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medium" className="text-white hover:bg-dark-tertiary focus:bg-dark-tertiary">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-yellow-400" />
                          <span>Medium Priority</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="high" className="text-white hover:bg-dark-tertiary focus:bg-dark-tertiary">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-400" />
                          <span>High Priority</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            {/* Sync to Calendar */}
            <FormField
              control={form.control}
              name="syncedToCalendar"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-600 p-4 bg-dark-tertiary">
                  <div className="space-y-0.5">
                    <FormLabel className="text-white font-medium">Sync to Calendar</FormLabel>
                    <div className="text-sm text-gray-400">
                      Automatically add this task to your calendar
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-violet-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="bg-transparent border-gray-600 text-gray-300 hover:bg-dark-tertiary hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-violet-500 hover:bg-violet-600 text-white font-medium"
              >
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskModal; 