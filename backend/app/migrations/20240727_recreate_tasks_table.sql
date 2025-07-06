-- This script completely drops and recreates the tasks table to ensure a clean, correct schema.
-- WARNING: This will delete all existing data in the tasks table.

-- 1. Drop existing objects if they exist to avoid conflicts
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TYPE IF EXISTS task_priority;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS task_type;

-- 2. Recreate ENUM types
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE task_status AS ENUM ('todo', 'inprogress', 'done');
CREATE TYPE task_type AS ENUM ('todo', 'event'); -- New type for distinguishing tasks and events

-- 3. Recreate the tasks table with the final, consolidated schema
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core task data
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  is_all_day BOOLEAN DEFAULT false,
  timezone TEXT DEFAULT 'UTC',
  
  -- Type and Status
  type task_type NOT NULL DEFAULT 'todo', -- Distinguishes 'todo' from 'event'
  priority task_priority DEFAULT 'medium',
  status task_status DEFAULT 'todo',

  -- Google Sync Fields (consolidated and corrected)
  google_calendar_id TEXT DEFAULT 'primary',
  google_event_id TEXT UNIQUE, -- CRITICAL for linking calendar events
  google_task_id TEXT UNIQUE, -- For future Google Tasks integration
  last_synced_at TIMESTAMPTZ,

  -- Advanced features
  tags JSONB DEFAULT '[]',
  rrule TEXT, -- For iCal recurrence rules

  -- Metadata
  created_via TEXT DEFAULT 'manual',
  voice_command TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recreate Indexes for performance
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_google_event_id ON public.tasks(google_event_id);
CREATE INDEX idx_tasks_start_at ON public.tasks(start_at);

-- 5. Re-enable Row Level Security (VERY IMPORTANT FOR SECURITY)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6. Recreate RLS Policies
CREATE POLICY "Users can manage their own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Re-apply Grants for the authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated; 