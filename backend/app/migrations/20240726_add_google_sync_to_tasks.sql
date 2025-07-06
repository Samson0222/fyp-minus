-- Create the new ENUM type first
CREATE TYPE task_type AS ENUM ('todo', 'event');

-- Now, alter the existing tasks table with all necessary columns
ALTER TABLE tasks
  ADD COLUMN type task_type NOT NULL DEFAULT 'todo',
  ADD COLUMN google_event_id TEXT UNIQUE,
  ADD COLUMN google_task_id TEXT UNIQUE, -- Future-proofing
  ADD COLUMN google_calendar_id TEXT DEFAULT 'primary',
  ADD COLUMN rrule TEXT, -- For recurring events
  ADD COLUMN last_synced_at TIMESTAMPTZ; 