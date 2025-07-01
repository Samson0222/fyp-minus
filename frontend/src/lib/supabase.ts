import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Type definitions for our database
export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description?: string;
          start_at?: string;
          end_at?: string;
          is_all_day: boolean;
          timezone: string;
          priority: 'low' | 'medium' | 'high';
          status: 'todo' | 'inprogress' | 'done';
          tags: any[];
          google_calendar_event_id?: string;
          google_task_id?: string;
          rrule?: string;
          created_via: string;
          voice_command?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string;
          start_at?: string;
          end_at?: string;
          is_all_day?: boolean;
          timezone?: string;
          priority?: 'low' | 'medium' | 'high';
          status?: 'todo' | 'inprogress' | 'done';
          tags?: any[];
          google_calendar_event_id?: string;
          google_task_id?: string;
          rrule?: string;
          created_via?: string;
          voice_command?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          start_at?: string;
          end_at?: string;
          is_all_day?: boolean;
          timezone?: string;
          priority?: 'low' | 'medium' | 'high';
          status?: 'todo' | 'inprogress' | 'done';
          tags?: any[];
          google_calendar_event_id?: string;
          google_task_id?: string;
          rrule?: string;
          created_via?: string;
          voice_command?: string;
        };
      };
      voice_interactions: {
        Row: {
          id: string;
          user_id: string;
          command_text?: string;
          intent?: string;
          entities?: any;
          action_taken?: any;
          success?: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          command_text?: string;
          intent?: string;
          entities?: any;
          action_taken?: any;
          success?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          command_text?: string;
          intent?: string;
          entities?: any;
          action_taken?: any;
          success?: boolean;
        };
      };
    };
  };
}

// Helper functions for authentication
export const auth = {
  // Get current user
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign up with email and password
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Listen to auth state changes
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Helper function for real-time subscriptions
export const subscribeToTaskChanges = (
  userId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel('tasks-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
}; 