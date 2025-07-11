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
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import '@/styles/calendar.css';
import UnauthorizedPage from '@/components/layout/UnauthorizedPage';

// Google Calendar Event interface
interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end?: string;
  all_day: boolean;
  location?: string;
  attendees?: string[];
  html_link?: string;
  status?: string;
  source: string;
}

interface CalendarState {
  events: CalendarEvent[];
  authStatus: {
    authenticated: boolean;
    message: string;
  };
  loading: boolean;
  lastRefresh?: Date;
}

// Event creation modal state
interface NewEventData {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  all_day: boolean;
}

const Calendar: React.FC = () => {
  const [calendarState, setCalendarState] = useState<CalendarState>({
    events: [],
    authStatus: { authenticated: false, message: 'Checking...' },
    loading: true
  });
  const isPanelVisible = false;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewEvent, setViewEvent] = useState<CalendarEvent | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEventData>({
    summary: '',
    description: '',
    start: new Date(),
    end: new Date(),
    all_day: false
  });
  
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
      const response = await fetch('/api/v1/calendar/events');
      if (!response.ok) throw new Error(`Failed to fetch events: ${response.statusText}`);
      
      const events: CalendarEvent[] = await response.json();
      console.log(`Loaded ${events.length} events from Google Calendar`);

      setCalendarState(prev => ({ ...prev, events, loading: false, lastRefresh: new Date() }));
      // Removed success toast to keep UI clean
    } catch (error) {
      console.error('Failed to load calendar data:', error);
      setCalendarState(prev => ({ ...prev, loading: false }));
      toast({ title: "Error", description: "Failed to load calendar data.", variant: "destructive" });
    }
  };

  const refreshCalendarData = async () => {
    setCalendarState(prev => ({ ...prev, loading: true }));
    toast({ title: "Syncing...", description: "Refreshing from Google Calendar." });

    try {
      await loadCalendarData();
      toast({
        title: "Sync Successful",
        description: "Calendar refreshed from Google Calendar."
      });
    } catch (error) {
      console.error('Failed to refresh calendar data:', error);
      setCalendarState(prev => ({ ...prev, loading: false }));
      toast({ title: "Sync Error", description: "Could not refresh from Google Calendar.", variant: "destructive" });
    }
  };

  const memoizedEvents = useMemo(() => {
    return calendarState.events.map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start,
      end: event.end,
      allDay: event.all_day,
      extendedProps: { ...event },
      className: event.all_day ? 'minus-event-all-day' : 'minus-event-timed',
    }));
  }, [calendarState.events]);

  // Count events happening today (ignores timezone for simplicity)
  const todayEventCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return calendarState.events.filter(ev => ev.start.startsWith(todayStr)).length;
  }, [calendarState.events]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = clickInfo.event.extendedProps as CalendarEvent;
    setViewEvent(event);
    setIsViewOpen(true);
  };

  const handleDateClick = (arg: DateClickArg) => {
    const now = new Date();
    const startDate = new Date(arg.date);
    startDate.setHours(now.getHours(), 0, 0, 0); // Set to top of the hour

    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later
    
    setNewEvent({
      summary: '',
      description: '',
      start: startDate,
      end: endDate,
      all_day: true, 
    });
    setIsModalOpen(true);
  };

  const handleNewEventClick = () => {
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    setNewEvent({
      summary: '',
      description: '',
      start: startDate,
      end: endDate,
      all_day: true,
    });
    setIsModalOpen(true);
  };

  const handleAllDayToggle = (checked: boolean) => {
    if (!checked) {
      // When switching from "All Day" to a timed event, set smart defaults
      const now = new Date();
      // Use the date from the event, but the time from right now
      const newStartDate = new Date(newEvent.start); 
      
      const minutes = now.getMinutes();
      const remainder = minutes % 15;
      
      newStartDate.setHours(now.getHours());
      
      if (remainder !== 0) {
        newStartDate.setMinutes(minutes - remainder + 15);
      } else {
        newStartDate.setMinutes(minutes);
      }
      newStartDate.setSeconds(0, 0);

      const newEndDate = new Date(newStartDate.getTime() + 60 * 60 * 1000); // 1 hour later

      setNewEvent(prev => ({
        ...prev,
        all_day: false,
        start: newStartDate,
        end: newEndDate
      }));
    } else {
      setNewEvent(prev => ({ ...prev, all_day: true }));
    }
  };

  const handleDateChange = (date: Date | null, type: 'start' | 'end') => {
    if (date) {
      const newDate = new Date(date);
      if (type === 'start') {
        setNewEvent(prev => ({ ...prev, start: newDate }));
      } else {
        setNewEvent(prev => ({ ...prev, end: newDate }));
      }
    }
  };

  const handleCreateEvent = async () => {
    try {
      let start, end;
      if (newEvent.all_day) {
        start = new Date(newEvent.start).toISOString().slice(0,10);
        const endDate = new Date(newEvent.start);
        endDate.setDate(endDate.getDate() + 1);
        end = endDate.toISOString().slice(0,10);
      } else {
        start = new Date(newEvent.start).toISOString();
        end = new Date(newEvent.end).toISOString();
      }

      const response = await fetch('/api/v1/calendar/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: newEvent.summary || '(No Title)',
          description: newEvent.description,
          start: start,
          end: end,
          timezone: 'UTC',
          all_day: newEvent.all_day,
        }),
      });

      if (!response.ok) throw new Error('Failed to create event');

      toast({
        title: "Event Created",
        description: "Event successfully added to your Google Calendar.",
      });
      
    setIsModalOpen(false);
      setNewEvent({
        summary: '',
        description: '',
        start: new Date(),
        end: new Date(),
        all_day: false
      });
      
      await loadCalendarData();
    } catch (error) {
      console.error('Failed to create event:', error);
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteEvent = async () => {
    if (!viewEvent) return;
    try {
      const response = await fetch(`/api/v1/calendar/delete-event/${viewEvent.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete event');
      
      toast({
        title: "Event Deleted",
        description: "The event has been removed from your calendar.",
      });
      
      setIsViewOpen(false);
      await loadCalendarData();
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive"
      });
    }
    setIsDeleteConfirmOpen(false);
  };

  const formattedLastRefresh = useMemo(() => {
    if (!calendarState.lastRefresh) return '';
    return calendarState.lastRefresh.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }, [calendarState.lastRefresh]);

  // Custom event rendering function
  const renderEventContent = (eventInfo: EventContentArg) => {
    const isAllDay = (eventInfo.event.extendedProps as CalendarEvent).all_day;
    return (
      <div className="font-sans text-xs flex items-center gap-1 whitespace-nowrap">
        {!isAllDay && eventInfo.timeText && (
          <span className="text-foreground/70 mr-1">{eventInfo.timeText}</span>
        )}
        <span className="truncate">{eventInfo.event.title}</span>
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
      <div className={`h-full flex flex-col transition-all duration-300 ${isPanelVisible ? 'md:grid-cols-[1fr_350px]' : ''}`}>
        <div className="flex-1 flex flex-col bg-dark-primary text-white overflow-hidden">
          {/* Main header */}
          <header className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center space-x-4">
              <CalendarIcon className="w-6 h-6 text-violet-300" />
              <h1 className="text-xl font-bold">My Schedule</h1>
              <Badge variant="secondary">{todayEventCount} events today</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={refreshCalendarData} disabled={calendarState.loading}>
                      <RefreshCw className={`w-5 h-5 ${calendarState.loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh from Google</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
                      <Settings className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calendar Settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button onClick={handleNewEventClick} className="bg-violet hover:bg-violet-light">
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>
            </div>
          </header>

          {/* Main content */}
          <div className="flex-grow flex flex-col min-h-0">
            <Card className="bg-dark-secondary border-white/10 flex-grow">
                <CardContent className="p-6 h-full">
                <div className="h-full">
                      <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    headerToolbar={{
                      left: 'prev,next today',
                      center: 'title',
                      right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                        initialView="dayGridMonth"
                        events={memoizedEvents}
                    eventClick={handleEventClick}
                        dateClick={handleDateClick}
                        editable={true}
                        selectable={true}
                        selectMirror={true}
                        dayMaxEvents={true}
                        weekends={true}
                        height="100%"
                        fixedWeekCount={false}
                        eventContent={renderEventContent}
                    eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar for settings/info */}
        <div className="hidden md:block w-full md:w-auto bg-dark-secondary border-l border-white/10">
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4">Calendar Settings</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="calendar-source">Calendar Source</Label>
                <Input id="calendar-source" value="Google Calendar" disabled />
              </div>
              <div>
                <Label htmlFor="last-sync">Last Sync</Label>
                <Input id="last-sync" value={formattedLastRefresh} disabled />
              </div>
              <div>
                <Label htmlFor="auth-status">Authentication Status</Label>
                <Input id="auth-status" value={calendarState.authStatus.message} disabled />
              </div>
              <div>
                <Label htmlFor="total-events">Total Events</Label>
                <Input id="total-events" value={calendarState.events.length} disabled />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Event Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-dark-secondary border-violet-light/30 text-white">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>
              Add a new event to your Google Calendar. This will be synced automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="summary" className="text-right">
                Title
              </Label>
              <Input
                id="summary"
                value={newEvent.summary}
                onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
                className="col-span-3 bg-dark-tertiary border-white/20"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="col-span-3 bg-dark-tertiary border-white/20"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                Starts
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                 <DatePicker date={newEvent.start} onDateChange={(d) => handleDateChange(d, 'start')} />
                 {!newEvent.all_day && <TimePicker date={newEvent.start} onDateChange={(d) => handleDateChange(d, 'start')} />}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                Ends
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                 <DatePicker date={newEvent.end} onDateChange={(d) => handleDateChange(d, 'end')} />
                 {!newEvent.all_day && <TimePicker date={newEvent.end} onDateChange={(d) => handleDateChange(d, 'end')} />}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="all-day" className="text-right">
                All-day
              </Label>
              <Checkbox
                id="all-day"
                checked={newEvent.all_day}
                onCheckedChange={handleAllDayToggle}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} className="bg-violet hover:bg-violet-light">
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Event Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-md bg-[#1e1e1e] text-white border border-white/10">
          {viewEvent && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {viewEvent.summary}
                </DialogTitle>
                <DialogDescription>
                  {viewEvent.all_day ? 'All Day' : `${new Date(viewEvent.start).toLocaleString()} — ${viewEvent.end ? new Date(viewEvent.end).toLocaleString() : ''}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm py-4">
                {viewEvent.description && (
                  <div>
                    <p className="whitespace-pre-wrap">{viewEvent.description}</p>
                  </div>
                )}
                {viewEvent.location && (
                  <div>
                    <p><strong>Location:</strong> {viewEvent.location}</p>
          </div>
                )}
                {viewEvent.html_link && (
                  <div>
                    <a href={viewEvent.html_link} target="_blank" rel="noopener noreferrer" className="text-violet-light underline">Open in Google Calendar ↗</a>
        </div>
                )}
      </div>
              <DialogFooter className="flex items-center justify-end space-x-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (viewEvent) {
                          setNewEvent({
                            summary: viewEvent.summary,
                            description: viewEvent.description || '',
                            start: new Date(viewEvent.start),
                            end: viewEvent.end ? new Date(viewEvent.end) : new Date(viewEvent.start),
                            all_day: viewEvent.all_day,
                          });
                        }
                        setIsViewOpen(false);
                        setIsModalOpen(true);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit event</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setIsDeleteConfirmOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete event</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="bg-dark-secondary border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event
              from your Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Calendar; 
 
 
 