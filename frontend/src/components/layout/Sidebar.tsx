import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, CheckSquare, Calendar, Inbox, FileText, Settings, User, LogOut } from "lucide-react";

const Sidebar = () => {
  const location = useLocation();

  // Menu items matching the requested structure
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
  };

  return (
    <aside className="w-64 h-full bg-dark-secondary border-r border-white/5 flex flex-col">
      {/* Header with Logo */}
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2">
          {/* Logo with gradient border, no animation */}
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
      <nav className="mt-6 flex-1">
        <ul className="space-y-2 px-2">
          {menuItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path}
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
      <div className="p-4 border-t border-white/5 space-y-2">
        <Link
          to="/profile"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            location.pathname === "/profile"
              ? "bg-violet text-white"
              : "text-foreground/70 hover:text-white hover:bg-dark-tertiary"
          }`}
        >
          <User size={20} />
          <span>Profile</span>
        </Link>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground/70 hover:text-white hover:bg-dark-tertiary transition-colors"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
