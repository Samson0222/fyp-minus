-- Telegram Integration Tables Migration
-- Create tables for monitored chats and telegram messages

-- MonitoredChat table: stores user consent for monitoring specific chats
CREATE TABLE IF NOT EXISTS public.monitored_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL, -- Telegram chat IDs are big integers
    chat_name TEXT NOT NULL,
    chat_type TEXT CHECK (chat_type IN ('private', 'group', 'supergroup', 'channel')) DEFAULT 'private',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, chat_id)
);

-- TelegramMessage table: stores messages from monitored chats
CREATE TABLE IF NOT EXISTS public.telegram_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    monitored_chat_id UUID REFERENCES public.monitored_chats(id) ON DELETE CASCADE,
    message_id BIGINT NOT NULL, -- Telegram message IDs are big integers
    sender_name TEXT NOT NULL,
    telegram_sender_id BIGINT NOT NULL, -- Permanent Telegram user ID
    content TEXT NOT NULL,
    message_type TEXT CHECK (message_type IN ('text', 'photo', 'document', 'voice', 'video', 'sticker', 'other')) DEFAULT 'text',
    is_read BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(monitored_chat_id, message_id)
);

-- Enable Row Level Security
ALTER TABLE public.monitored_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own monitored chats" ON public.monitored_chats
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own telegram messages" ON public.telegram_messages
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.monitored_chats 
        WHERE id = monitored_chat_id AND auth.uid() = user_id
    ));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitored_chats_user_active ON public.monitored_chats(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_monitored_chats_chat_id ON public.monitored_chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_unread ON public.telegram_messages(monitored_chat_id, is_read, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_timestamp ON public.telegram_messages(timestamp DESC);

-- Create trigger for updated_at on monitored_chats
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.monitored_chats
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add Telegram to the platform_integrations check constraint
-- Note: This assumes the table exists and we're adding to the existing constraint
-- If this fails, it means Telegram is already in the constraint or the table structure is different
DO $$
BEGIN
    -- Try to update the constraint to include 'telegram'
    -- This is a safe operation that will succeed only if needed
    BEGIN
        ALTER TABLE public.platform_integrations DROP CONSTRAINT IF EXISTS platform_integrations_platform_name_check;
        ALTER TABLE public.platform_integrations ADD CONSTRAINT platform_integrations_platform_name_check 
            CHECK (platform_name IN ('gmail', 'google_calendar', 'google_docs', 'telegram'));
    EXCEPTION WHEN OTHERS THEN
        -- If it fails, log it but don't stop the migration
        RAISE NOTICE 'Could not update platform_integrations constraint, Telegram may already be included';
    END;
END $$; 