import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    // Remove prose classes and apply base styles manually for consistency
    <div className="text-sm leading-relaxed text-white">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Ensure all components inherit and use the consistent styling
          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
          strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
          a: ({node, ...props}) => <a className="text-blue-400 hover:underline" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
          li: ({node, ...props}) => <li className="text-white" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 