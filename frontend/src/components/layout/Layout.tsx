import React, { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/Sidebar";
import ContentHeader from "@/components/layout/ContentHeader";
import MobileTopNav from "@/components/layout/MobileTopNav";
import MobileSidebar from "@/components/layout/MobileSidebar";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleMenuClick = () => {
    setIsMobileSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsMobileSidebarOpen(false);
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
