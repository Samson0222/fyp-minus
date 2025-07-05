-- Migration: Add Google Calendar sync status tracking
-- Date: 2024-12-20
-- Purpose: Add is_synced_to_google field to track sync status with Google Calendar

-- Add the is_synced_to_google column to the tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_synced_to_google BOOLEAN DEFAULT FALSE;

-- Add an index for efficient querying of synced tasks
CREATE INDEX IF NOT EXISTS tasks_google_sync_status_idx 
ON public.tasks (is_synced_to_google) 
WHERE is_synced_to_google = TRUE;

-- Add last_synced_at timestamp for tracking when the task was last synced
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Update existing tasks that have google_calendar_event_id to be marked as synced
UPDATE public.tasks 
SET is_synced_to_google = TRUE, 
    last_synced_at = updated_at 
WHERE google_calendar_event_id IS NOT NULL 
  AND is_synced_to_google = FALSE;

-- Create a function to automatically update is_synced_to_google when google_calendar_event_id changes
CREATE OR REPLACE FUNCTION update_google_sync_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If google_calendar_event_id is set and wasn't before, mark as synced
    IF NEW.google_calendar_event_id IS NOT NULL AND OLD.google_calendar_event_id IS NULL THEN
        NEW.is_synced_to_google = TRUE;
        NEW.last_synced_at = NOW();
    END IF;
    
    -- If google_calendar_event_id is cleared, mark as not synced
    IF NEW.google_calendar_event_id IS NULL AND OLD.google_calendar_event_id IS NOT NULL THEN
        NEW.is_synced_to_google = FALSE;
        NEW.last_synced_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically manage sync status
DROP TRIGGER IF EXISTS trigger_update_google_sync_status ON public.tasks;
CREATE TRIGGER trigger_update_google_sync_status
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_google_sync_status();

-- Down Migration (for rollback if needed)
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS is_synced_to_google;
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS last_synced_at;
-- DROP TRIGGER IF EXISTS trigger_update_google_sync_status ON public.tasks;
-- DROP FUNCTION IF EXISTS update_google_sync_status(); 
-- Date: 2024-12-20
-- Purpose: Add is_synced_to_google field to track sync status with Google Calendar

-- Add the is_synced_to_google column to the tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_synced_to_google BOOLEAN DEFAULT FALSE;

-- Add an index for efficient querying of synced tasks
CREATE INDEX IF NOT EXISTS tasks_google_sync_status_idx 
ON public.tasks (is_synced_to_google) 
WHERE is_synced_to_google = TRUE;

-- Add last_synced_at timestamp for tracking when the task was last synced
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Update existing tasks that have google_calendar_event_id to be marked as synced
UPDATE public.tasks 
SET is_synced_to_google = TRUE, 
    last_synced_at = updated_at 
WHERE google_calendar_event_id IS NOT NULL 
  AND is_synced_to_google = FALSE;

-- Create a function to automatically update is_synced_to_google when google_calendar_event_id changes
CREATE OR REPLACE FUNCTION update_google_sync_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If google_calendar_event_id is set and wasn't before, mark as synced
    IF NEW.google_calendar_event_id IS NOT NULL AND OLD.google_calendar_event_id IS NULL THEN
        NEW.is_synced_to_google = TRUE;
        NEW.last_synced_at = NOW();
    END IF;
    
    -- If google_calendar_event_id is cleared, mark as not synced
    IF NEW.google_calendar_event_id IS NULL AND OLD.google_calendar_event_id IS NOT NULL THEN
        NEW.is_synced_to_google = FALSE;
        NEW.last_synced_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically manage sync status
DROP TRIGGER IF EXISTS trigger_update_google_sync_status ON public.tasks;
CREATE TRIGGER trigger_update_google_sync_status
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_google_sync_status();

-- Down Migration (for rollback if needed)
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS is_synced_to_google;
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS last_synced_at;
-- DROP TRIGGER IF EXISTS trigger_update_google_sync_status ON public.tasks;
-- DROP FUNCTION IF EXISTS update_google_sync_status(); 
 
 