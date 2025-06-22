// Task interface for the Tasks & Calendar system
export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  isAllDay: boolean;
  startTime?: string; // e.g., "10:00"
  endTime?: string; // e.g., "11:00"
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  syncedToCalendar: boolean;
}

// View type for the dual-view system
export type TaskView = 'list' | 'calendar'; 