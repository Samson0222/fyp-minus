import React, { useState, useCallback, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import InteractionArea from '@/components/ai/InteractionArea';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import { Plus, Circle, CheckCircle, List, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Settings, Filter, ChevronDown, MoreHorizontal, Trash2, Edit, Archive, X, ChevronLeft, ChevronRight, Hash, Tag, Sparkles } from 'lucide-react';

// Define types locally to avoid import issues
interface TaskTag {
  id: string;
  name: string;
  color: string;
  category: 'project' | 'department' | 'priority' | 'type' | 'status' | 'custom';
}

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
  tags?: TaskTag[];
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

const TasksWorking: React.FC = () => {
  const [currentView, setCurrentView] = useState<TaskView>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [tagPanelPosition, setTagPanelPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#60a5fa');
  const [newTagCategory, setNewTagCategory] = useState<TaskTag['category']>('custom');
  
  // Available tags (predefined + custom)
  const [availableTags, setAvailableTags] = useState<TaskTag[]>([
    { id: 'eng', name: 'Engineering', color: '#60a5fa', category: 'department' },
    { id: 'admin', name: 'Admin', color: '#fbbf24', category: 'department' },
    { id: 'bug', name: 'Bug', color: '#f87171', category: 'type' },
    { id: 'design', name: 'Design', color: '#a78bfa', category: 'department' },
    { id: 'feature', name: 'Feature', color: '#34d399', category: 'type' },
    { id: 'finance', name: 'Finance', color: '#10b981', category: 'department' },
    { id: 'hiring', name: 'Hiring', color: '#38bdf8', category: 'department' },
    { id: 'marketing', name: 'Marketing', color: '#fb7185', category: 'department' },
    { id: 'operations', name: 'Operations', color: '#9ca3af', category: 'department' },
    { id: 'personal', name: 'Personal', color: '#c084fc', category: 'custom' },
    { id: 'product', name: 'Product', color: '#fb923c', category: 'department' },
    { id: 'sales', name: 'Sales', color: '#4ade80', category: 'department' },
  ]);
  
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
  
  // Column configuration with intelligent minimum widths
  const [columns, setColumns] = useState<TableColumn[]>([
    { id: 'title', label: 'Task', width: 300, visible: true, sortable: true, filterable: true },
    { id: 'description', label: 'Description', width: 250, visible: false, sortable: false, filterable: true },
    { id: 'dueDate', label: 'Due Date', width: 120, visible: true, sortable: true, filterable: true },
    { id: 'time', label: 'Time', width: 120, visible: true, sortable: false, filterable: false },
    { id: 'priority', label: 'Priority', width: 120, visible: true, sortable: true, filterable: true },
    { id: 'status', label: 'Status', width: 110, visible: true, sortable: true, filterable: true },
    { id: 'tags', label: 'Tags', width: 200, visible: true, sortable: false, filterable: true },
    { id: 'created', label: 'Created', width: 150, visible: true, sortable: true, filterable: false },
    { id: 'lastUpdate', label: 'Last Update', width: 150, visible: true, sortable: true, filterable: false },
  ]);

  // Column minimum widths based on content (includes space for sort buttons where applicable)
  const getColumnMinWidth = (columnId: string) => {
    switch (columnId) {
      case 'title': return 100; // "Task" + sort button (sortable)
      case 'description': return 120; // "Description" (not sortable, longer title)  
      case 'tags': return 150; // "Tags" (not sortable, needs space for tag chips)
      case 'dueDate': return 110; // "Due Date" + sort button (sortable)
      case 'time': return 60; // "Time" (not sortable, short title)
      case 'priority': return 105; // "Priority" + sort button (sortable) - increased for full display
      case 'status': return 95; // "Status" + sort button (sortable) - increased for full display
      case 'created': return 95; // "Created" + sort button (sortable)
      case 'lastUpdate': return 110; // "Last Update" + sort button (sortable)
      default: return 50;
    }
  };

  // Sample tasks with tags
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Complete project proposal',
      description: 'Finish the Q1 project proposal and submit to management for review.',
      dueDate: new Date(2024, 11, 25),
      isAllDay: true,
      priority: 'high',
      status: 'todo',
      tags: [
        { id: 'eng-1', name: 'Engineering', color: '#3b82f6', category: 'department' },
        { id: 'feat-1', name: 'Feature', color: '#10b981', category: 'type' }
      ],
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
      tags: [
        { id: 'admin-1', name: 'Admin', color: '#f59e0b', category: 'department' },
        { id: 'oper-1', name: 'Operations', color: '#6b7280', category: 'department' }
      ],
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
      tags: [
        { id: 'eng-1', name: 'Engineering', color: '#3b82f6', category: 'department' },
        { id: 'bug-1', name: 'Bug', color: '#ef4444', category: 'type' }
      ],
      syncedToCalendar: true,
      createDateTime: new Date(),
      lastUpdateDateTime: new Date(),
    },
  ]);

  const handleTaskToggle = useCallback((taskId: string) => {
    // Determine which tasks to update: if the current task is selected and there are multiple selections,
    // update all selected tasks. Otherwise, just update the current task.
    const shouldBatchEdit = selectedTasks.has(taskId) && selectedTasks.size > 1;
    const tasksToUpdate = shouldBatchEdit ? Array.from(selectedTasks) : [taskId];
    
    // Get the current task to determine the new status
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
            case 'tags':
              if (typeof value === 'string') {
                return task.tags?.some(tag => tag.name.toLowerCase().includes(value.toLowerCase())) || false;
              }
              return Array.isArray(value) ? 
                task.tags?.some(tag => value.includes(tag.name)) || false : 
                true;
            case 'priority':
              return Array.isArray(value) ? value.includes(task.priority) : task.priority === value;
            case 'status':
              return Array.isArray(value) ? value.includes(task.status) : task.status === value;
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
            aValue = a.status === 'done' ? 1 : a.status === 'inprogress' ? 2 : 0;
            bValue = b.status === 'done' ? 1 : b.status === 'inprogress' ? 2 : 0;
            break;
          case 'created':
            aValue = a.createDateTime.getTime();
            bValue = b.createDateTime.getTime();
            break;
          case 'lastUpdate':
            aValue = a.lastUpdateDateTime.getTime();
            bValue = b.lastUpdateDateTime.getTime();
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
              ? { ...task, status: 'done' }
              : task
          )
        );
        break;
      case 'incomplete':
        setTasks(prevTasks =>
          prevTasks.map(task =>
            selectedTaskIds.includes(task.id)
              ? { ...task, status: 'todo' }
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

  const handleColumnToggle = useCallback((columnId: string) => {
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  }, []);

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.id === columnId ? { ...col, width: Math.max(getColumnMinWidth(columnId), newWidth) } : col
      )
    );
  }, []);

  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

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

  // Status helper functions
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

  const getStatusHoverColor = (status: Task['status']) => {
    switch (status) {
      case 'done': return 'hover:bg-green-500/30';
      case 'inprogress': return 'hover:bg-blue-500/30';
      case 'todo': return 'hover:bg-orange-500/30';
    }
  };

  // Delete task function
  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  }, []);

  // Tag operations
  const handleAddTagToSelected = useCallback((tag: TaskTag) => {
    const selectedTaskIds = Array.from(selectedTasks);
    if (selectedTaskIds.length === 0) return;

    setTasks(prevTasks =>
      prevTasks.map(task =>
        selectedTaskIds.includes(task.id)
          ? {
              ...task,
              tags: task.tags ? 
                task.tags.some(t => t.id === tag.id) ? 
                  task.tags : // Don't add duplicate
                  [...task.tags, tag] :
                [tag],
              lastUpdateDateTime: new Date()
            }
          : task
      )
    );
    // Don't clear selection - allow multiple tag additions
  }, [selectedTasks]);

  const handleRemoveTagFromSelected = useCallback((tagId: string) => {
    const selectedTaskIds = Array.from(selectedTasks);
    if (selectedTaskIds.length === 0) return;

    setTasks(prevTasks =>
      prevTasks.map(task =>
        selectedTaskIds.includes(task.id)
          ? {
              ...task,
              tags: task.tags?.filter(t => t.id !== tagId) || [],
              lastUpdateDateTime: new Date()
            }
          : task
      )
    );
  }, [selectedTasks]);

  const handleQuickTagFilter = useCallback((tagName: string) => {
    setFilters(prev => ({ ...prev, tags: tagName }));
    setShowFilters(true);
  }, []);

  // Custom tag creation
  const handleCreateCustomTag = useCallback(() => {
    if (!newTagName.trim()) return;
    
    const newTag: TaskTag = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newTagName.trim(),
      color: newTagColor,
      category: newTagCategory
    };

    setAvailableTags(prev => [...prev, newTag]);
    
    // Reset form
    setNewTagName('');
  }, [newTagName, newTagColor, newTagCategory]);

  // Handle clicking on tags column header or cell
  const handleTagsColumnClick = useCallback((taskId?: string, event?: React.MouseEvent) => {
    if (taskId) {
      // If clicking on a specific task's tags cell, select that task
      setSelectedTasks(new Set([taskId]));
    }
    
    // Position the panel near the click location
    if (event) {
      setTagPanelPosition({
        x: Math.min(event.clientX - 160, window.innerWidth - 340), // Center panel on click, keep in bounds
        y: Math.min(event.clientY - 100, window.innerHeight - 400)
      });
    } else {
      // Default position if no event (header click)
      setTagPanelPosition({
        x: window.innerWidth - 340,
        y: 100
      });
    }
    
    setShowTagPanel(true);
  }, []);

  // Handle removing a tag from applied tags
  const handleRemoveAppliedTag = useCallback((tagId: string) => {
    const selectedTaskIds = Array.from(selectedTasks);
    if (selectedTaskIds.length === 0) return;

    setTasks(prevTasks =>
      prevTasks.map(task =>
        selectedTaskIds.includes(task.id)
          ? {
              ...task,
              tags: task.tags?.filter(t => t.id !== tagId) || [],
              lastUpdateDateTime: new Date()
            }
          : task
      )
    );
  }, [selectedTasks]);

  // AI Fill with Minus functionality
  const handleAIFillWithMinus = useCallback(() => {
    console.log('AI Fill with Minus triggered - this would analyze selected tasks and suggest relevant tags');
    // This would integrate with your AI system to suggest tags based on task content
  }, []);

  // Get applied tags for selected tasks
  const getAppliedTags = useCallback(() => {
    const selectedTaskIds = Array.from(selectedTasks);
    if (selectedTaskIds.length === 0) return [];

    const selectedTasksData = tasks.filter(task => selectedTaskIds.includes(task.id));
    const appliedTagsMap = new Map<string, TaskTag>();
    
    // Collect all unique tags from selected tasks
    selectedTasksData.forEach(task => {
      task.tags?.forEach(tag => {
        appliedTagsMap.set(tag.id, tag);
      });
    });

    // Return the actual tag objects sorted alphabetically
    return Array.from(appliedTagsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedTasks, tasks]);

  // Get available tags (excluding already applied ones)
  const getAvailableOptions = useCallback(() => {
    const appliedTagIds = new Set(getAppliedTags().map(tag => tag.id));
    return availableTags.filter(tag => !appliedTagIds.has(tag.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableTags, getAppliedTags]);

  // Close panel when clicking outside
  const handleClickOutsideTagPanel = useCallback((e: MouseEvent) => {
    if (showTagPanel) {
      const target = e.target as Element;
      if (!target.closest('.tag-panel') && !target.closest('[data-tag-trigger]')) {
        setShowTagPanel(false);
      }
    }
  }, [showTagPanel]);

  // Drag handlers for movable panel
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as Element).closest('.panel-header') || (e.target as Element).closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - tagPanelPosition.x,
        y: e.clientY - tagPanelPosition.y
      });
    }
  }, [tagPanelPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setTagPanelPosition({
        x: Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 320)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 400))
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  React.useEffect(() => {
    document.addEventListener('mousedown', handleClickOutsideTagPanel);
    return () => document.removeEventListener('mousedown', handleClickOutsideTagPanel);
  }, [handleClickOutsideTagPanel]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  // Inline editing handlers
  const startEditing = useCallback((taskId: string, field: string, currentValue: any) => {
    setEditingCell({ taskId, field });
    setTempValue(currentValue);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingCell) return;
    
    const { taskId, field } = editingCell;
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          switch (field) {
            case 'dueDate':
              return { ...task, dueDate: new Date(tempValue) };
            default:
              return task;
          }
        }
        return task;
      })
    );
    
    setEditingCell(null);
    setTempValue('');
  }, [editingCell, tempValue]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setTempValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }, [saveEdit, cancelEdit]);

  // Floating menu handlers
  const showFloatingMenuFor = useCallback((taskId: string, field: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    
    // Initialize calendar with current task's due date for date picker
    if (field === 'dueDate') {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setCalendarDate(new Date(task.dueDate));
      }
    }
    
    setShowFloatingMenu({
      taskId,
      field,
      position: { x: rect.left, y: rect.bottom + 4 }
    });
  }, [tasks]);

  const hideFloatingMenu = useCallback(() => {
    setShowFloatingMenu(null);
  }, []);

  const selectFloatingMenuOption = useCallback((value: any) => {
    if (!showFloatingMenu) return;
    
    const { taskId, field } = showFloatingMenu;
    
    // Determine which tasks to update: if the current task is selected and there are multiple selections,
    // update all selected tasks. Otherwise, just update the current task.
    const shouldBatchEdit = selectedTasks.has(taskId) && selectedTasks.size > 1;
    const tasksToUpdate = shouldBatchEdit ? Array.from(selectedTasks) : [taskId];
    
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (tasksToUpdate.includes(task.id)) {
          switch (field) {
            case 'priority':
              return { ...task, priority: value as Task['priority'], lastUpdateDateTime: new Date() };
            case 'status':
              return { ...task, status: value as Task['status'], lastUpdateDateTime: new Date() };
            case 'time':
              if (value.isAllDay) {
                return { ...task, isAllDay: true, startTime: undefined, endTime: undefined, lastUpdateDateTime: new Date() };
              } else {
                return { ...task, isAllDay: false, startTime: value.startTime, endTime: value.endTime, lastUpdateDateTime: new Date() };
              }
            case 'dueDate':
              return { ...task, dueDate: new Date(value), lastUpdateDateTime: new Date() };
            default:
              return task;
          }
        }
        return task;
      })
    );
    
    hideFloatingMenu();
  }, [showFloatingMenu, hideFloatingMenu, selectedTasks]);

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

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCalendarDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const selectDate = (day: number) => {
    const selectedDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    selectFloatingMenuOption(selectedDate.toISOString().split('T')[0]);
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
                    <span className="font-semibold text-orange-400">{tasks.filter(task => task.status === 'todo').length}</span>
                    <span>To Do</span>
                  </div>
                  <span className="text-white/30">•</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-400">{tasks.filter(task => task.status === 'inprogress').length}</span>
                    <span>In Progress</span>
                  </div>
                  <span className="text-white/30">•</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-400">{tasks.filter(task => task.status === 'done').length}</span>
                    <span>Done</span>
                  </div>
                  <span className="text-white/30">•</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-400">{tasks.filter(task => task.priority === 'high' && task.status !== 'done').length}</span>
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
                  <span className="font-semibold text-orange-400">{tasks.filter(task => task.status === 'todo').length}</span>
                  <span>To Do</span>
                  <span className="mx-1">•</span>
                  <span className="font-semibold text-blue-400">{tasks.filter(task => task.status === 'inprogress').length}</span>
                  <span>In Progress</span>
                  <span className="mx-1">•</span>
                  <span className="font-semibold text-green-400">{tasks.filter(task => task.status === 'done').length}</span>
                  <span>Done</span>
                  <span className="mx-1">•</span>
                  <span className="font-semibold text-red-400">{tasks.filter(task => task.priority === 'high' && task.status !== 'done').length}</span>
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
                    {/* Bulk actions removed - batch editing now happens automatically */}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Filter Toggle */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2 rounded-lg border transition-colors ${
                        showFilters 
                          ? 'bg-violet/20 text-violet-300 border-violet/30' 
                          : 'bg-dark-tertiary border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      <Filter size={16} />
                    </button>

                    {/* Column Config */}
                    <div className="relative">
                      <button
                        onClick={() => setShowColumnConfig(!showColumnConfig)}
                        className="p-2 bg-dark-tertiary border border-white/10 text-white/70 hover:text-white rounded-lg transition-colors"
                      >
                        <Settings size={16} />
                      </button>
                      {showColumnConfig && (
                        <div className="absolute top-full mt-2 right-0 bg-dark-secondary border border-white/10 rounded-lg shadow-lg p-3 z-10 min-w-48">
                          <h3 className="text-sm font-medium text-white mb-2">Columns</h3>
                          {columns.map(column => (
                            <label key={column.id} className="flex items-center gap-2 py-1">
                              <input
                                type="checkbox"
                                checked={column.visible}
                                onChange={() => handleColumnToggle(column.id)}
                                className="w-4 h-4 rounded border-white/20 bg-transparent text-violet-500"
                              />
                              <span className="text-sm text-white/80">{column.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => {
                        // This will be used for bulk delete when tasks are selected
                        if (selectedTasks.size > 0) {
                          const selectedTaskIds = Array.from(selectedTasks);
                          setTasks(prevTasks => prevTasks.filter(task => !selectedTaskIds.includes(task.id)));
                          setSelectedTasks(new Set());
                        }
                      }}
                      disabled={selectedTasks.size === 0}
                      className={`p-2 rounded-lg border transition-colors ${
                        selectedTasks.size > 0 
                          ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30' 
                          : 'bg-dark-tertiary border-white/10 text-white/30 cursor-not-allowed'
                      }`}
                      title={selectedTasks.size > 0 ? `Delete ${selectedTasks.size} selected task(s)` : 'Select tasks to delete'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Filters */}
                {showFilters && (
                  <div className="bg-dark-tertiary/50 border border-white/10 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Search</label>
                        <input
                          type="text"
                          placeholder="Search tasks..."
                          value={filters.title || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-3 py-2 bg-dark-secondary border border-white/10 rounded-lg text-white placeholder-white/50 focus:border-violet/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Tags</label>
                        <input
                          type="text"
                          placeholder="Filter by tags..."
                          value={filters.tags || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, tags: e.target.value }))}
                          className="w-full px-3 py-2 bg-dark-secondary border border-white/10 rounded-lg text-white placeholder-white/50 focus:border-violet/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Priority</label>
                        <select
                          value={filters.priority || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                          className="w-full px-3 py-2 bg-dark-secondary border border-white/10 rounded-lg text-white focus:border-violet/50 focus:outline-none"
                        >
                          <option value="">All priorities</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Status</label>
                        <select
                          value={filters.status || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                          className="w-full px-3 py-2 bg-dark-secondary border border-white/10 rounded-lg text-white focus:border-violet/50 focus:outline-none"
                        >
                          <option value="">All statuses</option>
                          <option value="todo">To Do</option>
                          <option value="inprogress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </div>
                    {Object.keys(filters).length > 0 && (
                      <button
                        onClick={() => setFilters({})}
                        className="mt-3 text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        <X size={14} />
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}

                {/* Batch editing indicator removed - seamless batch editing is now enabled */}

                {/* Advanced Data Table */}
                <div className="bg-dark-tertiary/50 rounded-lg overflow-hidden">
                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    {/* Table Header */}
                    <div className="flex bg-dark-tertiary border-b border-white/10 min-w-max">
                      {/* Select All */}
                      <div className="w-12 p-4 flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedTasks.size === filteredAndSortedTasks.length && filteredAndSortedTasks.length > 0}
                          onChange={handleSelectAll}
                          className={`w-4 h-4 rounded border-white/20 bg-transparent text-violet-500 transition-opacity ${
                            selectedTasks.size > 0 ? 'opacity-100' : 'opacity-40'
                          }`}
                        />
                      </div>
                      
                      {/* Dynamic Columns */}
                      {visibleColumns.map(column => (
                        <div
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-4 text-xs font-medium text-white/70 uppercase tracking-wide relative group"
                        >
                          <div className="flex items-center justify-between">
                            {column.id === 'tags' ? (
                              <button
                                onClick={(e) => handleTagsColumnClick(undefined, e)}
                                className="truncate mr-2 hover:text-white transition-colors"
                                title="Click to manage tags"
                                data-tag-trigger
                              >
                                {column.label}
                              </button>
                            ) : (
                              <span className="truncate mr-2">{column.label}</span>
                            )}
                            {column.sortable && (
                              <button
                                onClick={() => handleSort(column.id)}
                                className="text-white/40 hover:text-white/80 p-0.5 flex-shrink-0"
                                title={`Sort by ${column.label}`}
                              >
                                {sortConfig.key === column.id ? (
                                  sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                ) : (
                                  <ArrowUpDown size={12} />
                                )}
                              </button>
                            )}
                          </div>
                          {/* Resize Handle */}
                          <div
                            className="absolute right-0 top-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-violet/50 group-hover:bg-violet/30"
                            onMouseDown={(e) => {
                              const startX = e.clientX;
                              const startWidth = column.width;
                              
                              const handleMouseMove = (e: MouseEvent) => {
                                const diff = e.clientX - startX;
                                handleColumnResize(column.id, startWidth + diff);
                              };
                              
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };
                              
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    
                    {/* Table Body */}
                    <div className="divide-y divide-white/5">
                      {filteredAndSortedTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex hover:bg-white/5 transition-colors min-w-max ${
                            task.status === 'done' ? 'opacity-60' : ''
                          } ${selectedTasks.has(task.id) ? 'bg-violet/10' : ''}`}
                          onMouseEnter={() => setHoveredRow(task.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          {/* Select Checkbox */}
                          <div className="w-12 p-4 flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedTasks.has(task.id)}
                              onChange={() => handleSelectTask(task.id)}
                              className={`w-4 h-4 rounded border-white/20 bg-transparent text-violet-500 transition-opacity ${
                                selectedTasks.has(task.id) || hoveredRow === task.id ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                          </div>
                          
                          {/* Dynamic Columns */}
                          {visibleColumns.map(column => (
                            <div
                              key={column.id}
                              style={{ width: column.width }}
                              className={`p-4 overflow-hidden ${
                                column.id === 'time' && column.width < 120 
                                  ? 'flex items-start justify-center' 
                                  : 'flex items-center'
                              }`}
                            >
                              {column.id === 'title' && (
                                <div className="min-w-0 flex-1">
                                  <h3 className={`font-medium text-sm ${
                                    task.status === 'done' ? 'line-through text-white/50' : 'text-white'
                                  }`}>
                                    {task.title}
                                  </h3>
                                </div>
                              )}
                              {column.id === 'description' && (
                                <p className="text-sm text-white/70 truncate">
                                  {task.description || '-'}
                                </p>
                              )}
                              {column.id === 'tags' && (
                                <button
                                  onClick={(e) => handleTagsColumnClick(task.id, e)}
                                  className="w-full text-left hover:bg-white/5 px-2 py-1 rounded transition-colors"
                                  data-tag-trigger
                                >
                                  <div className="flex flex-wrap gap-1">
                                    {task.tags && task.tags.length > 0 ? (
                                      (() => {
                                        const maxWidth = column.width - 32; // Account for padding
                                        const estimatedTagWidth = 60; // Estimated width per tag
                                        const maxVisibleTags = Math.max(1, Math.floor(maxWidth / estimatedTagWidth));
                                        const visibleTags = task.tags!.sort((a, b) => a.name.localeCompare(b.name)).slice(0, maxVisibleTags);
                                        const remainingCount = task.tags!.length - maxVisibleTags;
                                        
                                        return (
                                          <>
                                            {visibleTags.map((tag) => (
                                                                                             <span
                                                  key={tag.id}
                                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-[#8a6bf4] border transition-colors truncate max-w-[80px]"
                                                  style={{ backgroundColor: 'rgba(138, 107, 244, 0.1)', borderColor: 'rgba(138, 107, 244, 0.3)' }}
                                                  title={tag.name}
                                                >
                                                {tag.name.length > 8 ? `${tag.name.substring(0, 8)}...` : tag.name}
                                              </span>
                                            ))}
                                                                                         {remainingCount > 0 && (
                                               <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white/10 text-white/60 border border-white/20">
                                                 +{remainingCount}
                                               </span>
                                             )}
                                          </>
                                        );
                                      })()
                                    ) : (
                                      <span className="text-xs text-white/40">Click to add tags</span>
                                    )}
                                  </div>
                                </button>
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
                                    className={`text-xs px-2 py-1 rounded-full transition-colors w-full whitespace-nowrap ${
                                      task.status === 'done' 
                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                                        : task.status === 'inprogress'
                                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                        : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                    }`}
                                  >
                                    {task.status === 'done' ? 'Done' : task.status === 'inprogress' ? 'In Progress' : 'To Do'}
                                  </button>
                                </div>
                              )}
                              {column.id === 'created' && (
                                <div className="w-full">
                                  <span className="text-sm text-white/70">
                                    {formatDateTime(task.createDateTime)}
                                  </span>
                                </div>
                              )}
                              {column.id === 'lastUpdate' && (
                                <div className="w-full">
                                  <span className="text-sm text-white/70">
                                    {formatDateTime(task.lastUpdateDateTime)}
                                  </span>
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
                            task.status === 'done' ? 'opacity-60' : ''
                          }`}
                        >
                          {/* Completion Checkbox */}
                          <div className="flex items-center">
                            <button
                              onClick={() => handleTaskToggle(task.id)}
                              className="flex-shrink-0"
                            >
                              {task.status === 'done' ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <Circle className="w-4 h-4 text-white/40 hover:text-white/60" />
                              )}
                            </button>
                          </div>

                          {/* Task Title & Tags */}
                          <div className="flex flex-col min-w-0 gap-1">
                            <h3 className={`font-medium text-sm truncate ${
                              task.status === 'done' 
                                ? 'line-through text-white/50' 
                                : 'text-white'
                            }`}>
                              {task.title}
                            </h3>
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                                                 {task.tags.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 2).map((tag) => (
                                   <span
                                     key={tag.id}
                                     className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-[#8a6bf4] border"
                                     style={{ backgroundColor: 'rgba(138, 107, 244, 0.1)', borderColor: 'rgba(138, 107, 244, 0.3)' }}
                                   >
                                     {tag.name}
                                   </span>
                                 ))}
                                {task.tags.length > 2 && (
                                  <span className="text-xs text-white/40">
                                    +{task.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Status */}
                          <div className="flex items-center">
                            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                              task.status === 'done' 
                                ? 'bg-green-500/20 text-green-400' 
                                : task.status === 'inprogress'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-orange-500/20 text-orange-400'
                            }`}>
                              {task.status === 'done' ? 'Done' : task.status === 'inprogress' ? 'In Progress' : 'To Do'}
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



                {/* Tag Panel */}
        {showTagPanel && (
          <div 
            className="tag-panel fixed z-50 bg-dark-secondary border border-white/10 rounded-lg shadow-xl w-80 max-h-[500px] flex flex-col select-none"
            style={{
              left: tagPanelPosition.x,
              top: tagPanelPosition.y,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
          >

            {/* Applied Tags Section */}
            <div className="p-5 pb-4 pointer-events-auto panel-header cursor-grab">
              <div className="mb-3">
                <span className="text-sm font-medium text-white/70">Applied Tags ({selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''})</span>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {getAppliedTags().length > 0 ? (
                  getAppliedTags().map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleRemoveAppliedTag(tag.id)}
                      className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium text-[#8a6bf4] border hover:border-red-500/50 hover:text-red-300 transition-colors group"
                      style={{ backgroundColor: 'rgba(138, 107, 244, 0.1)', borderColor: 'rgba(138, 107, 244, 0.3)' }}
                      title="Click to remove"
                    >
                      {tag.name}
                      <X size={12} className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-white/40 italic">No tags applied</span>
                )}
              </div>
            </div>

            {/* Options Section - Scrollable */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 pointer-events-auto max-h-[240px] border-t border-white/5">
              <div className="mb-3 pt-4">
                <span className="text-sm font-medium text-white/70">Available Options</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {getAvailableOptions().map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTagToSelected(tag)}
                    disabled={selectedTasks.size === 0}
                    className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      selectedTasks.size > 0
                        ? 'text-[#8a6bf4] border hover:border-[#8a6bf4]/50'
                        : 'bg-dark-tertiary text-white/30 border border-white/5 cursor-not-allowed'
                    }`}
                    style={selectedTasks.size > 0 ? {
                      backgroundColor: 'rgba(138, 107, 244, 0.05)',
                      borderColor: 'rgba(138, 107, 244, 0.2)'
                    } : {}}
                  >
                    <span className="truncate">{tag.name}</span>
                  </button>
                ))}
              </div>
              {getAvailableOptions().length === 0 && (
                <p className="text-white/40 text-xs italic text-center py-6">
                  All available tags are already applied
                </p>
              )}
            </div>

            {/* Fixed Bottom Section */}
            <div className="border-t border-white/5 p-4 space-y-3 pointer-events-auto bg-dark-tertiary/30">
              {/* Create New Tag */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Add new tag..."
                  className="flex-1 px-3 py-2 text-xs bg-dark-tertiary/50 border border-white/10 rounded text-white/80 placeholder-white/40 focus:outline-none focus:border-[#8a6bf4]/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagName.trim()) {
                      handleCreateCustomTag();
                    }
                  }}
                />
                <button
                  onClick={handleCreateCustomTag}
                  disabled={!newTagName.trim()}
                  className={`px-3 py-2 rounded transition-colors flex items-center justify-center ${
                    newTagName.trim()
                      ? 'bg-[#8a6bf4]/80 text-white hover:bg-[#8a6bf4]'
                      : 'bg-dark-tertiary/50 text-white/20 cursor-not-allowed'
                  }`}
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Fill with Minus Button */}
              <button
                onClick={handleAIFillWithMinus}
                disabled={selectedTasks.size === 0}
                className={`w-full px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 text-xs font-medium ${
                  selectedTasks.size > 0
                    ? 'bg-violet text-white hover:bg-violet/90'
                    : 'bg-dark-tertiary/50 text-white/20 border border-white/5 cursor-not-allowed'
                }`}
              >
                <Sparkles size={12} />
                Fill with Minus
              </button>
            </div>
          </div>
        )}
        
        {/* Interaction Area at the bottom */}
        <div className="flex-shrink-0">
          <InteractionArea
            onSendMessage={handleSendMessage}
            onToggleListening={handleToggleListening}
            isListening={isListening}
          />
        </div>

        {/* Floating Menus */}
        {showFloatingMenu && (
          <div 
            className="floating-menu fixed z-50 bg-dark-secondary border border-white/10 rounded-lg shadow-lg p-2 min-w-40"
            style={{
              left: showFloatingMenu.position.x,
              top: showFloatingMenu.position.y
            }}
          >
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
            
            {showFloatingMenu.field === 'status' && (
              <div className="space-y-2 p-1">
                {(['todo', 'inprogress', 'done'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => selectFloatingMenuOption(status)}
                    className="w-full px-3 py-2 hover:bg-white/5 rounded transition-colors flex justify-start"
                  >
                    <span className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      status === 'done' 
                        ? 'bg-green-500/20 text-green-400' 
                        : status === 'inprogress'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {status === 'done' ? 'Done' : status === 'inprogress' ? 'In Progress' : 'To Do'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showFloatingMenu.field === 'time' && (
              <div className="space-y-3 p-2">
                <div className="space-y-2">
                  <button
                    onClick={() => selectFloatingMenuOption({ isAllDay: true })}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 rounded text-sm text-white transition-colors"
                  >
                    All Day
                  </button>
                  
                  <div className="border-t border-white/10 pt-2">
                    <div className="text-xs text-white/60 mb-2 px-3">Set Time</div>
                    <div className="grid grid-cols-2 gap-2 px-3">
                      <div>
                        <label className="text-xs text-white/60">Start</label>
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
                        <label className="text-xs text-white/60">End</label>
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

            {showFloatingMenu.field === 'dueDate' && (() => {
              const currentTask = tasks.find(t => t.id === showFloatingMenu?.taskId);
              const currentDate = new Date();
              const displayDate = calendarDate || currentDate;
              
              const daysInMonth = getDaysInMonth(displayDate);
              const firstDayOfMonth = getFirstDayOfMonth(displayDate);
              const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
              ];
              
              const days = [];
              const totalCells = Math.ceil((daysInMonth + firstDayOfMonth) / 7) * 7;
              
              // Previous month's trailing days
              for (let i = 0; i < firstDayOfMonth; i++) {
                days.push(null);
              }
              
              // Current month's days
              for (let day = 1; day <= daysInMonth; day++) {
                days.push(day);
              }
              
              // Next month's leading days
              while (days.length < totalCells) {
                days.push(null);
              }

              return (
                <div className="p-4 min-w-80">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="p-2 hover:bg-white/5 rounded transition-colors"
                    >
                      <ChevronLeft size={16} className="text-white/70 hover:text-white" />
                    </button>
                    
                    <div className="text-sm font-medium text-white">
                      {monthNames[displayDate.getMonth()]} {displayDate.getFullYear()}
                    </div>
                    
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-2 hover:bg-white/5 rounded transition-colors"
                    >
                      <ChevronRight size={16} className="text-white/70 hover:text-white" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="space-y-2">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 text-xs text-white/60 font-medium">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <div key={index} className="text-center py-2">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {days.map((day, index) => {
                        if (day === null) {
                          return <div key={index} className="aspect-square" />;
                        }
                        
                        const date = new Date(displayDate.getFullYear(), displayDate.getMonth(), day);
                        const isSelected = currentTask && isSameDay(date, currentTask.dueDate);
                        const isTodayDate = isToday(date);
                        
                        return (
                          <button
                            key={index}
                            onClick={() => selectDate(day)}
                            className={`aspect-square text-sm rounded transition-colors flex items-center justify-center ${
                              isSelected
                                ? 'bg-violet text-white font-medium'
                                : isTodayDate
                                ? 'bg-white/10 text-white font-medium border border-white/20'
                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/10">
                    <button
                      onClick={() => hideFloatingMenu()}
                      className="px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        selectFloatingMenuOption(today.toISOString().split('T')[0]);
                      }}
                      className="px-3 py-1.5 text-xs bg-violet/20 text-violet-300 hover:bg-violet/30 rounded transition-colors"
                    >
                      Today
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateTask={(newTask: Task) => setTasks(prevTasks => [newTask, ...prevTasks])}
      />
    </Layout>
  );
};

export default TasksWorking; 