import React from "react";
import { useLocation } from "react-router-dom";
import { Home, CheckSquare, Calendar, Mail, FileText, Settings, User, Search, Mic, Activity, FlaskConical } from "lucide-react";
import { Input } from "@/components/ui/input";

const ContentHeader = () => {
  const location = useLocation();

  const getHeaderInfo = (pathname: string) => {
    if (pathname.startsWith("/tasks")) return { icon: <CheckSquare size={20} />, title: "Tasks" };
    if (pathname.startsWith("/calendar")) return { icon: <Calendar size={20} />, title: "Calendar" };
    if (pathname.startsWith("/docs")) return { icon: <FileText size={20} />, title: "Docs" };
    if (pathname.startsWith("/emails")) return { icon: <Mail size={20} />, title: "Email" };
    if (pathname.startsWith("/mission-control")) return { icon: <Activity size={20} />, title: "Mission Control" };
    if (pathname.startsWith("/playground")) return { icon: <FlaskConical size={20} />, title: "Playground" };
    return { icon: <Home size={20} />, title: "Dashboard" };
  };

  const { icon: Icon, title } = getHeaderInfo(location.pathname);

  return (
    <header className="bg-dark-secondary px-6 py-3 relative flex items-center">
      {/* Header content with page info and search - centered vertically */}
      <div className="flex items-center justify-between w-full">
        {/* Page icon and title */}
        <div className="flex items-center gap-3">
          {Icon}
          <h1 className="text-xl font-semibold text-white">{title}</h1>
        </div>

        {/* Centered Search bar with more width and hover effects */}
        <div className="flex-1 flex justify-center px-8">
          <div className="relative w-[500px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50" size={16} />
            <Input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 w-full bg-dark-tertiary border-white/5 text-white placeholder-foreground/50 text-sm focus:border-violet-light hover:border-white/20 hover:bg-dark-tertiary/80 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* Gradient separator line starting from left edge */}
      <div className="absolute left-0 right-0 bottom-0 h-[1px] bg-gradient-to-r from-violet-light via-violet to-transparent"></div>
    </header>
  );
};

export default ContentHeader; 