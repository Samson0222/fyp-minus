-- Minus Voice Assistant Database Schema
-- Run this in Supabase SQL Editor

-- Enable RLS (Row Level Security)
-- ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret'; -- This is set in the Supabase project settings (Authentication -> JWT Settings) and running it here will cause a permission error. This line can be safely ignored.

-- Create core tables
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    accessibility_preferences JSONB DEFAULT '{}',
    voice_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voice interactions log
CREATE TABLE IF NOT EXISTS public.voice_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    transcribed_text TEXT NOT NULL,
    confidence REAL,
    command_intent TEXT,
    response_text TEXT,
    processing_time_ms INTEGER,
    audio_duration_ms INTEGER,
    platform_context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations (text + voice)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    message_type TEXT CHECK (message_type IN ('user_text', 'user_voice', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform integrations (Gmail, Calendar, etc.)
CREATE TABLE IF NOT EXISTS public.platform_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    platform_name TEXT NOT NULL CHECK (platform_name IN ('gmail', 'google_calendar', 'google_docs', 'telegram')),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    integration_settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, platform_name)
);

-- Tasks/Calendar events cache
CREATE TABLE IF NOT EXISTS public.cached_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    item_type TEXT NOT NULL, -- 'email', 'calendar_event', 'document'
    external_id TEXT NOT NULL,
    title TEXT,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, platform, external_id)
);

-- Performance monitoring
CREATE TABLE IF NOT EXISTS public.system_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_type TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_items ENABLE ROW LEVEL SECURITY;

-- Remove 'task' from the check constraint to align with the new design
-- This is a safe operation that will only modify the constraint
DO $$
BEGIN
    ALTER TABLE public.cached_items DROP CONSTRAINT IF EXISTS cached_items_item_type_check;
    ALTER TABLE public.cached_items ADD CONSTRAINT cached_items_item_type_check 
        CHECK (item_type IN ('email', 'calendar_event', 'document'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update cached_items constraint';
END $$;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can view own voice interactions" ON public.voice_interactions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own integrations" ON public.platform_integrations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cached items" ON public.cached_items
    FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_interactions_user_created ON public.voice_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_session ON public.conversations(user_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cached_items_user_platform ON public.cached_items(user_id, platform, item_type);
CREATE INDEX IF NOT EXISTS idx_platform_integrations_user_active ON public.platform_integrations(user_id, is_active);

-- Create functions for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.platform_integrations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.cached_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- The sample data insertion below is removed because it will fail on a fresh database
-- where no user exists in auth.users yet. A test user should be created through
-- the application's sign-up flow instead.
--
-- -- Insert sample data for testing
-- INSERT INTO public.user_profiles (id, email, full_name, accessibility_preferences)
-- VALUES (
--     gen_random_uuid(),
--     'test@example.com',
--     'Test User',
--     '{"voice_feedback": true, "high_contrast": false, "large_text": false}'
-- ) ON CONFLICT (email) DO NOTHING; 