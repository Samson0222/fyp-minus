import React from 'react';
import Layout from '@/components/layout/Layout';

const TasksSimple: React.FC = () => {
  return (
    <Layout>
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 overflow-y-auto main-content-scrollbar mt-20 md:mt-0">
          <div className="h-4" />
          <div className="px-6">
            <h1 className="text-3xl font-bold relative">
              <span className="relative text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">
                Tasks & Calendar - Simple Test
              </span>
            </h1>
            <p className="text-foreground/70 mt-4">
              This is a simple test page to verify routing is working correctly.
            </p>
            <div className="mt-8 bg-dark-secondary/80 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Test Content</h2>
              <p className="text-white/70">
                If you can see this page, then the routing is working correctly. 
                We can then proceed to debug the full Tasks component.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TasksSimple; 