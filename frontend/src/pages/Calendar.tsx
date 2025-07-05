import React, { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Plus,
  Sync,
  SyncOff
} from 'lucide-react';

// Types for our calendar data
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end?: Date;
  all_day: boolean;
  location?: string;
  attendees: string[];
  creator_email?: string;
  html_link?: string;
  status: string;
  source: 'google_calendar';
}

interface LocalTask {
  id: string;
  title: string;
  description?: string;
  start_at?: Date;
  end_at?: Date;
  is_all_day: boolean;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'inprogress' | 'done';
  is_synced_to_google: boolean;
  google_calendar_event_id?: string;
  source: 'local_task';
}

interface CalendarState {
  googleEvents: GoogleCalendarEvent[];
  localTasks: LocalTask[];
  authStatus: {
    authenticated: boolean;
    message: string;
  };
  loading: boolean;
  lastRefresh?: Date;
}

const Calendar: React.FC = () => {
  const [calendarState, setCalendarState] = useState<CalendarState>({
    googleEvents: [],
    localTasks: [],
    authStatus: { authenticated: false, message: 'Checking...' },
    loading: true
  });
  
  const { toast } = useToast();

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load calendar data when authenticated
  useEffect(() => {
    if (calendarState.authStatus.authenticated) {
      loadCalendarData();
    }
  }, [calendarState.authStatus.authenticated]);

  // Handle URL parameters (auth success/error from OAuth redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    const errorMessage = urlParams.get('message');

    if (authResult === 'success') {
      toast({
        title: "Google Calendar Connected! 🎉",
        description: "Your Google Calendar has been successfully connected.",
      });
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // Recheck auth status
      checkAuthStatus();
    } else if (authResult === 'error') {
      toast({
        title: "Connection Failed",
        description: errorMessage || "Failed to connect Google Calendar. Please try again.",
        variant: "destructive",
      });
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/v1/auth/google/calendar/status');
      const data = await response.json();
      
      setCalendarState(prev => ({
        ...prev,
        authStatus: {
          authenticated: data.authenticated,
          message: data.message
        },
        loading: false
      }));
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setCalendarState(prev => ({
        ...prev,
        authStatus: {
          authenticated: false,
          message: 'Failed to check authentication status'
        },
        loading: false
      }));
    }
  };

  const connectToGoogleCalendar = () => {
    // Redirect to backend OAuth initiation endpoint
    window.location.href = '/api/v1/auth/google/calendar/login';
  };

  const disconnectGoogleCalendar = async () => {
    try {
      const response = await fetch('/api/v1/auth/google/calendar/disconnect', {
        method: 'POST'
      });
      
      if (response.ok) {
        setCalendarState(prev => ({
          ...prev,
          authStatus: {
            authenticated: false,
            message: 'Google Calendar disconnected'
          },
          googleEvents: []
        }));
        
        toast({
          title: "Disconnected",
          description: "Google Calendar has been disconnected.",
        });
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Google Calendar.",
        variant: "destructive",
      });
    }
  };

  const loadCalendarData = async () => {
    setCalendarState(prev => ({ ...prev, loading: true }));
    
    try {
      // Load Google Calendar events and local tasks in parallel
      const [googleResponse, localResponse] = await Promise.allSettled([
        fetch('/api/v1/calendar/events'),
        // Use the existing Supabase API from TaskAPI
        import('@/lib/api/tasks').then(({ TaskAPI }) => TaskAPI.getAllTasks())
      ]);

      let googleEvents: GoogleCalendarEvent[] = [];
      let localTasks: LocalTask[] = [];

      // Handle Google Calendar events
      if (googleResponse.status === 'fulfilled' && googleResponse.value.ok) {
        const googleData = await googleResponse.value.json();
        googleEvents = googleData.map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: event.end ? new Date(event.end) : undefined,
          source: 'google_calendar' as const
        }));
        console.log(`Loaded ${googleEvents.length} Google Calendar events`);
      } else {
        console.warn('Failed to load Google Calendar events:', 
          googleResponse.status === 'fulfilled' ? 
            await googleResponse.value.text() : 
            googleResponse.reason
        );
      }

      // Handle local tasks from Supabase
      if (localResponse.status === 'fulfilled') {
        const tasksData = localResponse.value;
        localTasks = tasksData.map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          start_at: task.start_at,
          end_at: task.end_at,
          is_all_day: task.is_all_day,
          priority: task.priority,
          status: task.status,
          is_synced_to_google: task.is_synced_to_google || false,
          google_calendar_event_id: task.google_calendar_event_id,
          source: 'local_task' as const
        }));
        console.log(`Loaded ${localTasks.length} local tasks`);
      } else {
        console.warn('Failed to load local tasks:', localResponse.reason);
        // Don't treat this as a critical error since Google Calendar might still work
      }

      setCalendarState(prev => ({
        ...prev,
        googleEvents,
        localTasks,
        loading: false,
        lastRefresh: new Date()
      }));

      // Show success toast with summary
      toast({
        title: "Calendar Updated",
        description: `Loaded ${googleEvents.length} Google events and ${localTasks.length} local tasks`,
      });

    } catch (error) {
      console.error('Failed to load calendar data:', error);
      setCalendarState(prev => ({ ...prev, loading: false }));
      toast({
        title: "Error",
        description: "Failed to load calendar data. Please try refreshing.",
        variant: "destructive",
      });
    }
  };

  const refreshCalendarData = () => {
    if (calendarState.authStatus.authenticated) {
      loadCalendarData();
    }
  };

  // Combine Google events and local tasks into FullCalendar events
  const calendarEvents = useMemo(() => {
    const events = [];

    // Add Google Calendar events
    for (const event of calendarState.googleEvents) {
      events.push({
        id: event.id,
        title: event.summary,
        start: event.start,
        end: event.end,
        allDay: event.all_day,
        backgroundColor: '#4285f4', // Google Blue
        borderColor: '#4285f4',
        textColor: 'white',
        extendedProps: {
          source: 'google_calendar',
          description: event.description,
          location: event.location,
          attendees: event.attendees,
          html_link: event.html_link,
          creator_email: event.creator_email
        },
        className: 'google-calendar-event'
      });
    }

    // Add local tasks
    for (const task of calendarState.localTasks) {
      const priorityColors = {
        high: '#ef4444',    // red-500
        medium: '#f59e0b',  // yellow-500
        low: '#10b981'      // green-500
      };

      const classNames = [
        'local-task-event',
        `priority-${task.priority}`,
        `task-status-${task.status}`,
        task.is_synced_to_google ? 'synced-task' : ''
      ].filter(Boolean);

      events.push({
        id: task.id,
        title: task.title,
        start: task.start_at,
        end: task.end_at,
        allDay: task.is_all_day,
        backgroundColor: priorityColors[task.priority],
        borderColor: task.is_synced_to_google ? '#4285f4' : priorityColors[task.priority],
        textColor: 'white',
        extendedProps: {
          source: 'local_task',
          description: task.description,
          priority: task.priority,
          status: task.status,
          is_synced: task.is_synced_to_google
        },
        className: classNames.join(' ')
      });
    }

    return events;
  }, [calendarState.googleEvents, calendarState.localTasks]);

  // Handle clicking on calendar dates - create new task
  const handleDateClick = async (arg: any) => {
    const clickedDate = new Date(arg.date);
    const isAllDay = arg.allDay !== false; // Default to all-day unless specifically timed
    
    // Simple task creation with title prompt
    const title = prompt(`Create a new task for ${clickedDate.toLocaleDateString()}:`);
    if (!title || title.trim() === '') return;
    
    try {
      // Import TaskAPI dynamically to avoid circular dependencies
      const { TaskAPI } = await import('@/lib/api/tasks');
      
      // Create the task locally first
      const newTask = await TaskAPI.quickCreateTask(
        clickedDate,
        title.trim(),
        isAllDay,
        isAllDay ? undefined : 60 // 1 hour default for timed events
      );
      
      // Ask user if they want to sync to Google Calendar
      if (calendarState.authStatus.authenticated) {
        const shouldSync = confirm(
          "Task created! Would you like to sync this task to your Google Calendar?"
        );
        
        if (shouldSync) {
          await syncTaskToGoogle(newTask.id, newTask);
        }
      }
      
      // Refresh calendar data to show the new task
      await loadCalendarData();
      
      toast({
        title: "Task Created! ✅",
        description: `"${title}" has been added to your calendar.`,
      });
      
    } catch (error) {
      console.error('Failed to create task:', error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Sync a local task to Google Calendar
  const syncTaskToGoogle = async (taskId: string, taskData: any) => {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}/sync-to-google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Synced to Google Calendar! 🔄",
          description: "Task has been added to your Google Calendar.",
        });
        return result;
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Failed to sync task to Google Calendar:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync task to Google Calendar.",
        variant: "destructive",
      });
    }
  };

  // Handle clicking on events
  const handleEventClick = (arg: any) => {
    const event = arg.event;
    const props = event.extendedProps;
    
    if (props.source === 'google_calendar') {
      // For Google Calendar events, show details and open in Google Calendar
      const eventDetails = [
        `📅 ${event.title}`,
        props.description ? `📝 ${props.description}` : '',
        props.location ? `📍 ${props.location}` : '',
        props.attendees?.length > 0 ? `👥 ${props.attendees.length} attendees` : '',
        `🕒 ${event.start?.toLocaleString()} - ${event.end?.toLocaleString() || 'No end time'}`
      ].filter(Boolean).join('\n');
      
      const shouldOpen = confirm(
        `Google Calendar Event:\n\n${eventDetails}\n\nWould you like to open this event in Google Calendar?`
      );
      
      if (shouldOpen && props.html_link) {
        window.open(props.html_link, '_blank');
      }
    } else if (props.source === 'local_task') {
      // For local tasks, show actions menu
      const taskDetails = [
        `📋 ${event.title}`,
        props.description ? `📝 ${props.description}` : '',
        `⚡ Priority: ${props.priority}`,
        `📊 Status: ${props.status}`,
        props.is_synced ? '🔄 Synced to Google Calendar' : '⚪ Not synced',
        `🕒 ${event.start?.toLocaleString()} - ${event.end?.toLocaleString() || 'No end time'}`
      ].filter(Boolean).join('\n');
      
      // Show action menu for local tasks
      const actions = [
        'View Details',
        props.is_synced ? 'Remove from Google Calendar' : 'Sync to Google Calendar',
        'Edit Task',
        'Mark as ' + (props.status === 'done' ? 'Todo' : 'Complete'),
        'Delete Task'
      ];
      
      const choice = prompt(
        `Local Task:\n\n${taskDetails}\n\nChoose an action:\n${actions.map((action, i) => `${i + 1}. ${action}`).join('\n')}`
      );
      
      const actionIndex = parseInt(choice || '0') - 1;
      if (actionIndex >= 0 && actionIndex < actions.length) {
        handleTaskAction(event.id, actions[actionIndex], props);
      }
    }
  };

  // Handle task actions from event click
  const handleTaskAction = async (taskId: string, action: string, taskProps: any) => {
    try {
      switch (action) {
        case 'View Details':
          // Just show the details again - could open a modal in future
          toast({
            title: "Task Details",
            description: `${taskProps.description || 'No description'}`,
          });
          break;
          
        case 'Sync to Google Calendar':
          if (calendarState.authStatus.authenticated) {
            await syncTaskToGoogle(taskId, taskProps);
            await loadCalendarData(); // Refresh to show updated sync status
          } else {
            toast({
              title: "Not Connected",
              description: "Please connect to Google Calendar first.",
              variant: "destructive",
            });
          }
          break;
          
        case 'Remove from Google Calendar':
          // This would need to be implemented in the backend
          const confirmRemove = confirm("Remove this task from Google Calendar? It will remain in your local tasks.");
          if (confirmRemove) {
            const response = await fetch(`/api/v1/tasks/${taskId}/remove-sync`, {
              method: 'POST'
            });
            if (response.ok) {
              await loadCalendarData();
              toast({
                title: "Removed from Google Calendar",
                description: "Task is no longer synced to Google Calendar.",
              });
            }
          }
          break;
          
        case 'Edit Task':
          // For now, just redirect to tasks page - could open inline editor
          window.location.href = '/tasks';
          break;
          
        case 'Mark as Complete':
        case 'Mark as Todo':
          const newStatus = action.includes('Complete') ? 'done' : 'todo';
          // This would need the TaskAPI to update status
          const { TaskAPI } = await import('@/lib/api/tasks');
          await TaskAPI.updateTaskStatus(taskId, newStatus);
          await loadCalendarData();
          toast({
            title: "Task Updated",
            description: `Task marked as ${newStatus}`,
          });
          break;
          
        case 'Delete Task':
          const confirmDelete = confirm("Are you sure you want to delete this task?");
          if (confirmDelete) {
            const { TaskAPI } = await import('@/lib/api/tasks');
            await TaskAPI.deleteTask(taskId);
            await loadCalendarData();
            toast({
              title: "Task Deleted",
              description: "Task has been removed.",
            });
          }
          break;
      }
    } catch (error) {
      console.error('Failed to perform task action:', error);
      toast({
        title: "Error",
        description: "Failed to perform action. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (calendarState.loading && !calendarState.authStatus.authenticated) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-violet" size={32} />
              <div>
                <h1 className="text-3xl font-bold text-white">Calendar</h1>
                <p className="text-white/70">Loading...</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Skeleton className="h-48 bg-dark-tertiary" />
            </div>
            <div className="lg:col-span-3">
              <Skeleton className="h-96 bg-dark-tertiary" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="text-violet" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-white">Calendar</h1>
              <p className="text-white/70">
                {calendarState.authStatus.authenticated 
                  ? `Connected to Google Calendar • ${calendarState.googleEvents.length} events`
                  : 'Connect your Google Calendar to get started'
                }
              </p>
            </div>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {calendarState.authStatus.authenticated && (
              <Button
                onClick={refreshCalendarData}
                variant="outline"
                size="sm"
                disabled={calendarState.loading}
                className="bg-dark-tertiary border-white/10 text-white hover:bg-dark-secondary"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${calendarState.loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Authentication Status Card */}
            <Card className="bg-dark-secondary border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings size={18} />
                  Google Calendar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {calendarState.authStatus.authenticated ? (
                    <>
                      <CheckCircle className="text-green-500" size={16} />
                      <span className="text-green-400 text-sm font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-yellow-500" size={16} />
                      <span className="text-yellow-400 text-sm font-medium">Not Connected</span>
                    </>
                  )}
                </div>
                
                <p className="text-white/70 text-sm">
                  {calendarState.authStatus.message}
                </p>
                
                {calendarState.authStatus.authenticated ? (
                  <Button
                    onClick={disconnectGoogleCalendar}
                    variant="outline"
                    size="sm"
                    className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                  >
                    <SyncOff className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={connectToGoogleCalendar}
                    className="w-full bg-violet hover:bg-violet/90 text-white"
                  >
                    <Sync className="w-4 h-4 mr-2" />
                    Connect Google Calendar
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Calendar Statistics */}
            {calendarState.authStatus.authenticated && (
              <Card className="bg-dark-secondary border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm">Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Google Events</span>
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                      {calendarState.googleEvents.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Local Tasks</span>
                    <Badge variant="secondary" className="bg-violet/20 text-violet">
                      {calendarState.localTasks.length}
                    </Badge>
                  </div>
                  {calendarState.lastRefresh && (
                    <div className="pt-2 border-t border-white/10">
                      <span className="text-white/50 text-xs">
                        Last updated: {calendarState.lastRefresh.toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Event Legend */}
            {calendarState.authStatus.authenticated && (
              <Card className="bg-dark-secondary border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm">Event Types</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                        <span className="text-xs">🌐</span>
                      </div>
                      <span className="text-white/70 text-xs">Google Calendar Events</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500"></div>
                      <span className="text-white/70 text-xs">High Priority Tasks</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-yellow-500"></div>
                      <span className="text-white/70 text-xs">Medium Priority Tasks</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500"></div>
                      <span className="text-white/70 text-xs">Low Priority Tasks</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-violet border-r-2 border-blue-500 flex items-center justify-center">
                        <span className="text-xs">🔄</span>
                      </div>
                      <span className="text-white/70 text-xs">Synced to Google</span>
                    </div>
                    
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-white/50 text-xs">
                        Click dates to create tasks • Click events for options
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Calendar View */}
          <div className="lg:col-span-3">
            <Card className="bg-dark-secondary border-white/10">
              <CardContent className="p-6">
                {calendarState.authStatus.authenticated ? (
                  <div className="calendar-container">
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
                      eventClick={handleEventClick}
                      editable={false} // Disable editing for now
                      selectable={true}
                      height="auto"
                      eventDisplay="block"
                      dayMaxEvents={3}
                      moreLinkText="more"
                      eventTextColor="white"
                      // Custom styling
                      eventClassNames="rounded-lg"
                      dayCellClassNames="hover:bg-white/5 cursor-pointer"
                      // Loading state
                      loading={calendarState.loading}
                    />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <CalendarIcon className="mx-auto text-white/30 mb-4" size={64} />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Connect Your Google Calendar
                    </h3>
                    <p className="text-white/70 mb-6 max-w-md mx-auto">
                      Connect your Google Calendar to view and manage your events alongside your local tasks in one unified view.
                    </p>
                    <Button
                      onClick={connectToGoogleCalendar}
                      className="bg-violet hover:bg-violet/90 text-white"
                    >
                      <Sync className="w-4 h-4 mr-2" />
                      Connect Google Calendar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Custom CSS for calendar styling */}
      <style jsx global>{`
        .fc-theme-standard .fc-scrollgrid {
          border-color: rgba(255, 255, 255, 0.1);
        }
        
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: rgba(255, 255, 255, 0.1);
        }
        
        .fc-col-header-cell {
          background-color: rgba(138, 107, 244, 0.1);
          color: white;
        }
        
        .fc-daygrid-day {
          background-color: transparent;
          color: white;
        }
        
        .fc-day-today {
          background-color: rgba(138, 107, 244, 0.2) !important;
        }
        
        .fc-button-primary {
          background-color: #8a6bf4;
          border-color: #8a6bf4;
        }
        
        .fc-button-primary:hover {
          background-color: #7c3aed;
          border-color: #7c3aed;
        }
        
        .fc-toolbar-title {
          color: white;
        }
        
        /* Google Calendar Events - Blue with Google icon indicator */
        .google-calendar-event {
          border-left: 4px solid #4285f4 !important;
          background: linear-gradient(135deg, #4285f4 0%, #34a853 100%) !important;
          border-radius: 6px !important;
          box-shadow: 0 2px 4px rgba(66, 133, 244, 0.3);
          position: relative;
        }
        
        .google-calendar-event::before {
          content: "🌐";
          position: absolute;
          top: 2px;
          right: 4px;
          font-size: 10px;
          opacity: 0.8;
        }
        
        /* Local Tasks - Different colors by priority with sync indicators */
        .local-task-event.priority-high {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
          border-left: 4px solid #ef4444 !important;
        }
        
        .local-task-event.priority-medium {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
          border-left: 4px solid #f59e0b !important;
        }
        
        .local-task-event.priority-low {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          border-left: 4px solid #10b981 !important;
        }
        
        /* Synced tasks get a Google Calendar border */
        .synced-task {
          border-right: 4px solid #4285f4 !important;
          position: relative;
        }
        
        .synced-task::after {
          content: "🔄";
          position: absolute;
          top: 2px;
          right: 4px;
          font-size: 10px;
          opacity: 0.9;
        }
        
        /* Completed tasks styling */
        .task-status-done {
          opacity: 0.6;
          text-decoration: line-through;
        }
        
        .task-status-done .fc-event-title {
          text-decoration: line-through;
        }
        
        /* In-progress tasks get a pulsing effect */
        .task-status-inprogress {
          animation: pulse-glow 2s infinite;
        }
        
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 2px 4px rgba(138, 107, 244, 0.3); }
          50% { box-shadow: 0 4px 8px rgba(138, 107, 244, 0.6); }
        }
        
        /* Event text styling */
        .fc-event-title {
          font-weight: 500;
          font-size: 12px;
        }
        
        /* Hover effects */
        .fc-event:hover {
          transform: translateY(-1px);
          transition: transform 0.2s ease;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* Calendar grid improvements */
        .fc-daygrid-day:hover {
          background-color: rgba(255, 255, 255, 0.05);
          cursor: pointer;
        }
        
        .fc-daygrid-day-frame {
          min-height: 100px;
        }
        
        /* More link styling */
        .fc-daygrid-more-link {
          background: rgba(138, 107, 244, 0.8) !important;
          color: white !important;
          border-radius: 4px !important;
          padding: 2px 6px !important;
          font-size: 11px !important;
        }
      `}</style>
    </Layout>
  );
};

export default Calendar; 
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Plus,
  Sync,
  SyncOff
} from 'lucide-react';

// Types for our calendar data
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end?: Date;
  all_day: boolean;
  location?: string;
  attendees: string[];
  creator_email?: string;
  html_link?: string;
  status: string;
  source: 'google_calendar';
}

interface LocalTask {
  id: string;
  title: string;
  description?: string;
  start_at?: Date;
  end_at?: Date;
  is_all_day: boolean;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'inprogress' | 'done';
  is_synced_to_google: boolean;
  google_calendar_event_id?: string;
  source: 'local_task';
}

interface CalendarState {
  googleEvents: GoogleCalendarEvent[];
  localTasks: LocalTask[];
  authStatus: {
    authenticated: boolean;
    message: string;
  };
  loading: boolean;
  lastRefresh?: Date;
}

const Calendar: React.FC = () => {
  const [calendarState, setCalendarState] = useState<CalendarState>({
    googleEvents: [],
    localTasks: [],
    authStatus: { authenticated: false, message: 'Checking...' },
    loading: true
  });
  
  const { toast } = useToast();

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load calendar data when authenticated
  useEffect(() => {
    if (calendarState.authStatus.authenticated) {
      loadCalendarData();
    }
  }, [calendarState.authStatus.authenticated]);

  // Handle URL parameters (auth success/error from OAuth redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    const errorMessage = urlParams.get('message');

    if (authResult === 'success') {
      toast({
        title: "Google Calendar Connected! 🎉",
        description: "Your Google Calendar has been successfully connected.",
      });
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // Recheck auth status
      checkAuthStatus();
    } else if (authResult === 'error') {
      toast({
        title: "Connection Failed",
        description: errorMessage || "Failed to connect Google Calendar. Please try again.",
        variant: "destructive",
      });
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/v1/auth/google/calendar/status');
      const data = await response.json();
      
      setCalendarState(prev => ({
        ...prev,
        authStatus: {
          authenticated: data.authenticated,
          message: data.message
        },
        loading: false
      }));
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setCalendarState(prev => ({
        ...prev,
        authStatus: {
          authenticated: false,
          message: 'Failed to check authentication status'
        },
        loading: false
      }));
    }
  };

  const connectToGoogleCalendar = () => {
    // Redirect to backend OAuth initiation endpoint
    window.location.href = '/api/v1/auth/google/calendar/login';
  };

  const disconnectGoogleCalendar = async () => {
    try {
      const response = await fetch('/api/v1/auth/google/calendar/disconnect', {
        method: 'POST'
      });
      
      if (response.ok) {
        setCalendarState(prev => ({
          ...prev,
          authStatus: {
            authenticated: false,
            message: 'Google Calendar disconnected'
          },
          googleEvents: []
        }));
        
        toast({
          title: "Disconnected",
          description: "Google Calendar has been disconnected.",
        });
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Google Calendar.",
        variant: "destructive",
      });
    }
  };

  const loadCalendarData = async () => {
    setCalendarState(prev => ({ ...prev, loading: true }));
    
    try {
      // Load Google Calendar events and local tasks in parallel
      const [googleResponse, localResponse] = await Promise.allSettled([
        fetch('/api/v1/calendar/events'),
        // Use the existing Supabase API from TaskAPI
        import('@/lib/api/tasks').then(({ TaskAPI }) => TaskAPI.getAllTasks())
      ]);

      let googleEvents: GoogleCalendarEvent[] = [];
      let localTasks: LocalTask[] = [];

      // Handle Google Calendar events
      if (googleResponse.status === 'fulfilled' && googleResponse.value.ok) {
        const googleData = await googleResponse.value.json();
        googleEvents = googleData.map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: event.end ? new Date(event.end) : undefined,
          source: 'google_calendar' as const
        }));
        console.log(`Loaded ${googleEvents.length} Google Calendar events`);
      } else {
        console.warn('Failed to load Google Calendar events:', 
          googleResponse.status === 'fulfilled' ? 
            await googleResponse.value.text() : 
            googleResponse.reason
        );
      }

      // Handle local tasks from Supabase
      if (localResponse.status === 'fulfilled') {
        const tasksData = localResponse.value;
        localTasks = tasksData.map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          start_at: task.start_at,
          end_at: task.end_at,
          is_all_day: task.is_all_day,
          priority: task.priority,
          status: task.status,
          is_synced_to_google: task.is_synced_to_google || false,
          google_calendar_event_id: task.google_calendar_event_id,
          source: 'local_task' as const
        }));
        console.log(`Loaded ${localTasks.length} local tasks`);
      } else {
        console.warn('Failed to load local tasks:', localResponse.reason);
        // Don't treat this as a critical error since Google Calendar might still work
      }

      setCalendarState(prev => ({
        ...prev,
        googleEvents,
        localTasks,
        loading: false,
        lastRefresh: new Date()
      }));

      // Show success toast with summary
      toast({
        title: "Calendar Updated",
        description: `Loaded ${googleEvents.length} Google events and ${localTasks.length} local tasks`,
      });

    } catch (error) {
      console.error('Failed to load calendar data:', error);
      setCalendarState(prev => ({ ...prev, loading: false }));
      toast({
        title: "Error",
        description: "Failed to load calendar data. Please try refreshing.",
        variant: "destructive",
      });
    }
  };

  const refreshCalendarData = () => {
    if (calendarState.authStatus.authenticated) {
      loadCalendarData();
    }
  };

  // Combine Google events and local tasks into FullCalendar events
  const calendarEvents = useMemo(() => {
    const events = [];

    // Add Google Calendar events
    for (const event of calendarState.googleEvents) {
      events.push({
        id: event.id,
        title: event.summary,
        start: event.start,
        end: event.end,
        allDay: event.all_day,
        backgroundColor: '#4285f4', // Google Blue
        borderColor: '#4285f4',
        textColor: 'white',
        extendedProps: {
          source: 'google_calendar',
          description: event.description,
          location: event.location,
          attendees: event.attendees,
          html_link: event.html_link,
          creator_email: event.creator_email
        },
        className: 'google-calendar-event'
      });
    }

    // Add local tasks
    for (const task of calendarState.localTasks) {
      const priorityColors = {
        high: '#ef4444',    // red-500
        medium: '#f59e0b',  // yellow-500
        low: '#10b981'      // green-500
      };

      const classNames = [
        'local-task-event',
        `priority-${task.priority}`,
        `task-status-${task.status}`,
        task.is_synced_to_google ? 'synced-task' : ''
      ].filter(Boolean);

      events.push({
        id: task.id,
        title: task.title,
        start: task.start_at,
        end: task.end_at,
        allDay: task.is_all_day,
        backgroundColor: priorityColors[task.priority],
        borderColor: task.is_synced_to_google ? '#4285f4' : priorityColors[task.priority],
        textColor: 'white',
        extendedProps: {
          source: 'local_task',
          description: task.description,
          priority: task.priority,
          status: task.status,
          is_synced: task.is_synced_to_google
        },
        className: classNames.join(' ')
      });
    }

    return events;
  }, [calendarState.googleEvents, calendarState.localTasks]);

  // Handle clicking on calendar dates - create new task
  const handleDateClick = async (arg: any) => {
    const clickedDate = new Date(arg.date);
    const isAllDay = arg.allDay !== false; // Default to all-day unless specifically timed
    
    // Simple task creation with title prompt
    const title = prompt(`Create a new task for ${clickedDate.toLocaleDateString()}:`);
    if (!title || title.trim() === '') return;
    
    try {
      // Import TaskAPI dynamically to avoid circular dependencies
      const { TaskAPI } = await import('@/lib/api/tasks');
      
      // Create the task locally first
      const newTask = await TaskAPI.quickCreateTask(
        clickedDate,
        title.trim(),
        isAllDay,
        isAllDay ? undefined : 60 // 1 hour default for timed events
      );
      
      // Ask user if they want to sync to Google Calendar
      if (calendarState.authStatus.authenticated) {
        const shouldSync = confirm(
          "Task created! Would you like to sync this task to your Google Calendar?"
        );
        
        if (shouldSync) {
          await syncTaskToGoogle(newTask.id, newTask);
        }
      }
      
      // Refresh calendar data to show the new task
      await loadCalendarData();
      
      toast({
        title: "Task Created! ✅",
        description: `"${title}" has been added to your calendar.`,
      });
      
    } catch (error) {
      console.error('Failed to create task:', error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Sync a local task to Google Calendar
  const syncTaskToGoogle = async (taskId: string, taskData: any) => {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}/sync-to-google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Synced to Google Calendar! 🔄",
          description: "Task has been added to your Google Calendar.",
        });
        return result;
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Failed to sync task to Google Calendar:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync task to Google Calendar.",
        variant: "destructive",
      });
    }
  };

  // Handle clicking on events
  const handleEventClick = (arg: any) => {
    const event = arg.event;
    const props = event.extendedProps;
    
    if (props.source === 'google_calendar') {
      // For Google Calendar events, show details and open in Google Calendar
      const eventDetails = [
        `📅 ${event.title}`,
        props.description ? `📝 ${props.description}` : '',
        props.location ? `📍 ${props.location}` : '',
        props.attendees?.length > 0 ? `👥 ${props.attendees.length} attendees` : '',
        `🕒 ${event.start?.toLocaleString()} - ${event.end?.toLocaleString() || 'No end time'}`
      ].filter(Boolean).join('\n');
      
      const shouldOpen = confirm(
        `Google Calendar Event:\n\n${eventDetails}\n\nWould you like to open this event in Google Calendar?`
      );
      
      if (shouldOpen && props.html_link) {
        window.open(props.html_link, '_blank');
      }
    } else if (props.source === 'local_task') {
      // For local tasks, show actions menu
      const taskDetails = [
        `📋 ${event.title}`,
        props.description ? `📝 ${props.description}` : '',
        `⚡ Priority: ${props.priority}`,
        `📊 Status: ${props.status}`,
        props.is_synced ? '🔄 Synced to Google Calendar' : '⚪ Not synced',
        `🕒 ${event.start?.toLocaleString()} - ${event.end?.toLocaleString() || 'No end time'}`
      ].filter(Boolean).join('\n');
      
      // Show action menu for local tasks
      const actions = [
        'View Details',
        props.is_synced ? 'Remove from Google Calendar' : 'Sync to Google Calendar',
        'Edit Task',
        'Mark as ' + (props.status === 'done' ? 'Todo' : 'Complete'),
        'Delete Task'
      ];
      
      const choice = prompt(
        `Local Task:\n\n${taskDetails}\n\nChoose an action:\n${actions.map((action, i) => `${i + 1}. ${action}`).join('\n')}`
      );
      
      const actionIndex = parseInt(choice || '0') - 1;
      if (actionIndex >= 0 && actionIndex < actions.length) {
        handleTaskAction(event.id, actions[actionIndex], props);
      }
    }
  };

  // Handle task actions from event click
  const handleTaskAction = async (taskId: string, action: string, taskProps: any) => {
    try {
      switch (action) {
        case 'View Details':
          // Just show the details again - could open a modal in future
          toast({
            title: "Task Details",
            description: `${taskProps.description || 'No description'}`,
          });
          break;
          
        case 'Sync to Google Calendar':
          if (calendarState.authStatus.authenticated) {
            await syncTaskToGoogle(taskId, taskProps);
            await loadCalendarData(); // Refresh to show updated sync status
          } else {
            toast({
              title: "Not Connected",
              description: "Please connect to Google Calendar first.",
              variant: "destructive",
            });
          }
          break;
          
        case 'Remove from Google Calendar':
          // This would need to be implemented in the backend
          const confirmRemove = confirm("Remove this task from Google Calendar? It will remain in your local tasks.");
          if (confirmRemove) {
            const response = await fetch(`/api/v1/tasks/${taskId}/remove-sync`, {
              method: 'POST'
            });
            if (response.ok) {
              await loadCalendarData();
              toast({
                title: "Removed from Google Calendar",
                description: "Task is no longer synced to Google Calendar.",
              });
            }
          }
          break;
          
        case 'Edit Task':
          // For now, just redirect to tasks page - could open inline editor
          window.location.href = '/tasks';
          break;
          
        case 'Mark as Complete':
        case 'Mark as Todo':
          const newStatus = action.includes('Complete') ? 'done' : 'todo';
          // This would need the TaskAPI to update status
          const { TaskAPI } = await import('@/lib/api/tasks');
          await TaskAPI.updateTaskStatus(taskId, newStatus);
          await loadCalendarData();
          toast({
            title: "Task Updated",
            description: `Task marked as ${newStatus}`,
          });
          break;
          
        case 'Delete Task':
          const confirmDelete = confirm("Are you sure you want to delete this task?");
          if (confirmDelete) {
            const { TaskAPI } = await import('@/lib/api/tasks');
            await TaskAPI.deleteTask(taskId);
            await loadCalendarData();
            toast({
              title: "Task Deleted",
              description: "Task has been removed.",
            });
          }
          break;
      }
    } catch (error) {
      console.error('Failed to perform task action:', error);
      toast({
        title: "Error",
        description: "Failed to perform action. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (calendarState.loading && !calendarState.authStatus.authenticated) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-violet" size={32} />
              <div>
                <h1 className="text-3xl font-bold text-white">Calendar</h1>
                <p className="text-white/70">Loading...</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Skeleton className="h-48 bg-dark-tertiary" />
            </div>
            <div className="lg:col-span-3">
              <Skeleton className="h-96 bg-dark-tertiary" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="text-violet" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-white">Calendar</h1>
              <p className="text-white/70">
                {calendarState.authStatus.authenticated 
                  ? `Connected to Google Calendar • ${calendarState.googleEvents.length} events`
                  : 'Connect your Google Calendar to get started'
                }
              </p>
            </div>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {calendarState.authStatus.authenticated && (
              <Button
                onClick={refreshCalendarData}
                variant="outline"
                size="sm"
                disabled={calendarState.loading}
                className="bg-dark-tertiary border-white/10 text-white hover:bg-dark-secondary"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${calendarState.loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Authentication Status Card */}
            <Card className="bg-dark-secondary border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings size={18} />
                  Google Calendar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {calendarState.authStatus.authenticated ? (
                    <>
                      <CheckCircle className="text-green-500" size={16} />
                      <span className="text-green-400 text-sm font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-yellow-500" size={16} />
                      <span className="text-yellow-400 text-sm font-medium">Not Connected</span>
                    </>
                  )}
                </div>
                
                <p className="text-white/70 text-sm">
                  {calendarState.authStatus.message}
                </p>
                
                {calendarState.authStatus.authenticated ? (
                  <Button
                    onClick={disconnectGoogleCalendar}
                    variant="outline"
                    size="sm"
                    className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                  >
                    <SyncOff className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={connectToGoogleCalendar}
                    className="w-full bg-violet hover:bg-violet/90 text-white"
                  >
                    <Sync className="w-4 h-4 mr-2" />
                    Connect Google Calendar
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Calendar Statistics */}
            {calendarState.authStatus.authenticated && (
              <Card className="bg-dark-secondary border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm">Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Google Events</span>
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                      {calendarState.googleEvents.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Local Tasks</span>
                    <Badge variant="secondary" className="bg-violet/20 text-violet">
                      {calendarState.localTasks.length}
                    </Badge>
                  </div>
                  {calendarState.lastRefresh && (
                    <div className="pt-2 border-t border-white/10">
                      <span className="text-white/50 text-xs">
                        Last updated: {calendarState.lastRefresh.toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Event Legend */}
            {calendarState.authStatus.authenticated && (
              <Card className="bg-dark-secondary border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm">Event Types</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                        <span className="text-xs">🌐</span>
                      </div>
                      <span className="text-white/70 text-xs">Google Calendar Events</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500"></div>
                      <span className="text-white/70 text-xs">High Priority Tasks</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-yellow-500"></div>
                      <span className="text-white/70 text-xs">Medium Priority Tasks</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500"></div>
                      <span className="text-white/70 text-xs">Low Priority Tasks</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-violet border-r-2 border-blue-500 flex items-center justify-center">
                        <span className="text-xs">🔄</span>
                      </div>
                      <span className="text-white/70 text-xs">Synced to Google</span>
                    </div>
                    
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-white/50 text-xs">
                        Click dates to create tasks • Click events for options
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Calendar View */}
          <div className="lg:col-span-3">
            <Card className="bg-dark-secondary border-white/10">
              <CardContent className="p-6">
                {calendarState.authStatus.authenticated ? (
                  <div className="calendar-container">
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
                      eventClick={handleEventClick}
                      editable={false} // Disable editing for now
                      selectable={true}
                      height="auto"
                      eventDisplay="block"
                      dayMaxEvents={3}
                      moreLinkText="more"
                      eventTextColor="white"
                      // Custom styling
                      eventClassNames="rounded-lg"
                      dayCellClassNames="hover:bg-white/5 cursor-pointer"
                      // Loading state
                      loading={calendarState.loading}
                    />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <CalendarIcon className="mx-auto text-white/30 mb-4" size={64} />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Connect Your Google Calendar
                    </h3>
                    <p className="text-white/70 mb-6 max-w-md mx-auto">
                      Connect your Google Calendar to view and manage your events alongside your local tasks in one unified view.
                    </p>
                    <Button
                      onClick={connectToGoogleCalendar}
                      className="bg-violet hover:bg-violet/90 text-white"
                    >
                      <Sync className="w-4 h-4 mr-2" />
                      Connect Google Calendar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Custom CSS for calendar styling */}
      <style jsx global>{`
        .fc-theme-standard .fc-scrollgrid {
          border-color: rgba(255, 255, 255, 0.1);
        }
        
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: rgba(255, 255, 255, 0.1);
        }
        
        .fc-col-header-cell {
          background-color: rgba(138, 107, 244, 0.1);
          color: white;
        }
        
        .fc-daygrid-day {
          background-color: transparent;
          color: white;
        }
        
        .fc-day-today {
          background-color: rgba(138, 107, 244, 0.2) !important;
        }
        
        .fc-button-primary {
          background-color: #8a6bf4;
          border-color: #8a6bf4;
        }
        
        .fc-button-primary:hover {
          background-color: #7c3aed;
          border-color: #7c3aed;
        }
        
        .fc-toolbar-title {
          color: white;
        }
        
        /* Google Calendar Events - Blue with Google icon indicator */
        .google-calendar-event {
          border-left: 4px solid #4285f4 !important;
          background: linear-gradient(135deg, #4285f4 0%, #34a853 100%) !important;
          border-radius: 6px !important;
          box-shadow: 0 2px 4px rgba(66, 133, 244, 0.3);
          position: relative;
        }
        
        .google-calendar-event::before {
          content: "🌐";
          position: absolute;
          top: 2px;
          right: 4px;
          font-size: 10px;
          opacity: 0.8;
        }
        
        /* Local Tasks - Different colors by priority with sync indicators */
        .local-task-event.priority-high {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
          border-left: 4px solid #ef4444 !important;
        }
        
        .local-task-event.priority-medium {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
          border-left: 4px solid #f59e0b !important;
        }
        
        .local-task-event.priority-low {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          border-left: 4px solid #10b981 !important;
        }
        
        /* Synced tasks get a Google Calendar border */
        .synced-task {
          border-right: 4px solid #4285f4 !important;
          position: relative;
        }
        
        .synced-task::after {
          content: "🔄";
          position: absolute;
          top: 2px;
          right: 4px;
          font-size: 10px;
          opacity: 0.9;
        }
        
        /* Completed tasks styling */
        .task-status-done {
          opacity: 0.6;
          text-decoration: line-through;
        }
        
        .task-status-done .fc-event-title {
          text-decoration: line-through;
        }
        
        /* In-progress tasks get a pulsing effect */
        .task-status-inprogress {
          animation: pulse-glow 2s infinite;
        }
        
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 2px 4px rgba(138, 107, 244, 0.3); }
          50% { box-shadow: 0 4px 8px rgba(138, 107, 244, 0.6); }
        }
        
        /* Event text styling */
        .fc-event-title {
          font-weight: 500;
          font-size: 12px;
        }
        
        /* Hover effects */
        .fc-event:hover {
          transform: translateY(-1px);
          transition: transform 0.2s ease;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* Calendar grid improvements */
        .fc-daygrid-day:hover {
          background-color: rgba(255, 255, 255, 0.05);
          cursor: pointer;
        }
        
        .fc-daygrid-day-frame {
          min-height: 100px;
        }
        
        /* More link styling */
        .fc-daygrid-more-link {
          background: rgba(138, 107, 244, 0.8) !important;
          color: white !important;
          border-radius: 4px !important;
          padding: 2px 6px !important;
          font-size: 11px !important;
        }
      `}</style>
    </Layout>
  );
};

export default Calendar; 
 
 