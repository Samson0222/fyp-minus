import React, { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/Sidebar";
import GmailChat from "@/pages/GmailChat";
import ContentHeader from "@/components/layout/ContentHeader";
import MobileTopNav from "@/components/layout/MobileTopNav";
import MobileSidebar from "@/components/layout/MobileSidebar";

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

const Layout: React.FC<LayoutProps> = ({ children, onComposeEmail, voiceCommandCallbacks }) => {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);

  const handleMenuClick = () => {
    setIsMobileSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  const handleToggleChatSidebar = () => {
    setIsChatSidebarCollapsed(!isChatSidebarCollapsed);
  };

  return (
    <div className="flex h-screen w-full bg-gradient-main overflow-hidden">
      {!isMobile && <Sidebar />}
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {isMobile && <MobileTopNav onMenuClick={handleMenuClick} />}
        {!isMobile && <ContentHeader />}
        
        <div className="w-full flex-1 flex flex-col h-full overflow-hidden">
          {children}
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
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={handleCloseSidebar}
        />
      )}
    </div>
  );
};

export default Layout;
