// Enhanced Task interface for the Calendar system with Supabase integration
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  
  // Updated date/time fields to match database schema
  start_at?: Date;
  end_at?: Date;
  is_all_day: boolean;
  timezone: string;
  
  // Task metadata
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'inprogress' | 'done';
  tags: TaskTag[];
  
  // External sync fields
  google_calendar_event_id?: string;
  google_task_id?: string;
  rrule?: string; // iCalendar recurrence rule
  
  // Google Calendar sync status tracking
  is_synced_to_google: boolean;
  last_synced_at?: Date;
  
  // Voice-first metadata
  created_via: 'voice' | 'text' | 'manual';
  voice_command?: string;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  
  // Deprecated fields (for backwards compatibility during migration)
  /** @deprecated Use start_at instead */
  dueDate?: Date;
  /** @deprecated Use start_at/end_at instead */
  startTime?: string;
  /** @deprecated Use start_at/end_at instead */
  endTime?: string;
  /** @deprecated Use status instead */
  isCompleted?: boolean;
  /** @deprecated Use google_calendar_event_id instead */
  syncedToCalendar?: boolean;
}

// Enhanced tag interface
export interface TaskTag {
  id: string;
  name: string;
  color: string;
  category: 'project' | 'department' | 'priority' | 'type' | 'status' | 'custom';
}

// View type for the dual-view system
export type TaskView = 'list' | 'calendar';

// API request/response types for Supabase
export interface CreateTaskRequest {
  title: string;
  description?: string;
  start_at?: string; // ISO string for API
  end_at?: string;   // ISO string for API
  is_all_day?: boolean;
  timezone?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'inprogress' | 'done';
  tags?: TaskTag[];
  rrule?: string;
  created_via?: 'voice' | 'text' | 'manual';
  voice_command?: string;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  id: string;
}

// Calendar event types for FullCalendar integration
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    description?: string;
    priority: Task['priority'];
    status: Task['status'];
    tags: TaskTag[];
    isCompleted: boolean; // For backwards compatibility
    google_calendar_event_id?: string;
    rrule?: string;
    created_via: Task['created_via'];
    voice_command?: string;
  };
  className?: string;
}

// Voice command types
export interface VoiceCommand {
  text: string;
  intent?: string;
  entities?: {
    date?: string;
    time?: string;
    title?: string;
    priority?: 'low' | 'medium' | 'high';
    duration?: string;
  };
}

export interface VoiceInteraction {
  id: string;
  user_id: string;
  command_text?: string;
  intent?: string;
  entities?: any;
  action_taken?: any;
  success?: boolean;
  created_at: Date;
}

// Helper functions for type conversion
export const convertTaskToCalendarEvent = (task: Task): CalendarEvent => {
  return {
    id: task.id,
    title: task.title,
    start: task.start_at || task.dueDate || new Date(),
    end: task.end_at,
    allDay: task.is_all_day,
    backgroundColor: getPriorityColor(task.priority),
    borderColor: getPriorityColor(task.priority),
    extendedProps: {
      description: task.description,
      priority: task.priority,
      status: task.status,
      tags: task.tags,
      isCompleted: task.status === 'done',
      google_calendar_event_id: task.google_calendar_event_id,
      rrule: task.rrule,
      created_via: task.created_via,
      voice_command: task.voice_command,
    },
    className: task.status === 'done' ? 'opacity-60' : '',
  };
};

export const getPriorityColor = (priority: Task['priority']): string => {
  switch (priority) {
    case 'high':
      return '#ef4444'; // red-500
    case 'medium':
      return '#f59e0b'; // yellow-500
    case 'low':
      return '#10b981'; // green-500
    default:
      return '#6b7280'; // gray-500
  }
};

// Database row conversion helpers
export const convertDatabaseRowToTask = (row: any): Task => {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    start_at: row.start_at ? new Date(row.start_at) : undefined,
    end_at: row.end_at ? new Date(row.end_at) : undefined,
    is_all_day: row.is_all_day,
    timezone: row.timezone,
    priority: row.priority,
    status: row.status,
    tags: row.tags || [],
    google_calendar_event_id: row.google_calendar_event_id,
    google_task_id: row.google_task_id,
    rrule: row.rrule,
    is_synced_to_google: row.is_synced_to_google || false,
    last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
    created_via: row.created_via,
    voice_command: row.voice_command,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    
    // Backwards compatibility
    dueDate: row.start_at ? new Date(row.start_at) : undefined,
    isCompleted: row.status === 'done',
    syncedToCalendar: !!row.google_calendar_event_id,
  };
};

export const convertTaskToDatabaseRow = (task: CreateTaskRequest): any => {
  return {
    title: task.title,
    description: task.description,
    start_at: task.start_at,
    end_at: task.end_at,
    is_all_day: task.is_all_day ?? true,
    timezone: task.timezone ?? 'UTC',
    priority: task.priority ?? 'medium',
    status: task.status ?? 'todo',
    tags: JSON.stringify(task.tags || []),
    rrule: task.rrule,
    created_via: task.created_via ?? 'manual',
    voice_command: task.voice_command,
  };
}; 