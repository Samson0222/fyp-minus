import React from 'react';
import { List, Calendar, Plus } from 'lucide-react';
import { TaskView } from '@/types/task';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ViewToggleProps {
  currentView: TaskView;
  onViewChange: (view: TaskView) => void;
  onAddTaskClick: () => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ 
  currentView, 
  onViewChange, 
  onAddTaskClick 
}) => {
  return (
    <div className="flex items-center gap-3">
      {/* View Toggle */}
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

      {/* Create Task Button */}
      <Button 
        onClick={onAddTaskClick}
        className="flex items-center gap-2 bg-violet hover:bg-violet/90"
      >
        <Plus size={16} />
        Create Task
      </Button>
    </div>
  );
};

export default ViewToggle; 
          <Calendar size={16} />
          Calendar
        </button>
      </div>

      {/* Create Task Button */}
      <Button 
        onClick={onAddTaskClick}
        className="flex items-center gap-2 bg-violet hover:bg-violet/90"
      >
        <Plus size={16} />
        Create Task
      </Button>
    </div>
  );
};

export default ViewToggle; 
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