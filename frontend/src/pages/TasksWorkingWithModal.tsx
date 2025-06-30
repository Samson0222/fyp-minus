import React, { useState, useCallback, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import InteractionArea from '@/components/ai/InteractionArea';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import { Plus, Circle, CheckCircle, List, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Settings, Filter, ChevronDown, MoreHorizontal, Trash2, Edit, Archive, X, ChevronLeft, ChevronRight } from 'lucide-react';

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
  status: 'todo' | 'inprogress' | 'done';
  syncedToCalendar: boolean;
  createDateTime: Date;
  lastUpdateDateTime: Date;
}

type TaskView = 'list' | 'calendar';
type SortDirection = 'asc' | 'desc' | null;

interface TableColumn {
  id: string;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
}

interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface FilterConfig {
  [key: string]: string | string[];
}

const TasksWorkingWithModal: React.FC = () => {
  const [currentView, setCurrentView] = useState<TaskView>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Advanced table state
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'dueDate', direction: 'asc' });
  const [filters, setFilters] = useState<FilterConfig>({});
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);
  const [tempValue, setTempValue] = useState<any>('');
  const [showFloatingMenu, setShowFloatingMenu] = useState<{ taskId: string; field: string; position: { x: number; y: number } } | null>(null);
  
  // Calendar state for custom date picker
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Sample tasks
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Complete project proposal',
      description: 'Finish the Q1 project proposal and submit to management for review.',
      dueDate: new Date(2024, 11, 25),
      isAllDay: true,
      priority: 'high',
      status: 'todo',
      syncedToCalendar: true,
      createDateTime: new Date(),
      lastUpdateDateTime: new Date(),
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
      status: 'inprogress',
      syncedToCalendar: true,
      createDateTime: new Date(),
      lastUpdateDateTime: new Date(),
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
      status: 'done',
      syncedToCalendar: true,
      createDateTime: new Date(),
      lastUpdateDateTime: new Date(),
    },
  ]);

  const handleTaskToggle = useCallback((taskId: string) => {
    const shouldBatchEdit = selectedTasks.has(taskId) && selectedTasks.size > 1;
    const tasksToUpdate = shouldBatchEdit ? Array.from(selectedTasks) : [taskId];
    
    const currentTask = tasks.find(task => task.id === taskId);
    if (!currentTask) return;
    
    const newStatus = currentTask.status === 'todo' ? 'done' : 'todo';
    
    setTasks(prevTasks =>
      prevTasks.map(task =>
        tasksToUpdate.includes(task.id)
          ? { ...task, status: newStatus, lastUpdateDateTime: new Date() }
          : task
      )
    );
  }, [selectedTasks, tasks]);

  const handleAddTask = () => {
    setIsModalOpen(true);
  };

  const handleCreateTask = useCallback((newTask: Task) => {
    setTasks(prevTasks => [newTask, ...prevTasks]);
  }, []);

  const handleSendMessage = (message: string) => {
    console.log('Sending message:', message);
  };

  const handleToggleListening = () => {
    setIsListening(prev => !prev);
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'low': return 'bg-green-500/20 text-green-400';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'done': return 'bg-green-500/20 text-green-400';
      case 'inprogress': return 'bg-blue-500/20 text-blue-400';
      case 'todo': return 'bg-orange-500/20 text-orange-400';
    }
  };

  const getStatusText = (status: Task['status']) => {
    switch (status) {
      case 'done': return 'Done';
      case 'inprogress': return 'In Progress';
      case 'todo': return 'To Do';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Calculate stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(task => task.status === 'done').length;
  const pendingTasks = tasks.filter(task => task.status !== 'done').length;
  const priorityTasks = tasks.filter(task => task.priority === 'high').length;

  return (
    <Layout>
      <div className="flex-1 flex flex-col bg-dark-secondary min-h-screen">
        {/* Header */}
        <div className="bg-dark-secondary border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Tasks & Calendar</h1>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-300">
                  <span className="font-medium text-white">{totalTasks}</span> Total
                </span>
                <span className="text-gray-300">
                  <span className="font-medium text-green-400">{doneTasks}</span> Done
                </span>
                <span className="text-gray-300">
                  <span className="font-medium text-orange-400">{pendingTasks}</span> Pending
                </span>
                <span className="text-gray-300">
                  <span className="font-medium text-red-400">{priorityTasks}</span> Priority
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="bg-dark-tertiary rounded-lg p-1 flex">
                <button
                  onClick={() => setCurrentView('list')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    currentView === 'list'
                      ? 'bg-violet-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <List className="h-4 w-4" />
                  List
                </button>
                <button
                  onClick={() => setCurrentView('calendar')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    currentView === 'calendar'
                      ? 'bg-violet-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  Calendar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {currentView === 'list' ? (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-dark-tertiary border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors cursor-pointer"
                  onClick={() => handleTaskToggle(task.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <button className="mt-1">
                        {task.status === 'done' ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400 hover:text-violet-400 transition-colors" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <h3 className={`font-medium mb-2 ${
                          task.status === 'done' ? 'text-gray-400 line-through' : 'text-white'
                        }`}>
                          {task.title}
                        </h3>
                        
                        {task.description && (
                          <p className="text-gray-400 text-sm mb-3">{task.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-400">
                            {formatDate(task.dueDate)}
                          </span>
                          
                          {!task.isAllDay && task.startTime && task.endTime && (
                            <span className="text-gray-400">
                              {task.startTime} - {task.endTime}
                            </span>
                          )}
                          
                          <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(task.priority)}`}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                          </span>
                          
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(task.status)}`}>
                            {getStatusText(task.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-dark-tertiary rounded-lg p-6 h-96 flex items-center justify-center">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Calendar View</h3>
                <p className="text-gray-400">Calendar view will be implemented here</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Add Button */}
        <button
          onClick={handleAddTask}
          className="fixed bottom-24 right-6 bg-violet-500 hover:bg-violet-600 text-white rounded-full p-4 shadow-lg transition-colors z-40"
        >
          <Plus className="h-6 w-6" />
        </button>

        {/* Create Task Modal */}
        <CreateTaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreateTask={handleCreateTask}
        />

        {/* Interaction Area */}
        <InteractionArea
          onSendMessage={handleSendMessage}
          onToggleListening={handleToggleListening}
          isListening={isListening}
        />
      </div>
    </Layout>
  );
};

export default TasksWorkingWithModal; 