
import React from 'react';
import { Plus, Circle, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskListViewProps {
  tasks: Task[];
  onAddTaskClick: () => void;
  onTaskToggle: (taskId: string) => void;
}

const TaskListView: React.FC<TaskListViewProps> = ({ 
  tasks, 
  onAddTaskClick,
  onTaskToggle 
}) => {
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const getPriorityDot = (priority: Task['priority']) => {
    const colorClass = getPriorityColor(priority);
    return <Circle className={cn('w-3 h-3 fill-current', colorClass)} />;
  };

  return (
    <div className="space-y-4">
      {/* Add Task Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-white">Tasks</h2>
        <Button 
          onClick={onAddTaskClick}
          className="flex items-center gap-2 bg-violet hover:bg-violet/90"
        >
          <Plus size={16} />
          Add Task
        </Button>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No tasks yet</p>
            <p className="text-sm">Create your first task to get started</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-4 p-4 bg-dark-tertiary rounded-lg border border-white/10 hover:border-violet-light/30 transition-colors",
                task.isCompleted && "opacity-60"
              )}
            >
              {/* Completion Checkbox */}
              <button
                onClick={() => onTaskToggle(task.id)}
                className="flex-shrink-0"
              >
                {task.isCompleted ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-white/40 hover:text-white/60" />
                )}
              </button>

              {/* Task Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn(
                    "font-medium text-white",
                    task.isCompleted && "line-through text-white/50"
                  )}>
                    {task.title}
                  </h3>
                  {getPriorityDot(task.priority)}
                </div>
                
                {task.description && (
                  <p className="text-sm text-white/70 mb-2 line-clamp-2">
                    {task.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-white/50">
                  <span>
                    Due: {format(task.dueDate, 'MMM d, yyyy')}
                  </span>
                  {!task.isAllDay && task.startTime && (
                    <span>
                      {task.startTime}
                      {task.endTime && ` - ${task.endTime}`}
                    </span>
                  )}
                  {task.isAllDay && (
                    <span className="bg-white/10 px-2 py-1 rounded text-xs">
                      All Day
                    </span>
                  )}
                </div>
              </div>

              {/* Priority Indicator */}
              <div className="flex-shrink-0">
                {task.priority === 'high' && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskListView; 