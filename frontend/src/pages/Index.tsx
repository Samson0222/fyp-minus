import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import TranscriptArea from "@/components/ai/TranscriptArea";
import InteractionArea from "@/components/ai/InteractionArea";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, Calendar, Clock, Inbox } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();

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

  const handleToggleListening = () => {
    setIsListening((prev) => !prev);
    if (!isListening) {
      toast({
        title: "Listening...",
        description: "Say something or click again to stop.",
      });

      // Simulate stopping the recording after 5 seconds
      setTimeout(() => {
        if (isListening) {
          setIsListening(false);
          handleSendMessage("This is a simulated voice message");
        }
      }, 5000);
    } else {
      setIsListening(false);
    }
  };

  const cards = [
    {
      title: "My tasks",
      icon: <CheckSquare className="h-5 w-5" />,
      type: "tasks",
      reminderContent: "6 tasks pending",
      reminderSubtitle: "3 due today",
      tasks: [
        "Complete project proposal",
        "Review team performance reports",
        "Schedule client meeting for next week",
        "Update documentation for API endpoints",
        "Prepare presentation slides for stakeholders",
        "Fix bug in user authentication system",
      ],
    },
    {
      title: "Upcoming",
      icon: <Calendar className="h-5 w-5" />,
      type: "list",
      reminderContent: "2 meetings today",
      reminderSubtitle: "Next: Team standup at 10:30 AM",
      items: [
        "Team standup meeting - 10:30 AM",
        "Client presentation review - 2:00 PM",
        "Project planning session - 4:00 PM",
        "Weekly team sync - Tomorrow 9:00 AM",
      ],
    },
    {
      title: "Recent",
      icon: <Clock className="h-5 w-5" />,
      type: "list",
      reminderContent: "Last activity 2h ago",
      reminderSubtitle: "Project update completed",
      items: [
        "Completed project proposal draft",
        "Updated client requirements document",
        "Fixed authentication bug in login system",
        "Reviewed and approved design mockups",
        "Pushed code changes to staging environment",
      ],
    },
    {
      title: "Inboxes",
      icon: <Inbox className="h-5 w-5" />,
      type: "list",
      reminderContent: "3 unread messages",
      reminderSubtitle: "2 from team, 1 notification",
      items: [
        "Sarah: Project timeline updated",
        "Mike: Code review completed",
        "System: Deployment successful",
        "Anna: Meeting rescheduled to 3 PM",
      ],
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col h-full w-full">
        {/* Content Area - Entire content scrolls */}
        <div className="flex-1 overflow-y-auto main-content-scrollbar mt-20 md:mt-0">
          {/* Spacing for Header */}
          <div className="h-4" />

          {/* Welcome Section */}
          <div className="px-6 text-center">
            <h2 className="text-3xl font-bold mb-2 relative">
              <span className="relative text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">
                Welcome to Minus AI
              </span>
            </h2>
            <p className="text-foreground/70 max-w-md mx-auto">
              Your Personal AI Assistant.
            </p>
            <p className="text-foreground/70 max-w-md mx-auto">
              Type a message or say "Hey Minus" to activate.
            </p>
          </div>

          {/* Spacing after Welcome */}
          <div className="h-8" />

          {/* Cards Section */}
          <div className="px-6">
            {/* Desktop & Mobile Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-7xl mx-auto">
              {cards.map((card, index) => (
                <div key={index} className="h-[320px]">
                  {/* Title Area */}
                  <div className="mb-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <span className="text-white">{card.icon}</span>
                      <span className="text-transparent bg-gradient-to-r from-violet-light to-violet bg-clip-text">
                        {card.title}
                      </span>
                    </h3>
                  </div>

                  {/* Card Container */}
                  <Card className="bg-dark-tertiary border-white/10 hover:border-violet-light/30 transition-colors cursor-pointer h-[280px] overflow-hidden">
                    <CardContent className="p-6 flex flex-col h-full">
                      {/* Reminder Area */}
                      <div className="mb-4 pb-4 border-b border-white/10 flex-shrink-0">
                        <p className="text-white/90 font-medium mb-1">
                          {card.reminderContent}
                        </p>
                        <p className="text-white/60 text-sm">
                          {card.reminderSubtitle}
                        </p>
                      </div>

                      {/* List Area */}
                      <div className="flex-1 overflow-hidden">
                        <div className="space-y-0 h-full overflow-y-auto pr-3 scrollbar-custom">
                          {(card.tasks || card.items)?.map(
                                                         (item, itemIndex) => (
                               <div
                                 key={itemIndex}
                                 className="flex items-center gap-3 p-3 bg-dark-secondary border border-white/10 hover:bg-white/8 hover:border-violet-light/30 rounded-lg transition-all duration-200 group cursor-pointer select-none"
                                 onClick={() => console.log(`Selected: ${item}`)}
                               >
                                 {card.type === "tasks" && (
                                   <div className="flex-shrink-0">
                                     <div className="w-4 h-4 rounded-full border-2 border-white/40 group-hover:border-violet-light/60 transition-colors cursor-pointer" />
                                   </div>
                                 )}
                                 <div className="flex-1 min-w-0">
                                   <p className="text-white/85 text-base leading-6 truncate" title={item}>
                                     {item}
                                   </p>
                                 </div>
                               </div>
                             )
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Spacing at the end of content */}
          <div className="h-4" />
        </div>

        {/* Messages Overlay */}
        {messages.length > 0 && (
          <div className="absolute inset-0 bg-dark-primary/95 backdrop-blur-sm flex flex-col z-10">
            <div className="h-16 md:h-24" /> {/* Spacer for header */}
            <TranscriptArea messages={messages} />
          </div>
        )}

        {/* Interaction Area - Always at bottom */}
        <div className="flex-shrink-0 z-20">
          <InteractionArea
            onSendMessage={handleSendMessage}
            onToggleListening={handleToggleListening}
            isListening={isListening}
          />
        </div>
      </div>
    </Layout>
  );
};

// Helper function to simulate AI responses
const getAIResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
    return "Hello there. How may I assist you today?";
  }
  if (lowerMessage.includes("help") || lowerMessage.includes("can you")) {
    return "I'd be happy to assist with your request. Could you provide more details about what you need help with?";
  }
  return "I understand. How would you like me to proceed with this information?";
};

export default Index;
