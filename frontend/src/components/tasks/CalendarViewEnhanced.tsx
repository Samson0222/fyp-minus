import React, { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Task, convertTaskToCalendarEvent, CalendarEvent } from '@/types/task';
import { TaskAPI } from '@/lib/api/tasks';
import { auth } from '@/lib/supabase';
import { format } from 'date-fns';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface CalendarViewEnhancedProps {
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
}

interface QuickCreateState {
  isOpen: boolean;
  date: Date | null;
  allDay: boolean;
  position?: { x: number; y: number };
}

const CalendarViewEnhanced: React.FC<CalendarViewEnhancedProps> = ({
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [quickCreate, setQuickCreate] = useState<QuickCreateState>({
    isOpen: false,
    date: null,
    allDay: true
  });
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // Initialize user and load tasks
  useEffect(() => {
    const initializeCalendar = async () => {
      try {
        setLoading(true);
        const currentUser = await auth.getCurrentUser();
        setUser(currentUser);
        
        if (currentUser) {
          await loadTasks();
        }
      } catch (error) {
        console.error('Error initializing calendar:', error);
        toast({
          title: "Error",
          description: "Failed to load calendar. Please check your connection.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeCalendar();
  }, []);

  // Load tasks from Supabase
  const loadTasks = async () => {
    try {
      const allTasks = await TaskAPI.getAllTasks();
      setTasks(allTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks.",
        variant: "destructive",
      });
    }
  };

  // Transform tasks into FullCalendar events
  const calendarEvents = useMemo(() => {
    return tasks.map(convertTaskToCalendarEvent);
  }, [tasks]);

  // Handle date click for quick task creation
  const handleDateClick = (arg: any) => {
    const clickedDate = new Date(arg.date);
    const allDay = arg.allDay;
    
    setQuickCreate({
      isOpen: true,
      date: clickedDate,
      allDay: allDay,
    });
  };

  // Handle date selection (click and drag)
  const handleDateSelect = (arg: any) => {
    const startDate = new Date(arg.start);
    const allDay = arg.allDay;
    
    setQuickCreate({
      isOpen: true,
      date: startDate,
      allDay: allDay,
    });
  };

  // Create quick task
  const handleQuickTaskCreate = async () => {
    if (!quickTaskTitle.trim() || !quickCreate.date) return;

    setIsCreating(true);
    try {
      const newTask = await TaskAPI.quickCreateTask(
        quickCreate.date,
        quickTaskTitle.trim(),
        quickCreate.allDay,
        quickCreate.allDay ? undefined : 60 // 1 hour default for timed events
      );

      setTasks(prev => [...prev, newTask]);
      onTaskCreated?.(newTask);
      
      toast({
        title: "Task Created",
        description: `"${newTask.title}" has been added to your calendar.`,
      });

      // Close modal and reset
      setQuickCreate({ isOpen: false, date: null, allDay: true });
      setQuickTaskTitle('');
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle event click
  const handleEventClick = (clickInfo: any) => {
    const taskId = clickInfo.event.id;
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      // TODO: Open task details modal or navigate to task edit
      console.log('Task clicked:', task);
      toast({
        title: task.title,
        description: task.description || "Click to edit this task",
      });
    }
  };

  // Handle event drag and drop
  const handleEventDrop = async (dropInfo: any) => {
    const taskId = dropInfo.event.id;
    const newStart = new Date(dropInfo.event.start);
    const newEnd = dropInfo.event.end ? new Date(dropInfo.event.end) : undefined;

    try {
      const updatedTask = await TaskAPI.updateTask(taskId, {
        start_at: newStart.toISOString(),
        end_at: newEnd?.toISOString(),
      });

      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));

      onTaskUpdated?.(updatedTask);
      
      toast({
        title: "Task Updated",
        description: "Task has been moved to the new date/time.",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      dropInfo.revert(); // Revert the drag operation
      toast({
        title: "Error",
        description: "Failed to move task. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle event resize
  const handleEventResize = async (resizeInfo: any) => {
    const taskId = resizeInfo.event.id;
    const newEnd = new Date(resizeInfo.event.end);

    try {
      const updatedTask = await TaskAPI.updateTask(taskId, {
        end_at: newEnd.toISOString(),
      });

      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));

      onTaskUpdated?.(updatedTask);
      
      toast({
        title: "Task Updated",
        description: "Task duration has been updated.",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      resizeInfo.revert(); // Revert the resize operation
      toast({
        title: "Error",
        description: "Failed to resize task. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle keyboard shortcut for quick create
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickTaskCreate();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-violet" />
        <span className="ml-2 text-white">Loading calendar...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-white">
          <h3 className="text-lg font-semibold mb-4">Authentication Required</h3>
          <p className="mb-6">Please sign in to view your calendar.</p>
          <SimpleAuth onAuthenticated={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-white">Calendar</h2>
        <Button 
          onClick={() => setQuickCreate({ isOpen: true, date: new Date(), allDay: true })}
          className="flex items-center gap-2 bg-violet hover:bg-violet/90 text-white"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Calendar */}
      <div className="bg-dark-tertiary rounded-lg border border-white/10 p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          events={calendarEvents}
          dateClick={handleDateClick}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          selectable={true}
          selectMirror={true}
          editable={true}
          droppable={true}
          dayMaxEvents={true}
          weekends={true}
          height="auto"
          eventClassNames="cursor-pointer"
          eventDisplay="block"
          eventTextColor="white"
          eventBorderWidth={0}
          dayHeaderClassNames="text-gray-400 font-medium py-2"
          dayCellClassNames="hover:bg-gray-800/50 cursor-pointer transition-colors"
          eventDidMount={(info) => {
            const event = info.event;
            const element = info.el;
            
            // Style completed tasks
            if (event.extendedProps.status === 'done') {
              element.style.opacity = '0.6';
              element.style.textDecoration = 'line-through';
            }
            
            // Add tooltip with description
            if (event.extendedProps.description) {
              element.title = event.extendedProps.description;
            }

            // Add voice command indicator
            if (event.extendedProps.created_via === 'voice') {
              element.classList.add('voice-created');
              element.style.border = '2px solid #a855f7';
            }
          }}
        />
      </div>

      {/* Priority Legend */}
      <div className="flex items-center gap-6 text-sm text-white/70">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>High Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>Medium Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Low Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-purple-500 rounded"></div>
          <span>Voice Created</span>
        </div>
      </div>

      {/* Quick Create Modal */}
      <Dialog open={quickCreate.isOpen} onOpenChange={(open) => {
        if (!open) {
          setQuickCreate({ isOpen: false, date: null, allDay: true });
          setQuickTaskTitle('');
        }
      }}>
        <DialogContent className="bg-dark-secondary border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              Create Task {quickCreate.date && `- ${format(quickCreate.date, 'MMM d, yyyy')}`}
              {!quickCreate.allDay && ` at ${format(quickCreate.date!, 'h:mm a')}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter task title..."
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              className="bg-dark-tertiary border-white/10 text-white placeholder:text-white/50"
              disabled={isCreating}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleQuickTaskCreate}
                disabled={!quickTaskTitle.trim() || isCreating}
                className="flex-1 bg-violet hover:bg-violet/90 text-white"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Task'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setQuickCreate({ isOpen: false, date: null, allDay: true })}
                className="border-white/10 text-white hover:bg-white/10"
                disabled={isCreating}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Simple Authentication Component
const SimpleAuth: React.FC<{ onAuthenticated: () => void }> = ({ onAuthenticated }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      if (isLogin) {
        await auth.signIn(email, password);
        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        });
      } else {
        await auth.signUp(email, password);
        toast({
          title: "Account created!",
          description: "You have been signed up successfully.",
        });
      }
      onAuthenticated();
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <form onSubmit={handleAuth} className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-dark-tertiary border-white/10 text-white placeholder:text-white/50"
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-dark-tertiary border-white/10 text-white placeholder:text-white/50"
          required
        />
        <Button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full bg-violet hover:bg-violet/90 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {isLogin ? 'Signing in...' : 'Signing up...'}
            </>
          ) : (
            isLogin ? 'Sign In' : 'Sign Up'
          )}
        </Button>
      </form>
      <p className="mt-4 text-center text-white/70 text-sm">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-violet hover:underline"
          disabled={loading}
        >
          {isLogin ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  );
};

export default CalendarViewEnhanced; 