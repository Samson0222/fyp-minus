import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, X, Hash, Tag, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import QuillEditor from './QuillEditor';

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
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Task and Tag interfaces matching TasksWorking.tsx
interface TaskTag {
  id: string;
  name: string;
  color: string;
  category: 'project' | 'department' | 'priority' | 'type' | 'status' | 'custom';
  status: 'todo' | 'inprogress' | 'done';
  tags?: TaskTag[];
  createDateTime: Date;
  lastUpdateDateTime: Date;
}

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
  tags?: TaskTag[];
  syncedToCalendar: boolean;
  createDateTime: Date;
  lastUpdateDateTime: Date;
}

// Form validation schema aligned with the backend model
const createTaskSchema = z.object({
  title: z.string()
    .min(1, 'Task title is required')
    .max(100, 'Title must be less than 100 characters'),
  description: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  type: z.enum(['event', 'todo']).default('event'),
  is_all_day: z.boolean().default(true),
  start_time: z.date().optional(),
  end_time: z.date().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['todo', 'inprogress', 'done']).default('todo'),
}).refine((data) => {
  // If it's an event, it must have a start time.
  if (data.type === 'event' && !data.start_time) {
    return false;
  }
  // If it's a timed event (not all-day), end time must be after start time.
  if (data.type === 'event' && !data.is_all_day && data.start_time && data.end_time) {
    return data.end_time > data.start_time;
  }
  return true;
}, {
  message: 'For events, a start date is required. End time must be after start time for timed events.',
  path: ['start_time'], // General path for error message
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (task: Task) => void;
  availableTags: TaskTag[];
  onCreateTag: (tag: Omit<TaskTag, 'id'>) => TaskTag;
  defaultDate?: Date | null;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  availableTags,
  onCreateTag,
  defaultDate,
}) => {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TaskTag[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#60a5fa');
  const [newTagCategory, setNewTagCategory] = useState<TaskTag['category']>('custom');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  
  // Description state for Quill editor
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Calendar state for custom date picker
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'event',
      is_all_day: true,
      start_time: new Date(),
      end_time: new Date(new Date().setHours(new Date().getHours() + 1)),
      priority: 'medium',
      status: 'todo',
    },
  });

  const { watch, setValue, control } = form;
  const taskType = watch('type');
  const isAllDay = watch('is_all_day');

  useEffect(() => {
    if (isOpen && defaultDate) {
      // Pre-fill form for "Event" type if a default date is provided
      setValue('type', 'event');
      setValue('start_time', defaultDate, { shouldValidate: true });
      // Set a default end_time, e.g., one hour after the start_time
      const defaultEndTime = new Date(defaultDate);
      defaultEndTime.setHours(defaultEndTime.getHours() + 1);
      setValue('end_time', defaultEndTime, { shouldValidate: true });
    } else if (isOpen) {
      // Default to "To-do" type if no date is provided
      setValue('type', 'todo');
    }
  }, [isOpen, defaultDate, setValue]);

  const onSubmit = async (data: CreateTaskForm) => {
    // Construct the payload matching the backend's TaskCreate model
    const payload: { [key: string]: an } = {
      title: data.title,
      description: data.description || '',
      type: data.type,
      priority: data.priority,
      status: data.status,
    };

    if (data.type === 'event') {
      if (!data.start_time) {
        form.setError("start_time", { type: "manual", message: "Start date is required for events." });
        return;
      }
      payload.is_all_day = data.is_all_day;
      payload.start_time = data.start_time.toISOString();
      // Only include end_time if it's not an all-day event
      if (!data.is_all_day && data.end_time) {
        payload.end_time = data.end_time.toISOString();
      } else {
        // For all-day events, the backend might expect the end_time to be the start of the next day.
        // Or we can just send the start_time. Let's align with the model and send start_time as end_time.
        payload.end_time = data.start_time.toISOString();
      }
    }

    try {
      const response = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create task.');
      }

      // Call the success handler passed from the parent component
      onCreateTask({} as Task); // The argument is now just a signal, not the data itself
      handleClose();

    } catch (error) {
      console.error('Failed to create task:', error);
      // Here you would use a toast notification
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedTags([]);
    setTagSearch('');
    setNewTagName('');
    setIsCreatingTag(false);
    setIsDescriptionExpanded(false);
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

  // Tag management functions
  const handleTagSelect = (tag: TaskTag) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagSearch('');
    setShowTagDropdown(false);
  };

  const handleTagRemove = (tagId: string) => {
    setSelectedTags(selectedTags.filter(t => t.id !== tagId));
  };

  const handleCreateNewTag = () => {
    if (newTagName.trim()) {
      // Auto-generate a color from a predefined palette
      const colors = [
        '#8a6bf4', '#60a5fa', '#34d399', '#fbbf24', 
        '#f87171', '#a78bfa', '#fb7185', '#38bdf8',
        '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newTag = onCreateTag({
        name: newTagName.trim(),
        color: randomColor,
        category: 'custom',
      });
      setSelectedTags([...selectedTags, newTag]);
      setNewTagName('');
      setIsCreatingTag(false);
    }
  };

  const filteredTags = availableTags.filter(tag => 
    !selectedTags.find(st => st.id === tag.id) &&
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const timeOptions = generateTimeOptions();

  // Calendar helper functions (matching TasksWorking.tsx)
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCalendarDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const selectDate = (day: number) => {
    const selectedDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    form.setValue('start_time', selectedDate);
  };

  const clearDate = () => {
    form.setValue('start_time', new Date());
    setCalendarOpen(false);
  };

  const selectToday = () => {
    const today = new Date();
    form.setValue('start_time', today);
    setCalendarDate(today);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'text-gray-400';
      case 'inprogress': return 'text-blue-400';
      case 'done': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-background-primary text-white border-slate-800 p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Create New Task or Event</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full">
            {/* Main Content: Form */}
            <div className="flex-1 p-6 overflow-y-auto">
              <FormField
                control={control}
                name="type"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormControl>
                      <ToggleGroup type="single" defaultValue="event" onValueChange={field.onChange} className="w-full">
                        <ToggleGroupItem value="event" className="w-1/2" aria-label="Create an Event">Event</ToggleGroupItem>
                        <ToggleGroupItem value="todo" className="w-1/2" aria-label="Create a To-do">To-do</ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder="e.g., Finalize project report"
                          className="text-lg bg-background-secondary border-slate-700"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date/Time Fields - Conditional on 'event' type */}
              {taskType === 'event' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                  <FormField
                    control={control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        {/* Replace with a proper DateTimePicker if available */}
                        <Input type="datetime-local" {...field} onChange={e => field.onChange(new Date(e.target.value))} className="bg-background-secondary border-slate-700" />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!isAllDay && (
                    <FormField
                      control={control}
                      name="end_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          {/* Replace with a proper DateTimePicker if available */}
                          <Input type="datetime-local" {...field} onChange={e => field.onChange(new Date(e.target.value))} className="bg-background-secondary border-slate-700" />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <div className="md:col-span-2 flex items-center space-x-2">
                     <FormField
                        control={control}
                        name="is_all_day"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel>All-day event</FormLabel>
                          </FormItem>
                        )}
                      />
                  </div>
                </div>
              )}

              {/* Description Editor */}
              <div className="my-4">
                <FormField
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <QuillEditor
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Add a description..."
                          expanded={isDescriptionExpanded}
                          minHeight="120px"
                          maxHeight="200px"
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Side Panel: Properties */}
              <div className="w-1/3 bg-background-secondary p-6 border-l border-slate-800 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Properties</h3>
                
                {/* Status */}
                <FormField
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel className="text-gray-300">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-dark-tertiary border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="todo">
                            <span className={getStatusColor('todo')}>To Do</span>
                          </SelectItem>
                          <SelectItem value="inprogress">
                            <span className={getStatusColor('inprogress')}>In Progress</span>
                          </SelectItem>
                          <SelectItem value="done">
                            <span className={getStatusColor('done')}>Done</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {/* Priority */}
                <FormField
                  control={control}
                  name="priority"
                  render={({ field }) => {
                    const getPriorityDisplay = (value: string) => {
                      switch (value) {
                        case 'high':
                          return { color: 'bg-red-500', label: 'High' };
                        case 'medium':
                          return { color: 'bg-yellow-500', label: 'Medium' };
                        case 'low':
                          return { color: 'bg-green-500', label: 'Low' };
                        default:
                          return { color: 'bg-yellow-500', label: 'Medium' };
                      }
                    };
                    
                    const currentDisplay = getPriorityDisplay(field.value);
                    
                    return (
                      <FormItem>
                        <FormLabel className="text-gray-300">Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                                <SelectTrigger className="bg-dark-tertiary border-gray-600 text-white">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${currentDisplay.color}`}></div>
                                    <span>{currentDisplay.label}</span>
                                  </div>
                            </SelectTrigger>
                          </FormControl>
                        </Select>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    );
                  }}
                />

                {/* Tags - Temporarily Hidden */}
                {/*
                <div className="mb-4">
                  <FormLabel>Tags</FormLabel>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTags.map(tag => (
                      <div key={tag.id} className="flex items-center rounded-full px-3 py-1 text-sm" style={{ backgroundColor: tag.color }}>
                        {tag.name}
                        <button type="button" onClick={() => handleTagRemove(tag.id)} className="ml-2 text-white hover:text-gray-300">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="relative mt-2">
                    <Input
                      type="text"
                      placeholder="Add or create a tag..."
                      value={tagSearch}
                      onChange={(e) => {
                        setTagSearch(e.target.value);
                        setShowTagDropdown(true);
                      }}
                      onFocus={() => setShowTagDropdown(true)}
                      className="bg-background-primary border-slate-700"
                    />
                    {showTagDropdown && (
                      <div className="absolute z-10 w-full bg-background-primary border border-slate-700 rounded-md mt-1 shadow-lg">
                        {filteredTags.map(tag => (
                          <div key={tag.id} onClick={() => handleTagSelect(tag)} className="p-2 hover:bg-background-tertiary cursor-pointer">
                            {tag.name}
                          </div>
                        ))}
                        {tagSearch && !isCreatingTag && (
                          <div onClick={() => setIsCreatingTag(true)} className="p-2 text-blue-400 hover:bg-background-tertiary cursor-pointer">
                            <Plus size={14} className="inline mr-2" />
                            Create new tag "{tagSearch}"
                          </div>
                        )}
                        {isCreatingTag && (
                          <div className="p-2">
                            <Input
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              placeholder="New tag name"
                              className="mb-2 bg-background-secondary border-slate-700"
                            />
                            <Button type="button" onClick={handleCreateNewTag} className="w-full">
                              Add Tag
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                */}

              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="border-t border-gray-700 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700 text-white"
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