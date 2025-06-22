import React, { useState, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import InteractionArea from '@/components/ai/InteractionArea';
import { Plus, Circle, CheckCircle, List, Calendar } from 'lucide-react';

// Define types locally to avoid import issues
interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  syncedToCalendar: boolean;
}

type TaskView = 'list' | 'calendar';

const TasksWorking: React.FC = () => {
  const [currentView, setCurrentView] = useState<TaskView>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Sample tasks
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Complete project proposal',
      description: 'Finish the Q1 project proposal and submit to management for review.',
      dueDate: new Date(2024, 11, 25),
      isAllDay: true,
      priority: 'high',
      isCompleted: false,
      syncedToCalendar: true,
    },
    {
      id: '2',
      title: 'Team meeting',
      description: 'Weekly team sync to discuss project progress and blockers.',
      dueDate: new Date(2024, 11, 23),
      isAllDay: false,
      startTime: '10:00',
      endTime: '11:00',
      priority: 'medium',
      isCompleted: false,
      syncedToCalendar: true,
    },
    {
      id: '3',
      title: 'Code review',
      description: 'Review pull requests from the development team.',
      dueDate: new Date(2024, 11, 22),
      isAllDay: false,
      startTime: '14:00',
      endTime: '15:30',
      priority: 'medium',
      isCompleted: true,
      syncedToCalendar: true,
    },
  ]);

  const handleTaskToggle = useCallback((taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, isCompleted: !task.isCompleted }
          : task
      )
    );
  }, []);

  const handleAddTask = () => {
    setIsModalOpen(true);
  };

  const handleSendMessage = (message: string) => {
    // Voice interaction handling - can be enhanced later
    console.log('Voice message:', message);
  };

  const handleToggleListening = () => {
    setIsListening(!isListening);
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-white/50';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <Layout>
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 overflow-y-auto main-content-scrollbar mt-20 md:mt-0">
          <div className="h-4" />
          <div className="px-6">
            {/* Header with View Toggle */}
            <div className="flex flex-col gap-4 mb-6">
              {/* Desktop Layout - Compact Statistics + Toggle */}
              <div className="hidden sm:flex items-center justify-between gap-4">
                {/* Desktop Compact Statistics */}
                <div className="flex items-center gap-4 text-sm text-white/80">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{tasks.length}</span>
                    <span>Total</span>
                  </div>
                  <span className="text-white/30">•</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-400">{tasks.filter(task => task.isCompleted).length}</span>
                    <span>Done</span>
                  </div>
                  <span className="text-white/30">•</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-orange-400">{tasks.filter(task => !task.isCompleted).length}</span>
                    <span>Pending</span>
                  </div>
                  <span className="text-white/30">•</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-400">{tasks.filter(task => task.priority === 'high' && !task.isCompleted).length}</span>
                    <span>Priority</span>
                  </div>
                </div>
                
                {/* Desktop View Toggle */}
                <div className="inline-flex bg-dark-tertiary rounded-lg p-1">
                  <button
                    onClick={() => setCurrentView('list')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentView === 'list'
                        ? 'bg-violet text-white shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <List size={16} />
                    List
                  </button>
                  <button
                    onClick={() => setCurrentView('calendar')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentView === 'calendar'
                        ? 'bg-violet text-white shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Calendar size={16} />
                    Calendar
                  </button>
                </div>
              </div>

              {/* Mobile Layout - Stats inline with Toggle */}
              <div className="sm:hidden flex items-center justify-between gap-2">
                {/* Mobile Compact Statistics */}
                <div className="flex items-center gap-1 text-sm text-white/80">
                  <span className="font-semibold text-white">{tasks.length}</span>
                  <span>Total</span>
                  <span className="mx-1">•</span>
                  <span className="font-semibold text-green-400">{tasks.filter(task => task.isCompleted).length}</span>
                  <span>Done</span>
                  <span className="mx-1">•</span>
                  <span className="font-semibold text-orange-400">{tasks.filter(task => !task.isCompleted).length}</span>
                  <span>Pending</span>
                  <span className="mx-1">•</span>
                  <span className="font-semibold text-red-400">{tasks.filter(task => task.priority === 'high' && !task.isCompleted).length}</span>
                  <span>Priority</span>
                </div>
                
                {/* Mobile View Toggle */}
                <div className="inline-flex bg-dark-tertiary rounded-lg p-1">
                  <button
                    onClick={() => setCurrentView('list')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      currentView === 'list'
                        ? 'bg-violet text-white shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <List size={12} />
                    List
                  </button>
                  <button
                    onClick={() => setCurrentView('calendar')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      currentView === 'calendar'
                        ? 'bg-violet text-white shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Calendar size={12} />
                    Calendar
                  </button>
                </div>
              </div>
            </div>

            {/* Content Area */}
            {currentView === 'list' ? (
              <div className="space-y-4 mb-6">

                  {/* Table-like Task List */}
                  <div className="bg-dark-tertiary/50 rounded-lg border border-white/10 overflow-hidden">
                    {/* Desktop Table Header */}
                    <div className="hidden sm:grid grid-cols-1 gap-4 p-4 bg-dark-tertiary border-b border-white/10 text-xs font-medium text-white/70 uppercase tracking-wide">
                      <div>Task</div>
                    </div>

                    {/* Mobile Table Header */}
                    <div className="sm:hidden grid grid-cols-[40px_1fr_auto] gap-3 p-4 bg-dark-tertiary border-b border-white/10 text-xs font-medium text-white/70 uppercase tracking-wide">
                      <div></div>
                      <div>Task</div>
                      <div>Status</div>
                    </div>
                    
                    {/* Table Body */}
                    <div className="divide-y divide-white/5">
                      {tasks.map((task) => (
                        <div key={task.id}>
                          {/* Desktop Layout */}
                          <div
                            className={`hidden sm:grid grid-cols-1 gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                              task.isCompleted ? 'opacity-60' : ''
                            }`}
                            onClick={() => handleTaskToggle(task.id)}
                          >
                            {/* Task Title Only */}
                            <div className="flex items-center">
                              <h3 className={`font-medium text-sm ${
                                task.isCompleted 
                                  ? 'line-through text-white/50' 
                                  : 'text-white'
                              }`}>
                                {task.title}
                              </h3>
                            </div>
                          </div>

                          {/* Mobile Layout - Only Title and Status */}
                          <div
                            className={`sm:hidden grid grid-cols-[40px_1fr_auto] gap-3 p-4 hover:bg-white/5 transition-colors ${
                              task.isCompleted ? 'opacity-60' : ''
                            }`}
                          >
                            {/* Completion Checkbox */}
                            <div className="flex items-center">
                              <button
                                onClick={() => handleTaskToggle(task.id)}
                                className="flex-shrink-0"
                              >
                                {task.isCompleted ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Circle className="w-4 h-4 text-white/40 hover:text-white/60" />
                                )}
                              </button>
                            </div>

                            {/* Task Title Only */}
                            <div className="flex items-center min-w-0">
                              <h3 className={`font-medium text-sm truncate ${
                                task.isCompleted 
                                  ? 'line-through text-white/50' 
                                  : 'text-white'
                              }`}>
                                {task.title}
                              </h3>
                            </div>

                            {/* Status Only */}
                            <div className="flex items-center">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                task.isCompleted 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-orange-500/20 text-orange-400'
                              }`}>
                                {task.isCompleted ? 'Done' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  <div className="bg-dark-tertiary/50 rounded-lg border border-white/10 p-8 text-center">
                    <Calendar size={48} className="mx-auto mb-4 text-white/40" />
                    <h3 className="text-lg font-medium text-white mb-2">Calendar View</h3>
                    <p className="text-white/70">
                      Calendar functionality coming soon. For now, use the List view to manage your tasks.
                    </p>
                  </div>
                </div>
              )}



            {/* Simple Modal Placeholder */}
            {isModalOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-dark-secondary rounded-lg border border-white/10 p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Add New Task</h3>
                  <p className="text-white/70 mb-4">
                    Task creation modal will be implemented in the next step.
                  </p>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-violet text-white rounded-lg hover:bg-violet/90 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Add Task Button */}
        <button
          onClick={handleAddTask}
          className="fixed bottom-24 right-6 z-50 flex items-center justify-center w-14 h-14 bg-violet text-white rounded-full shadow-lg hover:bg-violet/90 transition-all hover:scale-105"
        >
          <Plus size={24} />
        </button>
        
        {/* Interaction Area at the bottom */}
        <div className="flex-shrink-0">
          <InteractionArea
            onSendMessage={handleSendMessage}
            onToggleListening={handleToggleListening}
            isListening={isListening}
          />
        </div>
      </div>
    </Layout>
  );
};

export default TasksWorking; 