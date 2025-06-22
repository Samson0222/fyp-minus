import React from 'react';
import { List, Calendar } from 'lucide-react';
import { TaskView } from '@/types/task';
import { cn } from '@/lib/utils';

interface ViewToggleProps {
  currentView: TaskView;
  onViewChange: (view: TaskView) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="inline-flex bg-dark-tertiary rounded-lg p-1">
      <button
        onClick={() => onViewChange('list')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
          currentView === 'list'
            ? "bg-violet text-white shadow-sm"
            : "text-white/70 hover:text-white"
        )}
      >
        <List size={16} />
        List
      </button>
      <button
        onClick={() => onViewChange('calendar')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
          currentView === 'calendar'
            ? "bg-violet text-white shadow-sm"
            : "text-white/70 hover:text-white"
        )}
      >
        <Calendar size={16} />
        Calendar
      </button>
    </div>
  );
};

export default ViewToggle; 