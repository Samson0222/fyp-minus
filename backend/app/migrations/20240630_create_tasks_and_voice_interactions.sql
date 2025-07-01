-- Up Migration: Create types, tables, indexes, and RLS policies for the calendar module
-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Custom ENUM types -------------------------------------------------------
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE task_status   AS ENUM ('todo', 'inprogress', 'done');

-- 2. tasks table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core task data
  title       TEXT NOT NULL,
  description TEXT,
  start_at    TIMESTAMPTZ,
  end_at      TIMESTAMPTZ,
  is_all_day  BOOLEAN      DEFAULT TRUE,
  timezone    TEXT         DEFAULT 'UTC',
  priority    task_priority DEFAULT 'medium',
  status      task_status   DEFAULT 'todo',
  tags        JSONB         DEFAULT '[]',

  -- External sync fields
  google_calendar_event_id TEXT,
  google_task_id           TEXT,
  rrule                    TEXT,         -- Recurrence rule (iCal RRULE)

  -- Voice-first metadata
  created_via   TEXT       DEFAULT 'manual',  -- 'voice' | 'text' | 'manual'
  voice_command TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index to avoid duplicate linkage to external calendar events
CREATE UNIQUE INDEX IF NOT EXISTS task_google_event_idx
  ON public.tasks (google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;

-- 3. voice_interactions table ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  command_text  TEXT,
  intent        TEXT,   -- e.g. 'create_task', 'view_calendar'
  entities      JSONB,  -- NLP-extracted entities (dates, times, etc.)
  action_taken  JSONB,  -- What the system actually performed
  success       BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Row Level Security ------------------------------------------------------
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_interactions ENABLE ROW LEVEL SECURITY;

-- Allow users to manage only their own rows
CREATE POLICY "Users can manage their own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own voice interactions" ON public.voice_interactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Grants ------------------------------------------------------------------
-- Supabase's "authenticated" role maps to logged-in users on the client.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_interactions TO authenticated;

-- ---------------------------------------------------------------------------
-- Down Migration (optional)
-- DROP TABLE IF EXISTS public.voice_interactions;
-- DROP TABLE IF EXISTS public.tasks;
-- DROP TYPE  IF EXISTS task_status;
-- DROP TYPE  IF EXISTS task_priority;
-- --------------------------------------------------------------------------- 