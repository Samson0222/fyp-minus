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
  XCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

// Unified Task type matching the backend response
interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time?: string; // ISO string
  end_time?: string; // ISO string
  is_all_day: boolean;
  timezone?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'inprogress' | 'done';
  type: 'todo' | 'event';
  google_event_id?: string;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

interface CalendarState {
  tasks: Task[];
  authStatus: {
    authenticated: boolean;
    message: string;
  };
  loading: boolean;
  lastRefresh?: Date;
}

const Calendar: React.FC = () => {
  const [calendarState, setCalendarState] = useState<CalendarState>({
    tasks: [],
    authStatus: { authenticated: false, message: 'Checking...' },
    loading: true
  });
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  
  const { toast } = useToast();

  // Establish WebSocket connection
  useEffect(() => {
    // A simplified user_id for the demo. In a real app, this would come from an auth context.
    const userId = "test_user_001"; 

    if (calendarState.authStatus.authenticated) {
      const ws = new WebSocket(`ws://localhost:8000/ws/calendar/${userId}`);

      ws.onopen = () => {
        console.log("WebSocket connection established for calendar updates.");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'sync_complete') {
          toast({
            title: "Real-time Update ✨",
            description: "Your calendar has been updated automatically from Google.",
          });
          // A webhook triggered a sync, now we reload the data
          loadCalendarData();
        }
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed.");
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      // Clean up the connection when the component unmounts
      return () => {
        ws.close();
      };
    }
  }, [calendarState.authStatus.authenticated]);

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
          tasks: []
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
      const response = await fetch('/api/v1/tasks');
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tasks: Task[] = data.map((task: any) => ({
        ...task,
        // Ensure date fields are consistently handled if needed, though FullCalendar can handle ISO strings
      }));

      console.log(`Loaded ${tasks.length} tasks from the backend`);

      setCalendarState(prev => ({
        ...prev,
        tasks,
        loading: false,
        lastRefresh: new Date()
      }));

      toast({
        title: "Calendar Loaded",
        description: `Successfully loaded ${tasks.length} tasks and events.`,
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

  const refreshCalendarData = async () => {
    setCalendarState(prev => ({ ...prev, loading: true }));
    toast({ title: "Syncing...", description: "Attempting to sync with Google Calendar." });

    try {
      // 1. Trigger the backend sync process
      const syncResponse = await fetch('/api/v1/tasks/sync-from-google', {
        method: 'POST'
      });

      if (!syncResponse.ok) {
        throw new Error('Failed to sync with Google Calendar.');
      }

      const syncResult = await syncResponse.json();
      toast({
        title: "Sync Successful",
        description: `Created: ${syncResult.details.created}, Updated: ${syncResult.details.updated}. Refreshing view...`
      });

      // 2. Re-fetch all tasks to update the view
      await loadCalendarData();

    } catch (error) {
      console.error('Failed to refresh calendar data:', error);
      setCalendarState(prev => ({ ...prev, loading: false }));
      toast({
        title: "Sync Error",
        description: "Could not sync with Google Calendar. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  // Memoize and transform tasks for FullCalendar
  const memoizedEvents = useMemo(() => {
    return calendarState.tasks.map(task => {
      let backgroundColor = '#3174ad'; // Default blue for local tasks
      let borderColor = '#3174ad';

      if (task.type === 'event' && task.google_event_id) {
        backgroundColor = '#1e8e3e'; // Green for synced Google events
        borderColor = '#1e8e3e';
      } else if (task.type === 'event') {
        backgroundColor = '#f29900'; // Amber for local-only events
        borderColor = '#f29900';
      }

      return {
        id: task.id,
        title: task.title,
        start: task.start_time,
        end: task.end_time,
        allDay: task.is_all_day,
        extendedProps: { ...task },
        backgroundColor,
        borderColor,
      };
    });
  }, [calendarState.tasks]);

  // Handle clicking on calendar events to show details
  const handleEventClick = (clickInfo: any) => {
    const task = clickInfo.event.extendedProps as Task;
    
    toast({
      title: `(Task) ${task.title}`,
      description: (
        <div className="text-sm text-white/80">
          <p><strong>Status:</strong> {task.status}</p>
          <p><strong>Priority:</strong> {task.priority}</p>
          <p><strong>Type:</strong> {task.type}</p>
          {task.description && <p><strong>Description:</strong> {task.description}</p>}
          {task.google_event_id && (
            <p className="text-green-400">Synced with Google Calendar</p>
          )}
        </div>
      ),
    });
  };

  // Placeholder for creating a new task - to be implemented fully later
  const handleDateClick = (arg: any) => {
    toast({
      title: 'Create New Task',
      description: `You clicked on ${arg.dateStr}. Feature to create a new task here is coming soon!`,
    });
  };

  const formattedLastRefresh = useMemo(() => {
    if (!calendarState.lastRefresh) return '';
    return calendarState.lastRefresh.toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [calendarState.lastRefresh]);

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
            <Button
              onClick={() => setIsPanelVisible(!isPanelVisible)}
              variant="outline"
              size="sm"
              className="bg-dark-tertiary border-white/10 text-white hover:bg-dark-secondary"
            >
              {isPanelVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </Button>
            <div>
              <p className="text-white/70 -mt-1">
                {calendarState.authStatus.authenticated 
                  ? `Connected to Google Calendar • ${calendarState.tasks.length} events`
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
          {isPanelVisible && (
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
                      <XCircle className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      onClick={connectToGoogleCalendar}
                      className="w-full bg-violet hover:bg-violet/90 text-white"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
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
                      <span className="text-white/70 text-sm">Tasks</span>
                      <Badge variant="secondary" className="bg-violet/20 text-violet">
                        {calendarState.tasks.length}
                      </Badge>
                    </div>
                    {calendarState.lastRefresh && (
                      <div className="pt-2 border-t border-white/10">
                        <span className="text-white/50 text-xs">
                          Last updated: {formattedLastRefresh}
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
          )}

          {/* Calendar View */}
          <div className={isPanelVisible ? "lg:col-span-3" : "lg:col-span-4"}>
            <Card className="bg-dark-secondary border-white/10">
              <CardContent className="p-6">
                {calendarState.authStatus.authenticated ? (
                  <div className="calendar-container">
                    <FullCalendar
                      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                      initialView="dayGridMonth"
                      initialDate={new Date()}
                      timeZone="local"
                      eventTimeFormat={{
                        hour: 'numeric',
                        minute: '2-digit',
                        meridiem: false
                      }}
                      headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                      }}
                      events={memoizedEvents}
                      dateClick={handleDateClick}
                      eventClick={handleEventClick}
                      editable={true}
                      selectable={true}
                      selectMirror={true}
                      dayMaxEvents={true}
                      weekends={true}
                      height="auto"
                      contentHeight="auto"
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
                      <RefreshCw className="w-4 h-4 mr-2" />
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
          font-size: 1.125rem;
        }

        .fc .fc-toolbar.fc-header-toolbar {
          margin-bottom: 1.5rem;
          align-items: center;
        }

        /* --- LEFT-SIDE BUTTONS (prev, next, today) --- */
        /* Style all buttons on the left to be purple */
        .fc .fc-toolbar-chunk:first-child .fc-button {
            padding: 0.4rem 1rem !important;
            font-size: 0.875rem !important;
            border-radius: 0.75rem !important;
            border: none !important;
            background-color: #8b5cf6 !important;
            color: white !important;
            box-shadow: none !important;
            text-transform: capitalize !important;
            opacity: 0.9;
            margin: 0 2px;
        }

        .fc .fc-toolbar-chunk:first-child .fc-button:hover {
            opacity: 1;
        }

        /* Remove the "group" look from the prev/next buttons */
        .fc .fc-toolbar-chunk:first-child .fc-button-group {
            background-color: transparent;
            border: none;
        }

        /* --- RIGHT-SIDE BUTTONS (Month, Week, Day) --- */
        /* Style the view-switcher group as a single dark container */
        .fc .fc-toolbar-chunk:last-child .fc-button-group {
          background-color: rgba(30, 30, 30, 0.7);
          border-radius: 0.75rem;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        /* Make the buttons inside the right group transparent by default */
        .fc .fc-toolbar-chunk:last-child .fc-button {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: rgba(255, 255, 255, 0.7) !important;
          padding: 0.4rem 1rem;
          font-size: 0.875rem;
          text-transform: capitalize;
          border-radius: 0;
        }

        /* Add a separator line between buttons in the right group */
        .fc .fc-toolbar-chunk:last-child .fc-button:not(:last-child) {
            border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .fc .fc-toolbar-chunk:last-child .fc-button:hover {
            background-color: rgba(255, 255, 255, 0.1) !important;
        }

        /* Highlight only the active button in the right group */
        .fc .fc-toolbar-chunk:last-child .fc-button.fc-button-active {
            background-color: #8b5cf6 !important;
            color: white !important;
        }

        .fc-theme-standard .fc-list-day-text, .fc-theme-standard .fc-col-header-cell-cushion {
            color: #e5e7eb;
            text-decoration: none;
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
 
 