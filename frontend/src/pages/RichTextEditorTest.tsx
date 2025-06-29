import React, { useState } from 'react';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import RichTextEditorDemo from '@/components/tasks/RichTextEditorDemo';
import { Button } from '@/components/ui/button';
import type { Task } from '@/components/tasks/CreateTaskModal';

// Mock data for testing
const mockTags = [
  { id: '1', name: 'Work', color: '#8a6bf4', category: 'project' as const },
  { id: '2', name: 'Personal', color: '#60a5fa', category: 'custom' as const },
];

const RichTextEditorTest: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [testResults, setTestResults] = useState<string[]>([]);

  const handleCreateTask = (task: Task) => {
    setTasks(prev => [...prev, task]);
    console.log('Task created:', task);
    
    // Test the description content
    const testResult = `Task created with description: "${task.description}" (Length: ${task.description?.length || 0})`;
    setTestResults(prev => [...prev, testResult]);
  };

  const handleCreateTag = (tagData: any) => {
    const newTag = { ...tagData, id: Date.now().toString() };
    return newTag;
  };

  const runStateTest = () => {
    setTestResults(prev => [...prev, "=== STATE SYNCHRONIZATION TEST ===", 
      "1. Open the modal", 
      "2. Type some text in the description", 
      "3. Apply formatting (bold, italic)", 
      "4. Close the modal without saving", 
      "5. Reopen the modal - the content should be cleared but often isn't"]);
  };

  const runSelectionTest = () => {
    setTestResults(prev => [...prev, "=== SELECTION & LINK TEST ===", 
      "1. Open the modal", 
      "2. Type 'Visit Google for more info'", 
      "3. Select the word 'Google'", 
      "4. Click the Link button", 
      "5. Notice the selected text is lost in the dialog"]);
  };

  const runFormattingTest = () => {
    setTestResults(prev => [...prev, "=== FORMATTING SYNC TEST ===", 
      "1. Open the modal", 
      "2. Type some text", 
      "3. Select part of the text", 
      "4. Click Bold button - notice button state", 
      "5. Click elsewhere, then back on the bold text", 
      "6. Bold button state may not reflect the actual formatting"]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Rich Text Editor Test Suite</h1>
        
        {/* Isolated Demo */}
        <RichTextEditorDemo />
        
        <div className="mt-12 border-t border-gray-700 pt-8">
          <h2 className="text-2xl font-bold mb-6">Full Modal Test</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-violet-600 hover:bg-violet-700"
          >
            Open Task Creation Modal
          </Button>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Test Scenarios:</h3>
            <Button onClick={runStateTest} variant="outline" className="w-full">
              Test 1: State Synchronization
            </Button>
            <Button onClick={runSelectionTest} variant="outline" className="w-full">
              Test 2: Selection & Link Creation
            </Button>
            <Button onClick={runFormattingTest} variant="outline" className="w-full">
              Test 3: Formatting Button States
            </Button>
            <Button onClick={clearResults} variant="destructive" className="w-full">
              Clear Test Results
            </Button>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Created Tasks:</h3>
            <div className="bg-gray-800 p-4 rounded-lg max-h-40 overflow-y-auto">
              {tasks.length === 0 ? (
                <p className="text-gray-400">No tasks created yet</p>
              ) : (
                tasks.map((task, index) => (
                  <div key={task.id} className="mb-2 p-2 bg-gray-700 rounded">
                    <div className="font-medium">{task.title}</div>
                    <div className="text-sm text-gray-300">
                      Description HTML: {task.description?.substring(0, 100) || 'None'}
                      {task.description && task.description.length > 100 && '...'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Test Results & Instructions</h2>
          <div className="bg-gray-800 p-4 rounded-lg h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-400">Click a test button to see instructions</p>
            ) : (
              testResults.map((result, index) => (
                <div 
                  key={index} 
                  className={`mb-2 ${result.startsWith('===') ? 'font-bold text-yellow-400 mt-4' : 'text-gray-300'}`}
                >
                  {result}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Debug Information */}
      <div className="mt-8 bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-2">Debug Information</h3>
        <div className="text-sm text-gray-300 space-y-1">
          <div>Total Tasks Created: {tasks.length}</div>
          <div>Modal Open: {isModalOpen ? 'Yes' : 'No'}</div>
          <div>Test Results Count: {testResults.length}</div>
        </div>
      </div>

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateTask={handleCreateTask}
        availableTags={mockTags}
        onCreateTag={handleCreateTag}
      />
        </div>
      </div>
    </div>
  );
};

export default RichTextEditorTest; 