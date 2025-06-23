import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, List, Plus, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, CheckCircle, Circle, Trash2 } from 'lucide-react';
import Layout from '../components/layout/Layout';
import InteractionArea from '../components/ai/InteractionArea';

// Local types - avoiding complex imports
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

const TasksImproved: React.FC = () => {
  const [currentView, setCurrentView] = useState<TaskView>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [filters, setFilters] = useState<FilterConfig>({});

  // Floating menu state (no more inline editing!)
  const [showFloatingMenu, setShowFloatingMenu] = useState<{ taskId: string; field: string; position: { x: number; y: number } } | null>(null);
  
  // Column configuration with improved widths for Priority and Status full display
  const [columns, setColumns] = useState<TableColumn[]>([
    { id: 'title', label: 'Task', width: 300, visible: true, sortable: true, filterable: true },
    { id: 'description', label: 'Description', width: 250, visible: true, sortable: false, filterable: true },
    { id: 'dueDate', label: 'Due Date', width: 120, visible: true, sortable: true, filterable: true },
    { id: 'time', label: 'Time', width: 120, visible: true, sortable: false, filterable: false },
    { id: 'priority', label: 'Priority', width: 120, visible: true, sortable: true, filterable: true }, // Increased from 110
    { id: 'status', label: 'Status', width: 110, visible: true, sortable: true, filterable: true },    // Increased from 100
  ]);

  // Column minimum widths updated for full title display
  const getColumnMinWidth = (columnId: string) => {
    switch (columnId) {
      case 'title': return 100;
      case 'description': return 120;
      case 'dueDate': return 110;
      case 'time': return 60;
      case 'priority': return 110; // Increased to ensure "Priority" + sort button fits
      case 'status': return 100;   // Increased to ensure "Status" + sort button fits
      default: return 50;
    }
  };

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

  // Table handlers
  const handleSort = useCallback((columnId: string) => {
    setSortConfig(prevSort => ({
      key: columnId,
      direction: prevSort.key === columnId && prevSort.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  // Memoized filtered and sorted tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        filtered = filtered.filter(task => {
          switch (key) {
            case 'title':
              return task.title.toLowerCase().includes(value.toString().toLowerCase());
            case 'description':
              return task.description?.toLowerCase().includes(value.toString().toLowerCase()) || false;
            case 'priority':
              return Array.isArray(value) ? value.includes(task.priority) : task.priority === value;
            case 'status':
              const status = task.isCompleted ? 'completed' : 'pending';
              return Array.isArray(value) ? value.includes(status) : status === value;
            default:
              return true;
          }
        });
      }
    });

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortConfig.key) {
          case 'title':
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case 'dueDate':
            aValue = a.dueDate.getTime();
            bValue = b.dueDate.getTime();
            break;
          case 'priority':
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            aValue = priorityOrder[a.priority];
            bValue = priorityOrder[b.priority];
            break;
          case 'status':
            aValue = a.isCompleted ? 1 : 0;
            bValue = b.isCompleted ? 1 : 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [tasks, filters, sortConfig]);

  const handleSelectAll = useCallback(() => {
    const allTaskIds = filteredAndSortedTasks.map(task => task.id);
    if (selectedTasks.size === allTaskIds.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(allTaskIds));
    }
  }, [filteredAndSortedTasks, selectedTasks]);

  const handleBatchAction = useCallback((action: string) => {
    const selectedTaskIds = Array.from(selectedTasks);
    switch (action) {
      case 'complete':
        setTasks(prevTasks =>
          prevTasks.map(task =>
            selectedTaskIds.includes(task.id)
              ? { ...task, isCompleted: true }
              : task
          )
        );
        break;
      case 'incomplete':
        setTasks(prevTasks =>
          prevTasks.map(task =>
            selectedTaskIds.includes(task.id)
              ? { ...task, isCompleted: false }
              : task
          )
        );
        break;
      case 'delete':
        setTasks(prevTasks =>
          prevTasks.filter(task => !selectedTaskIds.includes(task.id))
        );
        break;
      case 'high-priority':
        setTasks(prevTasks =>
          prevTasks.map(task =>
            selectedTaskIds.includes(task.id)
              ? { ...task, priority: 'high' as const }
              : task
          )
        );
        break;
    }
    setSelectedTasks(new Set());
    setShowBatchActions(false);
  }, [selectedTasks]);

  const handleAddTask = () => {
    setIsModalOpen(true);
  };

  const handleSendMessage = (message: string) => {
    console.log('Sending message:', message);
  };

  const handleToggleListening = () => {
    setIsListening(prev => !prev);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Floating menu handlers - single click to show
  const showFloatingMenuFor = useCallback((taskId: string, field: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setShowFloatingMenu({
      taskId,
      field,
      position: { x: rect.left, y: rect.bottom + 4 }
    });
  }, []);

  const hideFloatingMenu = useCallback(() => {
    setShowFloatingMenu(null);
  }, []);

  const selectFloatingMenuOption = useCallback((value: any) => {
    if (!showFloatingMenu) return;
    
    const { taskId, field } = showFloatingMenu;
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          switch (field) {
            case 'priority':
              return { ...task, priority: value as Task['priority'] };
            case 'status':
              return { ...task, isCompleted: value === 'completed' };
            case 'time':
              if (value.isAllDay) {
                return { ...task, isAllDay: true, startTime: undefined, endTime: undefined };
              } else {
                return { ...task, isAllDay: false, startTime: value.startTime, endTime: value.endTime };
              }
            case 'dueDate':
              return { ...task, dueDate: new Date(value) };
            default:
              return task;
          }
        }
        return task;
      })
    );
    
    hideFloatingMenu();
  }, [showFloatingMenu, hideFloatingMenu]);

  // Close floating menu when clicking outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (showFloatingMenu) {
      const target = e.target as Element;
      if (!target.closest('.floating-menu')) {
        hideFloatingMenu();
      }
    }
  }, [showFloatingMenu, hideFloatingMenu]);

  // Add click outside listener
  React.useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

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
                {/* Table Controls */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {/* Bulk Actions */}
                    {selectedTasks.size > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowBatchActions(!showBatchActions)}
                          className="flex items-center gap-2 px-3 py-2 bg-violet/20 text-violet-300 rounded-lg border border-violet/30 hover:bg-violet/30 transition-colors"
                        >
                          <MoreHorizontal size={16} />
                          {selectedTasks.size} selected
                        </button>
                        {showBatchActions && (
                          <div className="absolute top-full mt-2 left-0 bg-dark-secondary border border-white/10 rounded-lg shadow-lg p-2 z-10 min-w-48">
                            <button
                              onClick={() => handleBatchAction('complete')}
                              className="w-full text-left px-3 py-2 hover:bg-white/5 rounded text-sm text-white flex items-center gap-2"
                            >
                              <CheckCircle size={14} />
                              Mark as Complete
                            </button>
                            <button
                              onClick={() => handleBatchAction('incomplete')}
                              className="w-full text-left px-3 py-2 hover:bg-white/5 rounded text-sm text-white flex items-center gap-2"
                            >
                              <Circle size={14} />
                              Mark as Pending
                            </button>
                            <button
                              onClick={() => handleBatchAction('high-priority')}
                              className="w-full text-left px-3 py-2 hover:bg-white/5 rounded text-sm text-white flex items-center gap-2"
                            >
                              <ArrowUp size={14} />
                              Set High Priority
                            </button>
                            <hr className="my-2 border-white/10" />
                            <button
                              onClick={() => handleBatchAction('delete')}
                              className="w-full text-left px-3 py-2 hover:bg-red-500/20 rounded text-sm text-red-400 flex items-center gap-2"
                            >
                              <Trash2 size={14} />
                              Delete Tasks
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Advanced Table */}
                <div className="bg-dark-tertiary/30 rounded-lg border border-white/10 overflow-hidden">
                  {/* Desktop Table */}
                  <div className="hidden sm:block">
                    {/* Desktop Header */}
                    <div 
                      className="grid gap-4 p-4 bg-dark-tertiary border-b border-white/10 text-xs font-medium text-white/70 uppercase tracking-wide"
                      style={{
                        gridTemplateColumns: `40px ${columns.filter(col => col.visible).map(col => `${col.width}px`).join(' ')}`
                      }}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedTasks.size === filteredAndSortedTasks.length && filteredAndSortedTasks.length > 0}
                          onChange={handleSelectAll}
                          className="w-3 h-3 bg-dark-secondary border border-white/20 rounded text-violet focus:ring-violet focus:ring-1"
                        />
                      </div>
                      {columns.filter(col => col.visible).map(column => (
                        <div key={column.id} className="flex items-center gap-2" style={{ minWidth: getColumnMinWidth(column.id) }}>
                          <span>{column.label}</span>
                          {column.sortable && (
                            <button
                              onClick={() => handleSort(column.id)}
                              className="p-0.5 hover:bg-white/10 rounded transition-colors"
                            >
                              {sortConfig.key === column.id ? (
                                sortConfig.direction === 'asc' ? (
                                  <ArrowUp size={12} className="text-violet" />
                                ) : (
                                  <ArrowDown size={12} className="text-violet" />
                                )
                              ) : (
                                <ArrowUpDown size={12} className="text-white/40" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Desktop Body */}
                    <div className="divide-y divide-white/5">
                      {filteredAndSortedTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`grid gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                            task.isCompleted ? 'opacity-60' : ''
                          }`}
                          style={{
                            gridTemplateColumns: `40px ${columns.filter(col => col.visible).map(col => `${col.width}px`).join(' ')}`
                          }}
                          onClick={() => handleTaskToggle(task.id)}
                        >
                          {/* Checkbox */}
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedTasks.has(task.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectTask(task.id);
                              }}
                              className="w-3 h-3 bg-dark-secondary border border-white/20 rounded text-violet focus:ring-violet focus:ring-1"
                            />
                          </div>

                          {/* Dynamic Columns */}
                          {columns.filter(col => col.visible).map(column => (
                            <div 
                              key={column.id} 
                              className="flex items-center min-w-0"
                              style={{ minWidth: getColumnMinWidth(column.id) }}
                            >
                              {column.id === 'title' && (
                                <div className="min-w-0 flex-1">
                                  <h3 className={`font-medium text-sm truncate ${
                                    task.isCompleted 
                                      ? 'line-through text-white/50' 
                                      : 'text-white'
                                  }`}>
                                    {task.title}
                                  </h3>
                                </div>
                              )}
                              {column.id === 'description' && (
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-white/70 truncate">
                                    {task.description || '-'}
                                  </p>
                                </div>
                              )}
                              {column.id === 'dueDate' && (
                                <div className="w-full">
                                  <button
                                    onClick={(e) => showFloatingMenuFor(task.id, 'dueDate', e)}
                                    className={`text-sm text-white/80 hover:text-white hover:bg-white/5 px-2 py-1 rounded transition-colors w-full text-left ${
                                      column.width >= 120 ? 'whitespace-nowrap' : 'break-words'
                                    }`}
                                  >
                                    {formatDate(task.dueDate)}
                                  </button>
                                </div>
                              )}
                              {column.id === 'time' && (
                                <div className="w-full">
                                  <button
                                    onClick={(e) => showFloatingMenuFor(task.id, 'time', e)}
                                    className="w-full hover:bg-white/5 px-2 py-1 rounded transition-colors text-left"
                                  >
                                    {!task.isAllDay && task.startTime ? (
                                      column.width >= 110 ? (
                                        <span className="text-sm text-white/70 whitespace-nowrap">
                                          {task.startTime}
                                          {task.endTime && `-${task.endTime}`}
                                        </span>
                                      ) : (
                                        <div className="text-sm text-white/70 leading-tight text-center space-y-0.5">
                                          <div>{task.startTime}</div>
                                          {task.endTime && (
                                            <>
                                              <div className="text-xs text-white/40">-</div>
                                              <div>{task.endTime}</div>
                                            </>
                                          )}
                                        </div>
                                      )
                                    ) : (
                                      <div className="flex justify-center">
                                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/60">
                                          All Day
                                        </span>
                                      </div>
                                    )}
                                  </button>
                                </div>
                              )}
                              {column.id === 'priority' && (
                                <div className="w-full">
                                  <button
                                    onClick={(e) => showFloatingMenuFor(task.id, 'priority', e)}
                                    className="flex items-center gap-2 hover:bg-white/5 px-2 py-1 rounded transition-colors w-full"
                                  >
                                    <div className={`w-2 h-2 rounded-full ${
                                      task.priority === 'high' ? 'bg-red-500' :
                                      task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}></div>
                                    <span className="text-sm text-white/70 capitalize">{task.priority}</span>
                                  </button>
                                </div>
                              )}
                              {column.id === 'status' && (
                                <div className="w-full">
                                  <button
                                    onClick={(e) => showFloatingMenuFor(task.id, 'status', e)}
                                    className={`text-xs px-2 py-1 rounded-full transition-colors w-full ${
                                      task.isCompleted 
                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                                        : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                    }`}
                                  >
                                    {task.isCompleted ? 'Done' : 'Pending'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mobile Table */}
                  <div className="sm:hidden">
                    {/* Mobile Header */}
                    <div className="grid grid-cols-[40px_1fr_auto] gap-3 p-4 bg-dark-tertiary border-b border-white/10 text-xs font-medium text-white/70 uppercase tracking-wide">
                      <div></div>
                      <div>Task</div>
                      <div>Status</div>
                    </div>
                    
                    {/* Mobile Body */}
                    <div className="divide-y divide-white/5">
                      {filteredAndSortedTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`grid grid-cols-[40px_1fr_auto] gap-3 p-4 hover:bg-white/5 transition-colors ${
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

                          {/* Task Title */}
                          <div className="flex items-center min-w-0">
                            <h3 className={`font-medium text-sm truncate ${
                              task.isCompleted 
                                ? 'line-through text-white/50' 
                                : 'text-white'
                            }`}>
                              {task.title}
                            </h3>
                          </div>

                          {/* Status */}
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
                      ))}
                    </div>
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
          className="fixed bottom-24 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-violet text-white rounded-full shadow-lg hover:bg-violet/90 transition-all hover:scale-105"
        >
          <Plus size={20} />
          <span className="text-sm font-medium">Create Task</span>
        </button>
        
        {/* Interaction Area at the bottom */}
        <div className="flex-shrink-0">
          <InteractionArea
            onSendMessage={handleSendMessage}
            onToggleListening={handleToggleListening}
            isListening={isListening}
          />
        </div>

        {/* Floating Menus - Custom styled cards with visual consistency */}
        {showFloatingMenu && (
          <div 
            className="floating-menu fixed z-50 bg-dark-secondary border border-white/10 rounded-lg shadow-lg p-2 min-w-40"
            style={{
              left: showFloatingMenu.position.x,
              top: showFloatingMenu.position.y
            }}
          >
            {/* Priority Menu */}
            {showFloatingMenu.field === 'priority' && (
              <div className="space-y-1">
                {(['high', 'medium', 'low'] as const).map((priority) => (
                  <button
                    key={priority}
                    onClick={() => selectFloatingMenuOption(priority)}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 rounded text-sm text-white flex items-center gap-2 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      priority === 'high' ? 'bg-red-500' :
                      priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}></div>
                    <span className="capitalize">{priority}</span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Status Menu */}
            {showFloatingMenu.field === 'status' && (
              <div className="space-y-1">
                {(['pending', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => selectFloatingMenuOption(status)}
                    className={`w-full text-left px-3 py-2 hover:bg-white/5 rounded text-xs transition-colors ${
                      status === 'completed' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-orange-500/20 text-orange-400'
                    }`}
                  >
                    {status === 'completed' ? 'Done' : 'Pending'}
                  </button>
                ))}
              </div>
            )}

            {/* Time Menu */}
            {showFloatingMenu.field === 'time' && (
              <div className="space-y-3 p-2 min-w-64">
                <div className="space-y-2">
                  <button
                    onClick={() => selectFloatingMenuOption({ isAllDay: true })}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 rounded text-sm text-white transition-colors"
                  >
                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/60">All Day</span>
                  </button>
                  
                  <div className="border-t border-white/10 pt-2">
                    <div className="text-xs text-white/60 mb-2 px-3">Set Time</div>
                    <div className="grid grid-cols-2 gap-2 px-3">
                      <div>
                        <label className="text-xs text-white/60 block mb-1">Start</label>
                        <input
                          type="time"
                          className="w-full px-2 py-1 text-xs bg-dark-tertiary border border-white/20 rounded text-white focus:outline-none focus:border-violet"
                          defaultValue={(() => {
                            const task = tasks.find(t => t.id === showFloatingMenu?.taskId);
                            return task?.startTime || '09:00';
                          })()}
                          onChange={(e) => {
                            const startTime = e.target.value;
                            const task = tasks.find(t => t.id === showFloatingMenu?.taskId);
                            const endTime = task?.endTime || '10:00';
                            selectFloatingMenuOption({ isAllDay: false, startTime, endTime });
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-1">End</label>
                        <input
                          type="time"
                          className="w-full px-2 py-1 text-xs bg-dark-tertiary border border-white/20 rounded text-white focus:outline-none focus:border-violet"
                          defaultValue={(() => {
                            const task = tasks.find(t => t.id === showFloatingMenu?.taskId);
                            return task?.endTime || '10:00';
                          })()}
                          onChange={(e) => {
                            const endTime = e.target.value;
                            const task = tasks.find(t => t.id === showFloatingMenu?.taskId);
                            const startTime = task?.startTime || '09:00';
                            selectFloatingMenuOption({ isAllDay: false, startTime, endTime });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Due Date Menu */}
            {showFloatingMenu.field === 'dueDate' && (
              <div className="p-3 min-w-48">
                <div className="text-xs text-white/60 mb-2">Select Date</div>
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm bg-dark-tertiary border border-white/20 rounded text-white focus:outline-none focus:border-violet"
                  defaultValue={(() => {
                    const task = tasks.find(t => t.id === showFloatingMenu?.taskId);
                    return task?.dueDate.toISOString().split('T')[0] || '';
                  })()}
                  onChange={(e) => {
                    if (e.target.value) {
                      selectFloatingMenuOption(e.target.value);
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TasksImproved; 