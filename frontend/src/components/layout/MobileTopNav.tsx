import React from "react";
import { useLocation } from "react-router-dom";
import { Menu, Home, CheckSquare, Calendar, Inbox, FileText, Settings, Search, BookOpen, Mail, Activity, FlaskConical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MobileTopNavProps {
  onMenuClick: () => void;
}

const MobileTopNav: React.FC<MobileTopNavProps> = ({ onMenuClick }) => {
  const location = useLocation();

  // Map routes to page info
  const getPageInfo = (pathname: string) => {
    if (pathname.startsWith("/tasks")) return { icon: <CheckSquare size={20} />, title: "Tasks" };
    if (pathname.startsWith("/calendar")) return { icon: <Calendar size={20} />, title: "Calendar" };
    if (pathname.startsWith("/docs")) return { icon: <FileText size={20} />, title: "Docs" };
    if (pathname.startsWith("/emails")) return { icon: <Mail size={20} />, title: "Email" };
    if (pathname.startsWith("/mission-control")) return { icon: <Activity size={20} />, title: "Mission Control" };
    if (pathname.startsWith("/playground")) return { icon: <FlaskConical size={20} />, title: "Playground" };
    return { icon: <Home size={20} />, title: "Dashboard" };
  };

  const currentPage = getPageInfo(location.pathname);

  const handleTutorialsClick = () => {
    // Add tutorials functionality here
    console.log("Tutorials clicked");
    // You can navigate to tutorials page or open a modal/drawer
    // For example: navigate('/tutorials') or setTutorialsOpen(true)
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-dark-secondary border-b border-white/5 z-20">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Menu Button */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center text-foreground/70 hover:text-white transition-colors p-2"
        >
          <Menu size={20} />
          <span className="text-xs mt-1">Menu</span>
        </button>
        
        {/* Current Page Title with Icon */}
        <div className="flex items-center gap-3 text-white">
          {currentPage.icon}
          <span className="text-base font-semibold">{currentPage.title}</span>
        </div>
        
        {/* Search Bar and Tutorials */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50" size={16} />
            <Input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 w-32 bg-dark-tertiary border-white/5 text-white placeholder-foreground/50 text-sm focus:border-violet-light"
            />
          </div>
          
          {/* Tutorials Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTutorialsClick}
            className="border-white/5 text-white bg-dark-tertiary hover:border-violet-light hover:text-white transition-colors p-2"
          >
            <BookOpen size={14} />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default MobileTopNav; 