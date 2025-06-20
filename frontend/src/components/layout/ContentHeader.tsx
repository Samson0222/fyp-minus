import React from "react";
import { useLocation } from "react-router-dom";
import { Home, CheckSquare, Calendar, Inbox, FileText, Settings, User, Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
        return { icon: <Inbox size={20} />, title: "Inboxes" };
      case "/documents":
        return { icon: <FileText size={20} />, title: "Docs" };
      case "/settings":
        return { icon: <Settings size={20} />, title: "Settings" };
      case "/profile":
        return { icon: <User size={20} />, title: "Profile" };
      default:
        return { icon: <Home size={20} />, title: "Home" };
    }
  };

  const currentPage = getPageInfo(location.pathname);

  const handleTutorialsClick = () => {
    // Add tutorials functionality here
    console.log("Tutorials clicked");
    // You can navigate to tutorials page or open a modal/drawer
    // For example: navigate('/tutorials') or setTutorialsOpen(true)
  };

  return (
    <header className="bg-dark-secondary px-6 py-6 relative flex items-center">
      {/* Header content with page info, search, and tutorials - centered vertically */}
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

        {/* Tutorials Button */}
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTutorialsClick}
            className="border-white/5 text-white bg-dark-tertiary hover:border-violet-light hover:text-white transition-colors"
          >
            <BookOpen size={16} className="mr-2" />
            Tutorials
          </Button>
        </div>
      </div>

      {/* Gradient separator line starting from left edge */}
      <div className="absolute left-0 right-0 bottom-0 h-[1px] bg-gradient-to-r from-violet-light via-violet to-transparent"></div>
    </header>
  );
};

export default ContentHeader; 