import React from "react";
import { Link } from "react-router-dom";
import { Home, CheckSquare, Calendar, Inbox, FileText, Settings, User, LogOut } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileSidebar: React.FC<MobileSidebarProps> = ({ isOpen, onClose }) => {
  const menuItems = [
    { icon: <Home size={20} />, name: "Home", path: "/" },
    { icon: <CheckSquare size={20} />, name: "Tasks", path: "/tasks" },
    { icon: <Calendar size={20} />, name: "Calendar", path: "/calendar" },
    { icon: <Inbox size={20} />, name: "Inboxes", path: "/inboxes" },
    { icon: <FileText size={20} />, name: "Docs", path: "/documents" },
    { icon: <Settings size={20} />, name: "Settings", path: "/settings" },
  ];

  const handleLogout = () => {
    // Add logout logic here
    console.log("Logging out...");
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-64 p-0 bg-dark-secondary border-r border-white/5 [&>button]:hidden">
        <div className="flex flex-col h-full">
          {/* Header with Logo */}
          <div className="p-6 border-b border-white/5">
            <Link to="/" className="flex items-center gap-2" onClick={onClose}>
              {/* Logo matching the desktop sidebar */}
              <div className="relative">
                <div className="relative w-10 h-10 rounded-full bg-dark-tertiary flex items-center justify-center border border-violet-light shadow-[0_0_10px_rgba(138,107,244,0.7)]">
                  <span className="font-bold text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text text-lg">M</span>
                </div>
              </div>
              
              {/* Title with dark text and no glow effect */}
              <h1 className="text-xl font-bold relative">
                <span className="relative text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">Minus AI</span>
              </h1>
            </Link>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? "bg-violet text-white"
                        : "text-foreground/70 hover:text-white hover:bg-dark-tertiary"
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Bottom Section with Profile and Logout */}
          <div className="p-4 border-t border-white/5">
            <div className="flex gap-2">
              <Link
                to="/profile"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground/70 hover:text-white hover:bg-dark-tertiary transition-colors flex-1"
              >
                <User size={20} />
                <span>Profile</span>
              </Link>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground/70 hover:text-white hover:bg-red-600/20 hover:text-red-400 transition-colors flex-1"
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileSidebar; 