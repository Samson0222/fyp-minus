import React from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

interface ContentHeaderProps {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const ContentHeader: React.FC<ContentHeaderProps> = ({ title, icon, children }) => {
  const location = useLocation();
  const isEmailPage = location.pathname === "/email";

  return (
    <header className="flex-shrink-0 bg-dark-secondary px-6 py-4 flex items-center justify-between border-b border-slate-800 h-16">
      <div className="flex items-center gap-3">
        {icon && <div className="text-white/80">{icon}</div>}
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </header>
  );
};

export default ContentHeader; 