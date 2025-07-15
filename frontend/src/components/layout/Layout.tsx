import React, { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/Sidebar";
import ContentHeader from "@/components/layout/ContentHeader";
import MobileTopNav from "@/components/layout/MobileTopNav";
import MobileSidebar from "@/components/layout/MobileSidebar";
import TelegramFocusMode from "@/components/telegram/TelegramFocusMode";
import { useTelegramNotifications } from "@/hooks/useTelegramNotifications";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Home, Calendar, LayoutGrid, Mail, FileText, Settings, Send, Bot } from "lucide-react";
import GeneralPurposeChatWrapper, { TelegramDraft } from "./GeneralPurposeChatWrapper";

interface LayoutProps {
  children: React.ReactNode;
  showChatSidebar?: boolean;
  customChatSidebar?: React.ReactNode;
  customChatCollapsed?: boolean;
}

const pageConfig: { [key: string]: { title: string; icon: React.ReactNode } } = {
  "/": { title: "Home", icon: <Home size={22} /> },
  "/calendar": { title: "Schedule", icon: <Calendar size={22} /> },
  "/email": { title: "Emails", icon: <Mail size={22} /> },
  "/docs": { title: "Docs Dashboard", icon: <FileText size={22} /> },
  "/settings": { title: "Settings", icon: <Settings size={22} /> },
  "/mission-control": { title: "Mission Control", icon: <Bot size={22} /> },
};

const Layout: React.FC<LayoutProps> = ({ children, showChatSidebar = true, customChatSidebar, customChatCollapsed = false }) => {
  const isMobile = useIsMobile();
  const location = useLocation();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // --- Sidebar Resizing State ---
  const [chatWidth, setChatWidth] = useState(384); // 384px = w-96
  const minChatWidth = 320; // px
  const maxChatWidth = 600; // px
  const isResizing = useRef(false);

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

  const [telegramDraft, setTelegramDraft] = useState<TelegramDraft | null>(null);

  const handleToggleFocusMode = () => {
    toggleFocusMode();
    if (!isFocusModeActive) {
      refreshSummary();
    }
  };

  const handleMenuClick = () => setIsMobileSidebarOpen(true);
  const handleCloseSidebar = () => setIsMobileSidebarOpen(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };
  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const layoutRect = document.getElementById('main-layout-row')?.getBoundingClientRect();
    if (!layoutRect) return;
    const newWidth = layoutRect.right - e.clientX;
    setChatWidth(Math.max(minChatWidth, Math.min(maxChatWidth, newWidth)));
  };
  const handleMouseUp = () => {
    isResizing.current = false;
    document.body.style.cursor = '';
  };
  React.useEffect(() => {
    if (!isMobile) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });

  const currentPage = pageConfig[location.pathname] || { title: "Docs View", icon: <FileText size={22} /> };

  return (
    <div className="flex h-screen w-full bg-gradient-main overflow-hidden">
      {!isMobile && <Sidebar />}
      <div id="main-layout-row" className="flex flex-1 h-full w-full overflow-hidden">
        {/* Main Content Area */}
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
                  draft={telegramDraft}
                  clearDraft={() => setTelegramDraft(null)}
                />
              </div>
            )}
          </div>
        </main>
        {/* Vertical Divider for Resizing */}
        {!isMobile && showChatSidebar && (
          <div
            onMouseDown={handleMouseDown}
            style={{ cursor: 'col-resize', width: 6, zIndex: 50 }}
            className="bg-dark-tertiary hover:bg-violet transition-colors duration-150"
          />
        )}
        {/* Chat Sidebar */}
        {!isMobile && showChatSidebar && (
          <div
            style={{ 
              width: customChatSidebar && customChatCollapsed ? 48 : chatWidth, 
              minWidth: customChatSidebar && customChatCollapsed ? 48 : minChatWidth, 
              maxWidth: customChatSidebar && customChatCollapsed ? 48 : maxChatWidth 
            }}
            className="h-full flex flex-col transition-all duration-200 bg-dark-secondary border-l border-white/5"
          >
            {customChatSidebar || <GeneralPurposeChatWrapper setTelegramDraft={setTelegramDraft} isCollapsed={false} onToggleCollapse={() => {}} />}
          </div>
        )}
      </div>
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={handleCloseSidebar} />
      )}
    </div>
  );
};

export default Layout;
