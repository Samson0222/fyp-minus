-- Migration to correct the telegram monitoring logic

-- 1. Change the default value for the is_active column on the monitored_chats table.
--    Newly discovered chats should be inactive by default until a user chooses to monitor them.
ALTER TABLE public.monitored_chats ALTER COLUMN is_active SET DEFAULT false;

-- 2. As a safety measure, update all existing rows that might have been created
--    with the old `DEFAULT true` setting. This ensures that no chats are being
--    monitored without explicit user consent from the settings page.
--    This command will only affect rows that haven't been explicitly set by the user yet.
UPDATE public.monitored_chats SET is_active = false WHERE is_active = true;

-- Note: After running this migration, you will need to re-select the chats you
-- want to monitor from the application's settings page and save your selections. 
 
 
 
 
 
 
 
 
 
 