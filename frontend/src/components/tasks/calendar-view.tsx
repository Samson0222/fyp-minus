import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Task } from '@/types/task';
import { format } from 'date-fns';

interface CalendarViewProps {
  tasks: Task[];
  onDateClick: (date: Date, allDay?: boolean) => void;
  onAddTaskClick: () => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ 
  tasks, 
  onDateClick,
  onAddTaskClick 
}) => {
  // Transform tasks into FullCalendar events
  const calendarEvents = useMemo(() => {
    return tasks
      .filter(task => task.syncedToCalendar)
      .map(task => {
        const getPriorityColor = (priority: Task['priority']) => {
          switch (priority) {
            case 'high':
              return '#ef4444'; // red-500
            case 'medium':
              return '#f59e0b'; // yellow-500
            case 'low':
              return '#10b981'; // green-500
            default:
              return '#6b7280'; // gray-500
          }
        };

        const baseEvent = {
          id: task.id,
          title: task.title,
          start: task.dueDate,
          backgroundColor: getPriorityColor(task.priority),
          borderColor: getPriorityColor(task.priority),
          extendedProps: {
            description: task.description,
            priority: task.priority,
            isCompleted: task.isCompleted,
          },
          className: task.isCompleted ? 'opacity-60' : '',
        };

        if (task.isAllDay) {
          return {
            ...baseEvent,
            allDay: true,
          };
        } else {
          // For timed events, create start and end datetime
          const startDateTime = new Date(task.dueDate);
          const endDateTime = new Date(task.dueDate);
          
          if (task.startTime) {
            const [startHour, startMinute] = task.startTime.split(':');
            startDateTime.setHours(parseInt(startHour), parseInt(startMinute));
          }
          
          if (task.endTime) {
            const [endHour, endMinute] = task.endTime.split(':');
            endDateTime.setHours(parseInt(endHour), parseInt(endMinute));
          } else if (task.startTime) {
            // Default to 1 hour duration if no end time
            endDateTime.setTime(startDateTime.getTime() + (60 * 60 * 1000));
          }

          return {
            ...baseEvent,
            start: startDateTime,
            end: endDateTime,
            allDay: false,
          };
        }
      });
  }, [tasks]);

  const handleDateClick = (arg: any) => {
    // Handle clicking on a date in the calendar
    const clickedDate = new Date(arg.date);
    const allDay = arg.allDay;
    onDateClick(clickedDate, allDay);
  };

  const handleSelect = (arg: any) => {
    // Handle selecting a time range
    const startDate = new Date(arg.start);
    const allDay = arg.allDay;
    onDateClick(startDate, allDay);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-white">Calendar</h2>
        <button 
          onClick={onAddTaskClick}
          className="flex items-center gap-2 px-4 py-2 bg-violet text-white rounded-lg hover:bg-violet/90 transition-colors"
        >
          <span className="text-lg">+</span>
          Add Task
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-dark-tertiary rounded-lg border border-white/10 p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          events={calendarEvents}
          dateClick={handleDateClick}
          select={handleSelect}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          height="auto"
          eventClassNames="cursor-pointer"
          eventDisplay="block"
          eventTextColor="white"
          eventBorderWidth={0}
          dayHeaderClassNames="text-gray-600 font-medium py-2"
          dayCellClassNames="hover:bg-gray-50 cursor-pointer"
          // Custom CSS classes for better styling
          eventDidMount={(info) => {
            // Add custom styling to events
            const event = info.event;
            const element = info.el;
            
            if (event.extendedProps.isCompleted) {
              element.style.opacity = '0.6';
              element.style.textDecoration = 'line-through';
            }
            
            // Add tooltip with description
            if (event.extendedProps.description) {
              element.title = event.extendedProps.description;
            }
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-white/70">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>High Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>Medium Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Low Priority</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarView; 