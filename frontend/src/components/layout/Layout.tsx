import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/Sidebar";
import GmailChat from "@/pages/GmailChat";
import ContentHeader from "@/components/layout/ContentHeader";
import MobileTopNav from "@/components/layout/MobileTopNav";
import MobileSidebar from "@/components/layout/MobileSidebar";
import TelegramFocusMode from "@/components/telegram/TelegramFocusMode";
import { useTelegramNotifications } from "@/hooks/useTelegramNotifications";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Home, Calendar, LayoutGrid, Mail, FileText, Settings, Send, Bot } from "lucide-react";

// Voice command callback interface for Gmail integration
interface VoiceCommandCallbacks {
  onUnreadFilter?: () => void;
  onRefreshEmails?: () => void;
  onComposeEmail?: () => void;
  onMarkAsUnread?: (emailId?: string) => void;
  onSearchEmails?: (query: string) => void;
  onClearFilters?: () => void;
  onReplyEmail?: () => void;
  onForwardEmail?: (recipient?: string) => void;
  onStarEmail?: () => void;
  onMarkImportant?: () => void;
}

interface LayoutProps {
  children: React.ReactNode;
  onComposeEmail?: () => void;
  voiceCommandCallbacks?: VoiceCommandCallbacks;
}

const pageConfig: { [key: string]: { title: string; icon: React.ReactNode } } = {
  "/": { title: "Home", icon: <Home size={22} /> },
  "/calendar": { title: "Schedule", icon: <Calendar size={22} /> },
  "/email": { title: "Emails", icon: <Mail size={22} /> },
  "/docs": { title: "Docs", icon: <FileText size={22} /> },
  "/settings": { title: "Settings", icon: <Settings size={22} /> },
  "/mission-control": { title: "Mission Control", icon: <Bot size={22} /> },
};

const Layout: React.FC<LayoutProps> = ({ children, onComposeEmail, voiceCommandCallbacks }) => {
  const isMobile = useIsMobile();
  const location = useLocation();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);

  const {
    unreadCount,
    isFocusModeActive,
    toggleFocusMode,
    closeFocusMode,
    unreadChats,
    recentChats,
    loadingSummary,
    refreshSummary,
  } = useTelegramNotifications();

  const handleToggleFocusMode = () => {
    toggleFocusMode();
    if (!isFocusModeActive) {
      refreshSummary();
    }
  };

  const handleMenuClick = () => setIsMobileSidebarOpen(true);
  const handleCloseSidebar = () => setIsMobileSidebarOpen(false);
  const handleToggleChatSidebar = () => setIsChatSidebarCollapsed(!isChatSidebarCollapsed);

  const currentPage = pageConfig[location.pathname] || { title: "Dashboard", icon: <Home size={22} /> };

  return (
    <div className="flex h-screen w-full bg-gradient-main overflow-hidden">
      {!isMobile && <Sidebar />}
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {isMobile ? (
          <MobileTopNav onMenuClick={handleMenuClick} />
        ) : (
          <ContentHeader title={currentPage.title} icon={currentPage.icon}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleToggleFocusMode}
                    variant="ghost"
                    size="icon"
                    className={`relative text-white/70 hover:text-white transition-colors ${isFocusModeActive ? 'bg-white/10 text-white' : ''}`}
                  >
                    <Send size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border-2 border-dark-secondary" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle Telegram Focus Mode</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ContentHeader>
        )}
        
        <div className="w-full flex-1 flex flex-col h-full overflow-hidden relative">
          {children}
          {isFocusModeActive && (
            <div className="absolute inset-0 z-40">
              <TelegramFocusMode
                isOpen={isFocusModeActive}
                onClose={closeFocusMode}
                unreadChats={unreadChats}
                recentChats={recentChats}
                loading={loadingSummary}
                onRefresh={refreshSummary}
              />
            </div>
          )}
        </div>
      </main>
      
      {!isMobile && (
        <GmailChat 
          isCollapsed={isChatSidebarCollapsed}
          onToggleCollapse={handleToggleChatSidebar}
          onComposeEmail={onComposeEmail}
          voiceCommandCallbacks={voiceCommandCallbacks}
        />
      )}
      
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={handleCloseSidebar} />
      )}
    </div>
  );
};

export default Layout;
