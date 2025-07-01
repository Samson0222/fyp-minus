# Calendar Module Setup Guide

This guide will help you set up the enhanced calendar module with Supabase integration for your voice-first personal assistant.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env.local` file in the `frontend` directory:

```bash
# Copy this to frontend/.env.local and fill in your values

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend API Configuration  
VITE_API_BASE_URL=http://localhost:8000

# Development Settings
VITE_NODE_ENV=development
```

### 2. Supabase Setup

1. **Create a Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Run the Migration**: Execute the SQL migration in your Supabase SQL editor:
   ```sql
   -- Copy the contents of backend/app/migrations/20240630_create_tasks_and_voice_interactions.sql
   -- and run it in your Supabase SQL editor
   ```
3. **Get Your Keys**: 
   - Project URL: Found in Settings > API
   - Anon Key: Found in Settings > API
   - Add these to your `.env.local` file

### 3. Dependencies Check

The calendar module requires these packages (already installed):
```bash
npm list @supabase/supabase-js @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

## 📅 Calendar Features

### ✅ Currently Implemented

- **Direct Calendar Task Creation**: Click any date to create tasks instantly
- **Drag & Drop**: Move tasks between dates by dragging
- **Event Resizing**: Adjust task duration by dragging event edges
- **Real-time Updates**: Changes sync immediately with Supabase
- **Voice Integration Ready**: Tasks created via voice are visually indicated
- **Priority Color Coding**: High (red), Medium (yellow), Low (green)
- **Responsive Design**: Works on desktop and mobile
- **Authentication**: Secure user-based task management

### 🎯 Quick Task Creation Flow

1. **Click any date** → Quick create modal opens
2. **Type task title** → Press Enter or click "Create Task"
3. **Task appears immediately** → Syncs to database automatically

### 🔄 Drag & Drop Features

- **Move tasks**: Drag event to different date/time
- **Resize events**: Drag bottom edge to change duration
- **Visual feedback**: Events revert if save fails

## 🛠 Technical Architecture

### Database Schema

```sql
-- Tasks table with enhanced fields
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ,        -- New unified start time
  end_at TIMESTAMPTZ,          -- New unified end time
  is_all_day BOOLEAN DEFAULT TRUE,
  timezone TEXT DEFAULT 'UTC',
  priority task_priority DEFAULT 'medium',
  status task_status DEFAULT 'todo',
  tags JSONB DEFAULT '[]',
  
  -- Google sync fields (for future)
  google_calendar_event_id TEXT,
  google_task_id TEXT,
  rrule TEXT,                  -- Recurring events
  
  -- Voice integration
  created_via TEXT DEFAULT 'manual',
  voice_command TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Component Structure

```
CalendarViewEnhanced.tsx          # Main calendar component
├── TaskAPI                       # Supabase CRUD operations
├── QuickCreateModal             # Inline task creation
├── Drag & Drop Handlers         # Event manipulation
└── Real-time Subscriptions      # Live updates
```

## 📱 Usage Examples

### Using the Calendar Component

```tsx
import CalendarViewEnhanced from '@/components/tasks/CalendarViewEnhanced';

function App() {
  return (
    <CalendarViewEnhanced
      onTaskCreated={(task) => console.log('New task:', task)}
      onTaskUpdated={(task) => console.log('Updated task:', task)}
      onTaskDeleted={(taskId) => console.log('Deleted task:', taskId)}
    />
  );
}
```

### Direct API Usage

```tsx
import { TaskAPI } from '@/lib/api/tasks';

// Create a task programmatically
const task = await TaskAPI.quickCreateTask(
  new Date(),           // date
  "Team meeting",       // title
  false,               // allDay
  60                   // duration in minutes
);

// Create from voice command
const voiceTask = await TaskAPI.createTaskFromVoice(
  "Hey Minus, schedule lunch tomorrow at 1 PM",
  "Lunch meeting",
  new Date(2024, 11, 25, 13, 0),
  false,
  'medium'
);
```

## 🔧 API Reference

### TaskAPI Methods

```typescript
// CRUD Operations
TaskAPI.createTask(taskData: CreateTaskRequest): Promise<Task>
TaskAPI.getAllTasks(): Promise<Task[]>
TaskAPI.getTask(taskId: string): Promise<Task>
TaskAPI.updateTask(taskId: string, updates: UpdateTaskRequest): Promise<Task>
TaskAPI.deleteTask(taskId: string): Promise<void>

// Calendar-specific
TaskAPI.getTasksInRange(startDate: Date, endDate: Date): Promise<Task[]>
TaskAPI.quickCreateTask(date: Date, title: string, allDay?: boolean, duration?: number): Promise<Task>

// Voice integration
TaskAPI.createTaskFromVoice(command: string, title: string, date?: Date, allDay?: boolean, priority?: 'low' | 'medium' | 'high'): Promise<Task>

// Search & Filter
TaskAPI.searchTasks(query: string): Promise<Task[]>
TaskAPI.getTasksByStatus(status: 'todo' | 'inprogress' | 'done'): Promise<Task[]>
TaskAPI.getTasksByPriority(priority: 'low' | 'medium' | 'high'): Promise<Task[]>

// Batch operations
TaskAPI.bulkUpdateTasks(updates: Array<{ id: string; data: UpdateTaskRequest }>): Promise<Task[]>
TaskAPI.toggleTaskCompletion(taskId: string): Promise<Task>
```

## 🎨 Styling & Customization

### Priority Colors

```typescript
const getPriorityColor = (priority: 'low' | 'medium' | 'high') => {
  switch (priority) {
    case 'high': return '#ef4444';    // red-500
    case 'medium': return '#f59e0b';  // yellow-500
    case 'low': return '#10b981';     // green-500
  }
};
```

### Voice-Created Task Indicator

Tasks created via voice commands have a purple border:
```css
.voice-created {
  border: 2px solid #a855f7 !important;
}
```

## 🔮 Future Enhancements

### Phase 2 (Next Sprint)
- **Google Calendar Sync**: Two-way synchronization
- **Recurring Events**: Support for RRULE patterns
- **Advanced Voice Commands**: "Move my meeting to next Tuesday"
- **Task Templates**: Quick creation from predefined templates

### Phase 3 (Later)
- **Calendar Sharing**: Collaborate with team members
- **Smart Notifications**: AI-powered reminders
- **External Calendar Import**: Outlook, Apple Calendar
- **Offline Support**: Work without internet, sync later

## 🐛 Troubleshooting

### Common Issues

**1. "Missing Supabase environment variables"**
- Check your `.env.local` file exists in the `frontend` directory
- Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
- Restart your dev server after adding environment variables

**2. "User not authenticated" errors**
- Implement authentication in your app using Supabase Auth
- The calendar requires a signed-in user to function

**3. Tasks not appearing in calendar**
- Check the browser console for API errors
- Verify your Supabase RLS policies are correctly set up
- Ensure the database migration was run successfully

**4. Drag & drop not working**
- Check that the `editable={true}` prop is set on FullCalendar
- Verify your tasks have valid `start_at` dates

### Development Commands

```bash
# Start frontend with calendar
cd frontend && npm run dev

# Run backend (for voice integration)
cd backend && python -m uvicorn app.main:app --reload

# Check Supabase connection
# In browser console:
import { supabase } from './src/lib/supabase';
console.log(await supabase.auth.getUser());
```

## 📞 Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Supabase setup and environment variables
3. Ensure all dependencies are installed correctly
4. Check the database migration ran successfully

---

🎉 **You're ready to use the enhanced calendar module!** Click any date to create your first task. 