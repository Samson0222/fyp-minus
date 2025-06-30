import { supabase } from '../supabase';
import type { 
  Task, 
  CreateTaskRequest, 
  UpdateTaskRequest, 
  VoiceInteraction 
} from '../../types/task';
import { convertDatabaseRowToTask, convertTaskToDatabaseRow } from '../../types/task';

// Task API service for Supabase integration
export class TaskAPI {
  
  // Get current user ID
  private static async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User not authenticated');
    }
    return user.id;
  }

  // Create a new task
  static async createTask(taskData: CreateTaskRequest): Promise<Task> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        user_id: userId,
        tags: JSON.stringify(taskData.tags || []),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw new Error('Failed to create task');
    }

    // Convert database row to Task type
    return convertDatabaseRowToTask(data);
  }

  // Get all tasks for the current user
  static async getAllTasks(): Promise<Task[]> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      throw new Error('Failed to fetch tasks');
    }

    return data.map(convertDatabaseRowToTask);
  }

  // Get tasks within a date range (for calendar view)
  static async getTasksInRange(startDate: Date, endDate: Date): Promise<Task[]> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('start_at', startDate.toISOString())
      .lte('start_at', endDate.toISOString())
      .order('start_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks in range:', error);
      throw new Error('Failed to fetch tasks in date range');
    }

    return data.map(convertDatabaseRowToTask);
  }

  // Get a single task by ID
  static async getTask(taskId: string): Promise<Task> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching task:', error);
      throw new Error('Task not found');
    }

    return convertDatabaseRowToTask(data);
  }

  // Update a task
  static async updateTask(taskId: string, updates: UpdateTaskRequest): Promise<Task> {
    const userId = await this.getCurrentUserId();
    
    // Prepare update data
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Handle tags serialization
    if (updates.tags) {
      updateData.tags = JSON.stringify(updates.tags);
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      throw new Error('Failed to update task');
    }

    return convertDatabaseRowToTask(data);
  }

  // Delete a task
  static async deleteTask(taskId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting task:', error);
      throw new Error('Failed to delete task');
    }
  }

  // Bulk update tasks (for batch operations)
  static async bulkUpdateTasks(updates: Array<{ id: string; data: UpdateTaskRequest }>): Promise<Task[]> {
    const userId = await this.getCurrentUserId();
    const results: Task[] = [];

    for (const update of updates) {
      try {
        const result = await this.updateTask(update.id, update.data);
        results.push(result);
      } catch (error) {
        console.error(`Failed to update task ${update.id}:`, error);
        // Continue with other updates even if one fails
      }
    }

    return results;
  }

  // Toggle task completion status
  static async toggleTaskCompletion(taskId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    
    return this.updateTask(taskId, { status: newStatus });
  }

  // Quick create from calendar date click
  static async quickCreateTask(
    date: Date, 
    title: string, 
    allDay: boolean = true,
    duration?: number // minutes
  ): Promise<Task> {
    const startDate = new Date(date);
    let endDate: Date | undefined;

    if (!allDay && duration) {
      endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    }

    return this.createTask({
      title,
      start_at: startDate.toISOString(),
      end_at: endDate?.toISOString(),
      is_all_day: allDay,
      created_via: 'manual',
    });
  }

  // Create task from voice command
  static async createTaskFromVoice(
    command: string,
    title: string,
    date?: Date,
    allDay: boolean = true,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<Task> {
    return this.createTask({
      title,
      start_at: date?.toISOString(),
      is_all_day: allDay,
      priority,
      created_via: 'voice',
      voice_command: command,
    });
  }

  // Search tasks by title or description
  static async searchTasks(query: string): Promise<Task[]> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching tasks:', error);
      throw new Error('Failed to search tasks');
    }

    return data.map(convertDatabaseRowToTask);
  }

  // Get tasks by status
  static async getTasksByStatus(status: 'todo' | 'inprogress' | 'done'): Promise<Task[]> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('start_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks by status:', error);
      throw new Error('Failed to fetch tasks by status');
    }

    return data.map(convertDatabaseRowToTask);
  }

  // Get tasks by priority
  static async getTasksByPriority(priority: 'low' | 'medium' | 'high'): Promise<Task[]> {
    const userId = await this.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('priority', priority)
      .order('start_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks by priority:', error);
      throw new Error('Failed to fetch tasks by priority');
    }

    return data.map(convertDatabaseRowToTask);
  }
}

// Voice Interaction API
export class VoiceInteractionAPI {
  
  // Log a voice interaction
  static async logVoiceInteraction(interaction: Omit<VoiceInteraction, 'id' | 'user_id' | 'created_at'>): Promise<VoiceInteraction> {
    const userId = await TaskAPI.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('voice_interactions')
      .insert({
        ...interaction,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging voice interaction:', error);
      throw new Error('Failed to log voice interaction');
    }

    return {
      ...data,
      created_at: new Date(data.created_at),
    };
  }

  // Get voice interaction history
  static async getVoiceHistory(limit: number = 50): Promise<VoiceInteraction[]> {
    const userId = await TaskAPI.getCurrentUserId();
    
    const { data, error } = await supabase
      .from('voice_interactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching voice history:', error);
      throw new Error('Failed to fetch voice history');
    }

    return data.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
    }));
  }
}

// Real-time subscriptions hook
export const useTaskSubscription = (userId: string, onTaskChange: (task: Task, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void) => {
  const subscription = supabase
    .channel('task-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        if (eventType === 'DELETE') {
          onTaskChange(convertDatabaseRowToTask(oldRecord), 'DELETE');
        } else {
          onTaskChange(convertDatabaseRowToTask(newRecord), eventType as 'INSERT' | 'UPDATE');
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}; 