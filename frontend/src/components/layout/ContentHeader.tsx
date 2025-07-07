import React from "react";
import { useLocation } from "react-router-dom";
import { Home, CheckSquare, Calendar, Mail, FileText, Settings, User, Search, Mic, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";

const ContentHeader = () => {
  const location = useLocation();

  // Menu items to match the sidebar
  const getPageInfo = (pathname: string) => {
    switch (pathname) {
      case "/":
        return { icon: <Home size={20} />, title: "Home" };
      case "/tasks":
        return { icon: <CheckSquare size={20} />, title: "Tasks" };
      case "/calendar":
        return { icon: <Calendar size={20} />, title: "Calendar" };
      case "/inboxes":
        return { icon: <Mail size={20} />, title: "Emails" };
      case "/docs":
        return { icon: <FileText size={20} />, title: "Docs" };
      case "/playground":
        return { icon: <Mic size={20} />, title: "Playground" };
      case "/settings":
        return { icon: <Settings size={20} />, title: "Settings" };
      case "/profile":
        return { icon: <User size={20} />, title: "Profile" };
      case "/mission-control":
        return { icon: <Activity size={20} />, title: "Mission Control" };
      default:
        return { icon: <Home size={20} />, title: "Home" };
    }
  };

  const currentPage = getPageInfo(location.pathname);

  return (
    <header className="bg-dark-secondary px-6 py-3 relative flex items-center">
      {/* Header content with page info and search - centered vertically */}
      <div className="flex items-center justify-between w-full">
        {/* Page icon and title */}
        <div className="flex items-center gap-3">
          <div className="text-white">
            {currentPage.icon}
          </div>
          <h2 className="text-base font-semibold text-white">
            {currentPage.title}
          </h2>
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