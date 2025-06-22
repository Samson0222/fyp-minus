import React, { useState, useCallback, useMemo } from 'react';
import { Task, TaskView } from '@/types/task';
import Layout from '@/components/layout/Layout';
import ViewToggle from '@/components/tasks/view-toggle';
import TaskListView from '@/components/tasks/task-list-view';
import CalendarView from '@/components/tasks/calendar-view';
import AddTaskModal from '@/components/tasks/add-task-modal';

const Tasks: React.FC = () => {
  // State management for the task system
  const [currentView, setCurrentView] = useState<TaskView>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>();
  const [modalInitialAllDay, setModalInitialAllDay] = useState(true);

  // Sample data for tasks - this would typically come from an API or state management
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
    {
      id: '4',
      title: 'Buy groceries',
      description: 'Weekly grocery shopping - milk, bread, fruits, vegetables.',
      dueDate: new Date(2024, 11, 24),
      isAllDay: true,
      priority: 'low',
      isCompleted: false,
      syncedToCalendar: false,
    },
    {
      id: '5',
      title: 'Client presentation',
      description: 'Present the new feature updates to the client stakeholders.',
      dueDate: new Date(2024, 11, 26),
      isAllDay: false,
      startTime: '15:00',
      endTime: '16:30',
      priority: 'high',
      isCompleted: false,
      syncedToCalendar: true,
    },
  ]);

  // Handler for changing the current view (list/calendar)
  const handleViewChange = useCallback((view: TaskView) => {
    setCurrentView(view);
  }, []);

  // Handler for opening the add task modal
  const handleAddTaskClick = useCallback(() => {
    setModalInitialDate(undefined);
    setModalInitialAllDay(true);
    setIsModalOpen(true);
  }, []);

  // Handler for opening modal with a specific date from calendar
  const handleCalendarDateClick = useCallback((date: Date, allDay: boolean = true) => {
    setModalInitialDate(date);
    setModalInitialAllDay(allDay);
    setIsModalOpen(true);
  }, []);

  // Handler for closing the modal
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setModalInitialDate(undefined);
    setModalInitialAllDay(true);
  }, []);

  // Handler for creating a new task
  const handleTaskCreate = useCallback((newTaskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: Date.now().toString(), // Simple ID generation - use UUID in production
    };
    
    setTasks(prevTasks => [...prevTasks, newTask]);
  }, []);

  // Handler for toggling task completion status
  const handleTaskToggle = useCallback((taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, isCompleted: !task.isCompleted }
          : task
      )
    );
  }, []);

  // Memoized sorted tasks for performance
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Sort by completion status first (incomplete tasks first)
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      
      // Then sort by due date
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }, [tasks]);

  return (
    <Layout>
      <div className="flex flex-col h-full w-full">
        {/* Content Area - Entire content scrolls */}
        <div className="flex-1 overflow-y-auto main-content-scrollbar mt-20 md:mt-0">
          {/* Spacing for Header */}
          <div className="h-4" />

          {/* Main Content */}
          <div className="px-6">
            {/* Header with View Toggle */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold relative">
                  <span className="relative text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">
                    Tasks & Calendar
                  </span>
                </h1>
                <p className="text-foreground/70 mt-1">
                  Manage your tasks and schedule efficiently
                </p>
              </div>
              
              <ViewToggle 
                currentView={currentView} 
                onViewChange={handleViewChange} 
              />
            </div>

            {/* View Content */}
            <div className="bg-dark-secondary/80 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg p-6 mb-8">
              {currentView === 'list' ? (
                <TaskListView
                  tasks={sortedTasks}
                  onAddTaskClick={handleAddTaskClick}
                  onTaskToggle={handleTaskToggle}
                />
              ) : (
                <CalendarView
                  tasks={sortedTasks}
                  onDateClick={handleCalendarDateClick}
                  onAddTaskClick={handleAddTaskClick}
                />
              )}
            </div>

            {/* Task Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-dark-secondary/80 backdrop-blur-lg border border-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold text-white">
                  {tasks.length}
                </div>
                <div className="text-sm text-foreground/70">Total Tasks</div>
              </div>
              
              <div className="bg-dark-secondary/80 backdrop-blur-lg border border-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">
                  {tasks.filter(task => task.isCompleted).length}
                </div>
                <div className="text-sm text-foreground/70">Completed</div>
              </div>
              
              <div className="bg-dark-secondary/80 backdrop-blur-lg border border-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-400">
                  {tasks.filter(task => !task.isCompleted).length}
                </div>
                <div className="text-sm text-foreground/70">Pending</div>
              </div>
              
              <div className="bg-dark-secondary/80 backdrop-blur-lg border border-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-400">
                  {tasks.filter(task => task.priority === 'high' && !task.isCompleted).length}
                </div>
                <div className="text-sm text-foreground/70">High Priority</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onTaskCreate={handleTaskCreate}
        initialDate={modalInitialDate}
        initialAllDay={modalInitialAllDay}
      />
    </Layout>
  );
};

export default Tasks; 