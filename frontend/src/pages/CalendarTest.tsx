import React, { useState } from 'react';
import CalendarViewEnhanced from '@/components/tasks/CalendarViewEnhanced';
import Layout from '@/components/layout/Layout';
import { Task } from '@/types/task';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CalendarTest: React.FC = () => {
  const [lastAction, setLastAction] = useState<string>('');
  const { toast } = useToast();

  const handleTaskCreated = (task: Task) => {
    setLastAction(`✅ Created: "${task.title}" on ${task.start_at?.toLocaleDateString()}`);
    toast({
      title: "Task Created! 🎉",
      description: `"${task.title}" has been added to your calendar.`,
    });
  };

  const handleTaskUpdated = (task: Task) => {
    setLastAction(`📝 Updated: "${task.title}"`);
    toast({
      title: "Task Updated! ✏️",
      description: `"${task.title}" has been modified.`,
    });
  };

  const handleTaskDeleted = (taskId: string) => {
    setLastAction(`🗑️ Deleted task: ${taskId}`);
    toast({
      title: "Task Deleted! 🗑️",
      description: "Task has been removed from your calendar.",
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Enhanced Calendar Test</h1>
            <p className="text-white/70 mt-2">
              Test the new Supabase-powered calendar with direct task creation
            </p>
          </div>
        </div>

        {/* Instructions Card */}
        <Card className="bg-dark-secondary border-white/10">
          <CardHeader>
            <CardTitle className="text-white">🧪 Test Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-white/80 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-violet mb-2">Quick Actions:</h4>
                <ul className="space-y-1 text-sm">
                  <li>• <strong>Click any date</strong> → Create task instantly</li>
                  <li>• <strong>Drag events</strong> → Move between dates</li>
                  <li>• <strong>Resize events</strong> → Adjust duration</li>
                  <li>• <strong>Click events</strong> → View details</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-violet mb-2">What to Look For:</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Tasks save to Supabase database</li>
                  <li>• Real-time updates across tabs</li>
                  <li>• Priority color coding</li>
                  <li>• Voice-created task indicators (purple border)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Action Display */}
        {lastAction && (
          <Card className="bg-dark-tertiary border-green-500/30">
            <CardContent className="py-3">
              <p className="text-green-400 font-mono text-sm">
                🔄 Last Action: {lastAction}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Calendar Component */}
        <CalendarViewEnhanced
          onTaskCreated={handleTaskCreated}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />

        {/* Quick Test Actions */}
        <Card className="bg-dark-secondary border-white/10">
          <CardHeader>
            <CardTitle className="text-white">🚀 Quick Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                className="bg-violet hover:bg-violet/90 text-white"
                onClick={() => {
                  toast({
                    title: "Test Action 1",
                    description: "Click any date on the calendar above to create a task!",
                  });
                }}
              >
                📅 Test Task Creation
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  toast({
                    title: "Test Action 2", 
                    description: "Try dragging any existing task to a different date!",
                  });
                }}
              >
                🔄 Test Drag & Drop
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  toast({
                    title: "Test Action 3",
                    description: "Open another browser tab to see real-time sync!",
                  });
                }}
              >
                ⚡ Test Real-time
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status Info */}
        <Card className="bg-dark-secondary border-white/10">
          <CardHeader>
            <CardTitle className="text-white">📊 Calendar Status</CardTitle>
          </CardHeader>
          <CardContent className="text-white/80">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Database:</strong> Supabase PostgreSQL</p>
                <p><strong>Real-time:</strong> Enabled</p>
                <p><strong>Authentication:</strong> Required</p>
              </div>
              <div>
                <p><strong>Features:</strong> Full CRUD operations</p>
                <p><strong>Voice Ready:</strong> Yes (indicators enabled)</p>
                <p><strong>Mobile:</strong> Responsive design</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CalendarTest; 