import React, { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, EventContentArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { CreateTaskModal, Task as ModalTask } from '@/components/tasks/CreateTaskModal';
import '@/styles/calendar.css';
import UnauthorizedPage from '@/components/layout/UnauthorizedPage';

// This should match the Task model from the backend
interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time?: string; 
  end_time?: string;
  is_all_day: boolean;
  timezone?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'inprogress' | 'done';
  type: 'todo' | 'event';
  google_event_id?: string;
  created_at: string;
  updated_at: string;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Establish WebSocket connection
  useEffect(() => {
    const userId = "test_user_001"; 

    if (calendarState.authStatus.authenticated) {
      const ws = new WebSocket(`ws://localhost:8000/ws/calendar/${userId}`);
      ws.onopen = () => console.log("WebSocket connection established for calendar updates.");
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'sync_complete') {
          toast({
            title: "Real-time Update ✨",
            description: "Your calendar has been updated automatically from Google.",
          });
          loadCalendarData();
        }
      };
      ws.onclose = () => console.log("WebSocket connection closed.");
      ws.onerror = (error) => console.error("WebSocket error:", error);
      return () => ws.close();
    }
  }, [calendarState.authStatus.authenticated, toast]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (calendarState.authStatus.authenticated) {
      loadCalendarData();
    }
  }, [calendarState.authStatus.authenticated]);
  
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/v1/auth/google/status');
      const data = await response.json();
      setCalendarState(prev => ({
        ...prev,
        authStatus: { authenticated: data.authenticated, message: data.message },
        loading: !data.authenticated // Stop loading if not authenticated
      }));
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setCalendarState(prev => ({
        ...prev,
        authStatus: { authenticated: false, message: 'Failed to check authentication status' },
        loading: false
      }));
    }
  };

  const loadCalendarData = async () => {
    if (!calendarState.authStatus.authenticated) return;
    setCalendarState(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch('/api/v1/tasks');
      if (!response.ok) throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      
      const tasks: Task[] = await response.json();
      console.log(`Loaded ${tasks.length} tasks from the backend`);

      setCalendarState(prev => ({ ...prev, tasks, loading: false, lastRefresh: new Date() }));
      toast({
        title: "Calendar Loaded",
        description: `Successfully loaded ${tasks.length} tasks and events.`,
      });
    } catch (error) {
      console.error('Failed to load calendar data:', error);
      setCalendarState(prev => ({ ...prev, loading: false }));
      toast({ title: "Error", description: "Failed to load calendar data.", variant: "destructive" });
    }
  };

  const refreshCalendarData = async () => {
    setCalendarState(prev => ({ ...prev, loading: true }));
    toast({ title: "Syncing...", description: "Attempting to sync with Google Calendar." });

    try {
      const syncResponse = await fetch('/api/v1/tasks/sync-from-google', { method: 'POST' });
      if (!syncResponse.ok) throw new Error('Failed to sync with Google Calendar.');
      const syncResult = await syncResponse.json();
      toast({
        title: "Sync Successful",
        description: `Created: ${syncResult.details.created}, Updated: ${syncResult.details.updated}. Refreshing view...`
      });
      await loadCalendarData();
    } catch (error) {
      console.error('Failed to refresh calendar data:', error);
      setCalendarState(prev => ({ ...prev, loading: false }));
      toast({ title: "Sync Error", description: "Could not sync with Google Calendar.", variant: "destructive" });
    }
  };

  const memoizedEvents = useMemo(() => {
    return calendarState.tasks.map(task => ({
      id: task.id,
      title: task.title,
      start: task.start_time,
      end: task.end_time,
      allDay: task.is_all_day,
      extendedProps: { ...task },
      backgroundColor: task.type === 'event' && task.google_event_id ? '#1e8e3e' : (task.type === 'event' ? '#f29900' : '#3174ad'),
      borderColor: task.type === 'event' && task.google_event_id ? '#1e8e3e' : (task.type === 'event' ? '#f29900' : '#3174ad'),
    }));
  }, [calendarState.tasks]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const task = clickInfo.event.extendedProps as Task;
    toast({
      title: `(Task) ${task.title}`,
      description: (
        <div className="text-sm text-white/80">
          <p><strong>Status:</strong> {task.status}</p>
          <p><strong>Priority:</strong> {task.priority}</p>
          <p><strong>Type:</strong> {task.type}</p>
          {task.description && <p><strong>Description:</strong> {task.description}</p>}
          {task.google_event_id && <p className="text-green-400">Synced with Google Calendar</p>}
        </div>
      ),
    });
  };

  const handleDateClick = (arg: DateClickArg) => {
    setSelectedDate(arg.date);
    setIsModalOpen(true);
  };

  const handleTaskCreated = () => {
    setIsModalOpen(false);
    loadCalendarData();
  };

  const formattedLastRefresh = useMemo(() => {
    if (!calendarState.lastRefresh) return '';
    return calendarState.lastRefresh.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }, [calendarState.lastRefresh]);

  // Custom event rendering function
  const renderEventContent = (eventInfo: EventContentArg) => {
    return (
      <div className="font-sans">
        <i>{eventInfo.timeText}</i>
        <b>{eventInfo.event.title}</b>
      </div>
    );
  };

  if (calendarState.loading) {
    return (
      <Layout>
        <div className="p-4">
          <Skeleton className="h-12 w-1/4 mb-4" />
          <Skeleton className="h-[70vh] w-full" />
        </div>
      </Layout>
    );
  }

  if (!calendarState.authStatus.authenticated) {
    return (
      <Layout>
        <UnauthorizedPage serviceName="Google Calendar" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 flex flex-col space-y-6 h-full">
        <div className="flex-shrink-0 flex items-center justify-between">
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
                  ? `Connected to Google • ${calendarState.tasks.length} events`
                  : 'Connect your Google account to get started'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {calendarState.authStatus.authenticated && (
              <Button onClick={refreshCalendarData} variant="outline" size="sm" disabled={calendarState.loading} className="bg-dark-tertiary border-white/10 text-white hover:bg-dark-secondary">
                <RefreshCw className={`w-4 h-4 mr-2 ${calendarState.loading ? 'animate-spin' : ''}`} />
                Sync with Google
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow min-h-0">
          {isPanelVisible && (
            <div className="lg:col-span-1 space-y-4">
              <Card className="bg-dark-secondary border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Settings size={18} />
                    Connection Status
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
                  <p className="text-white/70 text-sm">{calendarState.authStatus.message}</p>
                  {!calendarState.authStatus.authenticated && (
                    <Button onClick={() => navigate('/settings')} className="w-full bg-violet hover:bg-violet/90 text-white">
                      Go to Settings
                    </Button>
                  )}
                </CardContent>
              </Card>
              
              {calendarState.authStatus.authenticated && (
                <>
                  <Card className="bg-dark-secondary border-white/10">
                    <CardHeader className="pb-3"><CardTitle className="text-white text-sm">Statistics</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm">Events & Tasks</span>
                        <Badge variant="secondary" className="bg-violet/20 text-violet">{calendarState.tasks.length}</Badge>
                      </div>
                      {calendarState.lastRefresh && (
                        <div className="pt-2 border-t border-white/10">
                          <span className="text-white/50 text-xs">Last updated: {formattedLastRefresh}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="bg-dark-secondary border-white/10">
                    <CardHeader className="pb-3"><CardTitle className="text-white text-sm">Event Legend</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-xs text-white/70">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: '#1e8e3e'}}></div><span>Google Event</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: '#f29900'}}></div><span>Local Event</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: '#3174ad'}}></div><span>Local Task</span></div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          <div className={isPanelVisible ? "lg:col-span-3" : "lg:col-span-4"}>
            <Card className="bg-dark-secondary border-white/10 h-full">
              <CardContent className="p-6 h-full">
                {calendarState.authStatus.authenticated ? (
                  <div className="calendar-container h-full">
                    <FullCalendar
                      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                      initialView="dayGridMonth"
                      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                      events={memoizedEvents}
                      dateClick={handleDateClick}
                      eventClick={handleEventClick}
                      editable={true}
                      selectable={true}
                      selectMirror={true}
                      dayMaxEvents={true}
                      weekends={true}
                      height="100%"
                      fixedWeekCount={false}
                      eventContent={renderEventContent}
                    />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <CalendarIcon className="mx-auto text-white/30 mb-4" size={64} />
                    <h3 className="text-xl font-semibold text-white mb-2">Connect Your Google Account</h3>
                    <p className="text-white/70 mb-6 max-w-md mx-auto">To sync your calendar and tasks, please connect your Google account in the settings.</p>
                    <Button onClick={() => navigate('/settings')} className="bg-violet hover:bg-violet/90 text-white">
                      Go to Settings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateTask={handleTaskCreated}
        defaultDate={selectedDate}
        availableTags={[]}
        onCreateTag={() => ({ id: '', name: '', color: '', category: 'custom', status: 'todo', createDateTime: new Date(), lastUpdateDateTime: new Date(), severity: 'low' })}
      />
    </Layout>
  );
};

export default Calendar; 
 
 