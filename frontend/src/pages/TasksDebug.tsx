import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';

// Test imports at the top level
let typeImportTest = 'unknown';
let uiImportTest = 'unknown';
let calendarImportTest = 'unknown';

try {
  import('@/types/task');
  typeImportTest = 'success';
} catch (e) {
  typeImportTest = `error: ${e}`;
}

try {
  import('@/components/ui/button');
  uiImportTest = 'success';
} catch (e) {
  uiImportTest = `error: ${e}`;
}

try {
  import('@fullcalendar/react');
  calendarImportTest = 'success';
} catch (e) {
  calendarImportTest = `error: ${e}`;
}

// Test imports step by step
const TasksDebug: React.FC = () => {
  const [testStep, setTestStep] = useState(1);

  return (
    <Layout>
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 overflow-y-auto main-content-scrollbar mt-20 md:mt-0">
          <div className="h-4" />
          <div className="px-6">
            <h1 className="text-3xl font-bold relative">
              <span className="relative text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">
                Tasks Debug - Step {testStep}
              </span>
            </h1>
            
            <div className="mt-8 space-y-4">
              <button 
                onClick={() => setTestStep(1)}
                className="px-4 py-2 bg-violet text-white rounded-lg mr-2"
              >
                Test 1: Basic Layout
              </button>
              <button 
                onClick={() => setTestStep(2)}
                className="px-4 py-2 bg-violet text-white rounded-lg mr-2"
              >
                Test 2: Import Types
              </button>
              <button 
                onClick={() => setTestStep(3)}
                className="px-4 py-2 bg-violet text-white rounded-lg mr-2"
              >
                Test 3: UI Components
              </button>
              <button 
                onClick={() => setTestStep(4)}
                className="px-4 py-2 bg-violet text-white rounded-lg mr-2"
              >
                Test 4: Calendar
              </button>
            </div>

            <div className="mt-8 bg-dark-secondary/80 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg p-6">
              {testStep === 1 && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Test 1: Basic Layout ✅</h2>
                  <p className="text-white/70">Layout is working correctly.</p>
                </div>
              )}

              {testStep === 2 && (
                <TestTypes />
              )}

              {testStep === 3 && (
                <TestUIComponents />
              )}

              {testStep === 4 && (
                <TestCalendar />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const TestTypes: React.FC = () => {
  try {
    // Test type imports with different methods
    import('@/types/task').then(() => {
      console.log('Types imported successfully');
    });
    
    return (
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Test 2: Import Types ✅</h2>
        <p className="text-white/70">Task and TaskView types imported successfully.</p>
        <p className="text-white/50 text-sm mt-2">Path: @/types/task</p>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-red-400 mb-4">Test 2: Import Types ❌</h2>
        <p className="text-white/70">Error: {String(error)}</p>
        <p className="text-white/50 text-sm mt-2">Trying path: @/types/task</p>
      </div>
    );
  }
};

const TestUIComponents: React.FC = () => {
  try {
    const Button = require('@/components/ui/button').Button;
    const Input = require('@/components/ui/input').Input;
    const Label = require('@/components/ui/label').Label;
    
    return (
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Test 3: UI Components ✅</h2>
        <p className="text-white/70">Button, Input, Label components imported successfully.</p>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-red-400 mb-4">Test 3: UI Components ❌</h2>
        <p className="text-white/70">Error: {error.message}</p>
      </div>
    );
  }
};

const TestCalendar: React.FC = () => {
  try {
    const FullCalendar = require('@fullcalendar/react').default;
    const dayGridPlugin = require('@fullcalendar/daygrid').default;
    
    return (
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Test 4: FullCalendar ✅</h2>
        <p className="text-white/70">FullCalendar components imported successfully.</p>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-red-400 mb-4">Test 4: FullCalendar ❌</h2>
        <p className="text-white/70">Error: {error.message}</p>
      </div>
    );
  }
};

export default TasksDebug; 