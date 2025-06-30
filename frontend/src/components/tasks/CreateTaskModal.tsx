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

// Task and Tag interfaces matching TasksWorking.tsx
interface TaskTag {
  id: string;
  name: string;
  color: string;
  category: 'project' | 'department' | 'priority' | 'type' | 'status' | 'custom';
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

// Form validation schema
const createTaskSchema = z.object({
  title: z.string()
    .min(1, 'Task title is required')
    .max(100, 'Title must be less than 100 characters'),
  description: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  dueDate: z.date({
    required_error: 'Due date is required',
  }),
  isAllDay: z.boolean().default(true),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['todo', 'inprogress', 'done']).default('todo'),
  syncedToCalendar: z.boolean().default(true),
}).refine((data) => {
  if (!data.isAllDay) {
    if (!data.startTime || !data.endTime) {
      return false;
    }
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(data.startTime) || !timeRegex.test(data.endTime)) {
      return false;
    }
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
  availableTags: TaskTag[];
  onCreateTag: (tag: Omit<TaskTag, 'id'>) => TaskTag;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  availableTags,
  onCreateTag,
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
      dueDate: new Date(),
      isAllDay: true,
      startTime: '09:00',
      endTime: '10:00',
      priority: 'medium',
      status: 'todo',
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
      status: data.status,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      syncedToCalendar: data.syncedToCalendar,
      createDateTime: new Date(),
      lastUpdateDateTime: new Date(),
    };

    onCreateTask(newTask);
    handleClose();
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
    form.setValue('dueDate', selectedDate);
  };

  const clearDate = () => {
    form.setValue('dueDate', new Date());
    setCalendarOpen(false);
  };

  const selectToday = () => {
    const today = new Date();
    form.setValue('dueDate', today);
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
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-dark-secondary border-gray-700">
        <style>
          {`
            [contenteditable]:empty:before {
              content: attr(data-placeholder);
              color: #6b7280;
              pointer-events: none;
            }
            [contenteditable]:focus:before {
              display: none;
            }
            
            /* Rich text editor styles */
            [contenteditable] h1 {
              font-size: 2em;
              font-weight: bold;
              margin: 0.67em 0;
            }
            [contenteditable] h2 {
              font-size: 1.5em;
              font-weight: bold;
              margin: 0.75em 0;
            }
            [contenteditable] h3 {
              font-size: 1.2em;
              font-weight: bold;
              margin: 0.83em 0;
            }
            [contenteditable] p {
              margin: 0.5em 0;
            }
            [contenteditable] blockquote {
              border-left: 4px solid #8a6bf4;
              padding-left: 16px;
              margin: 16px 0;
              font-style: italic;
            }
            [contenteditable] pre {
              background-color: #1f2937;
              border: 1px solid #374151;
              border-radius: 6px;
              padding: 12px;
              font-family: monospace;
              font-size: 14px;
              overflow-x: auto;
              margin: 16px 0;
            }
            [contenteditable] code {
              font-family: monospace;
              font-size: 14px;
            }
            [contenteditable] a {
              color: #8a6bf4;
              text-decoration: underline;
            }
            [contenteditable] a:hover {
              color: #a78bfa;
            }
            [contenteditable] ul, [contenteditable] ol {
              margin: 0.5em 0;
              padding-left: 2em;
            }
            [contenteditable] li {
              margin: 0.25em 0;
            }
          `}
        </style>
        <DialogHeader className="border-b border-gray-700 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-medium text-white">
              Create Task
          </DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Task Title */}
            <div className="space-y-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                                          <input
                        placeholder="Task name"
                        className="bg-transparent border-none !text-2xl !font-semibold text-white placeholder:text-gray-500 p-0 !h-auto focus-visible:ring-0 focus-visible:ring-offset-0 w-full outline-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            </div>

            {/* Description - Quill Rich Text Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Description</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  {isDescriptionExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </div>
              
            <FormField
              control={form.control}
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

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 pt-4 border-t border-gray-700">
              
              {/* Tags - Full Width */}
              <div className="md:col-span-6">
                <label className="text-sm font-medium text-gray-300 block mb-3">Tags</label>
                
                {/* Selected Tags Panel */}
                <div className="mb-4">
                  {selectedTags.length > 0 ? (
                    <div className="bg-dark-tertiary/50 border border-gray-600 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2">Selected ({selectedTags.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedTags
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium text-[#8a6bf4] border transition-colors"
                              style={{ backgroundColor: 'rgba(138, 107, 244, 0.1)', borderColor: 'rgba(138, 107, 244, 0.3)' }}
                            >
                              {tag.name}
                              <button
                                type="button"
                                onClick={() => handleTagRemove(tag.id)}
                                className="hover:bg-white/10 rounded p-0.5 text-[#8a6bf4]"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-dark-tertiary/30 border border-gray-700 border-dashed rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">No tags selected</div>
                    </div>
                  )}
                </div>

                {/* Tag Management Panel */}
                <div className="space-y-3">
                  {/* Search Bar + Create Button */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Search tags..."
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        className="bg-dark-tertiary border-gray-600 text-white placeholder:text-gray-400 pl-8"
                      />
                      <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <Hash className="h-4 w-4" />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setIsCreatingTag(true)}
                      className="bg-violet-600 hover:bg-violet-700 flex items-center gap-2 px-4"
                    >
                      <Plus className="h-4 w-4" />
                      New Tag
                    </Button>
                  </div>

                  {/* Available Tags Grid */}
                  <div className="bg-dark-tertiary border border-gray-600 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <div className="text-xs text-gray-400 mb-2">
                      Available ({filteredTags.length})
                    </div>
                    {filteredTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {filteredTags
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleTagSelect(tag)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium text-[#8a6bf4] border border-gray-600 hover:border-violet-500 transition-colors"
                              style={{ backgroundColor: 'rgba(138, 107, 244, 0.05)' }}
                            >
                              <div
                                className="w-2 h-2 rounded"
                                style={{ backgroundColor: 'rgba(138, 107, 244, 0.5)' }}
                              />
                              {tag.name}
                            </button>
                          ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 text-center py-2">
                        {tagSearch ? `No tags found for "${tagSearch}"` : 'No tags available'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Create Tag Modal */}
                {isCreatingTag && (
                  <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setIsCreatingTag(false);
                        setNewTagName('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsCreatingTag(false);
                        setNewTagName('');
                      }
                    }}
                  >
                    <div className="bg-dark-secondary border border-gray-600 rounded-lg p-6 w-full max-w-sm mx-4">
                      <h3 className="text-lg font-medium text-white mb-4">Create New Tag</h3>
                      <div className="space-y-4">
                        <div>
                          <Input
                            placeholder="Enter tag name..."
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newTagName.trim()) {
                                handleCreateNewTag();
                              }
                              if (e.key === 'Escape') {
                                setIsCreatingTag(false);
                                setNewTagName('');
                              }
                            }}
                            className="bg-dark-tertiary border-gray-600 text-white text-base"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <Button
                          type="button"
                          onClick={handleCreateNewTag}
                          disabled={!newTagName.trim()}
                          className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
                        >
                          Create
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsCreatingTag(false);
                            setNewTagName('');
                          }}
                          className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* Due Date */}
              <div className="md:col-span-2">
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                      <FormLabel className="text-gray-300">Due Date</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                              className="w-full justify-start text-left font-normal bg-dark-tertiary border-gray-600 text-white hover:bg-gray-700"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-dark-tertiary border-gray-600" align="start">
                          <div className="p-4 min-w-80">
                            {/* Calendar Header */}
                            <div className="flex items-center justify-between mb-4">
                              <button
                                type="button"
                                onClick={() => navigateMonth('prev')}
                                className="p-2 hover:bg-white/5 rounded transition-colors"
                              >
                                <ChevronLeft size={16} className="text-white/70 hover:text-white" />
                              </button>
                              
                              <div className="text-sm font-medium text-white">
                                {['January', 'February', 'March', 'April', 'May', 'June',
                                  'July', 'August', 'September', 'October', 'November', 'December'
                                ][calendarDate.getMonth()]} {calendarDate.getFullYear()}
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => navigateMonth('next')}
                                className="p-2 hover:bg-white/5 rounded transition-colors"
                              >
                                <ChevronRight size={16} className="text-white/70 hover:text-white" />
                              </button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="space-y-2">
                              {/* Day Headers */}
                              <div className="grid grid-cols-7 gap-1 text-xs text-white/60 font-medium">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                  <div key={index} className="text-center py-2">
                                    {day}
                                  </div>
                                ))}
                              </div>
                              
                              {/* Calendar Days */}
                              <div className="grid grid-cols-7 gap-1">
                                {(() => {
                                  const daysInMonth = getDaysInMonth(calendarDate);
                                  const firstDayOfMonth = getFirstDayOfMonth(calendarDate);
                                  const days = [];
                                  const totalCells = Math.ceil((daysInMonth + firstDayOfMonth) / 7) * 7;
                                  
                                  // Previous month's trailing days
                                  for (let i = 0; i < firstDayOfMonth; i++) {
                                    days.push(null);
                                  }
                                  
                                  // Current month's days
                                  for (let day = 1; day <= daysInMonth; day++) {
                                    days.push(day);
                                  }
                                  
                                  // Next month's leading days
                                  while (days.length < totalCells) {
                                    days.push(null);
                                  }

                                  return days.map((day, index) => {
                                    if (day === null) {
                                      return <div key={index} className="aspect-square" />;
                                    }
                                    
                                    const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                                    const isSelected = field.value && isSameDay(date, field.value);
                                    const isTodayDate = isToday(date);
                                    
                                    return (
                                      <button
                                        key={index}
                                        type="button"
                                        onClick={() => {
                                          selectDate(day);
                                          field.onChange(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day));
                                        }}
                                        className={`aspect-square text-sm rounded transition-colors flex items-center justify-center ${
                                          isSelected
                                            ? 'bg-violet text-white font-medium'
                                            : isTodayDate
                                            ? 'bg-white/10 text-white font-medium border border-white/20'
                                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                                        }`}
                                      >
                                        {day}
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/10">
                              <button
                                type="button"
                                onClick={clearDate}
                                className="px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded transition-colors"
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                onClick={selectToday}
                                className="px-3 py-1.5 text-xs bg-violet/20 text-violet-300 hover:bg-violet/30 rounded transition-colors"
                              >
                                Today
                              </button>
                            </div>
                            
                            {/* Divider */}
                            <div className="border-t border-gray-600 my-4"></div>

            {/* All Day Toggle */}
            <FormField
              control={form.control}
              name="isAllDay"
                              render={({ field: allDayField }) => (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-300">All Day</span>
                    <Switch
                                    checked={allDayField.value}
                                    onCheckedChange={allDayField.onChange}
                    />
                                </div>
              )}
            />

                            {/* Start Time & End Time (when not All Day) */}
            {!isAllDay && (
                              <div className="grid grid-cols-2 gap-3 mt-4">
                <FormField
                  control={form.control}
                  name="startTime"
                                  render={({ field: startField }) => (
                                    <div>
                                      <label className="text-xs text-gray-400 block mb-1">Start Time</label>
                                      <Select onValueChange={startField.onChange} defaultValue={startField.value}>
                                        <SelectTrigger className="bg-dark-secondary border-gray-500 text-white text-sm h-8">
                                          <SelectValue placeholder="Start" />
                          </SelectTrigger>
                                        <SelectContent className="max-h-48">
                          {timeOptions.map((time) => (
                                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                                    </div>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                                  render={({ field: endField }) => (
                                    <div>
                                      <label className="text-xs text-gray-400 block mb-1">End Time</label>
                                      <Select onValueChange={endField.onChange} defaultValue={endField.value}>
                                        <SelectTrigger className="bg-dark-secondary border-gray-500 text-white text-sm h-8">
                                          <SelectValue placeholder="End" />
                          </SelectTrigger>
                                        <SelectContent className="max-h-48">
                          {timeOptions.map((time) => (
                                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                                    </div>
                                  )}
                                />
                              </div>
                            )}

                            {/* Sync to Calendar Toggle */}
                            <FormField
                              control={form.control}
                              name="syncedToCalendar"
                              render={({ field: syncField }) => (
                                <div className="flex items-center justify-between mt-4">
                                  <span className="text-sm text-gray-300">Sync to Calendar</span>
                                  <Switch
                                    checked={syncField.value}
                                    onCheckedChange={syncField.onChange}
                                  />
                                </div>
                              )}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
              </div>

            {/* Priority */}
              <div className="md:col-span-2">
            <FormField
              control={form.control}
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
                          <SelectContent>
                            <SelectItem value="high">
                        <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <span className="text-white">High</span>
                        </div>
                      </SelectItem>
                            <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                <span className="text-white">Medium</span>
                        </div>
                      </SelectItem>
                            <SelectItem value="low">
                        <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-white">Low</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-red-400" />
                </FormItem>
                    );
                  }}
            />
              </div>

              {/* Status */}
              <div className="md:col-span-2">
            <FormField
              control={form.control}
                  name="status"
              render={({ field }) => (
                    <FormItem>
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