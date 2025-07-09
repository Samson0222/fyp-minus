import React from "react";

interface ContentHeaderProps {
  title: string;
  children?: React.ReactNode;
}

const ContentHeader: React.FC<ContentHeaderProps> = ({ title, children }) => {
  return (
    <header className="flex-shrink-0 bg-dark-secondary px-6 py-4 flex items-center justify-between border-b border-slate-800">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {children && <div>{children}</div>}
    </header>
  );
};

export default ContentHeader; 