import React, { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/Sidebar";
import ChatSidebar from "@/components/layout/ChatSidebar";
import ContentHeader from "@/components/layout/ContentHeader";
import MobileTopNav from "@/components/layout/MobileTopNav";
import MobileSidebar from "@/components/layout/MobileSidebar";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleMenuClick = () => {
    setIsMobileSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  const handleToggleListening = () => {
    setIsListening(!isListening);
  };

  const handleSendMessage = (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const responseText = getAIResponse(text);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
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
        <ChatSidebar 
          onSendMessage={handleSendMessage}
          onToggleListening={handleToggleListening}
          isListening={isListening}
          messages={messages}
          isCollapsed={isChatSidebarCollapsed}
          onToggleCollapse={handleToggleChatSidebar}
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

// Helper function to simulate AI responses
const getAIResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
    return "Hello! I'm ready to help you with professional tasks. What would you like to do?";
  }
  
  if (lowerMessage.includes("email") || lowerMessage.includes("mail")) {
    return "I can help with email management. Would you like me to check your inbox or help you compose a new email?";
  }
  
  if (lowerMessage.includes("document") || lowerMessage.includes("doc")) {
    return "I'll assist with document management. Would you like to create a new document or work with an existing one?";
  }
  
  if (lowerMessage.includes("meeting") || lowerMessage.includes("schedule") || lowerMessage.includes("calendar")) {
    return "I can help schedule meetings and manage your calendar. Would you like to check your upcoming events or schedule something new?";
  }
  
  if (lowerMessage.includes("message") || lowerMessage.includes("telegram") || lowerMessage.includes("team")) {
    return "I can help with team communication. Would you like to send a message or check recent conversations?";
  }
  
  return `I understand you said: "${userMessage}". How would you like me to help with this?`;
};

export default Layout;
