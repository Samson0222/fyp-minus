import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, User, Hash, MessageSquare, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Matches the interface in TelegramSettings.tsx
interface TelegramChat {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  is_active: boolean;
}

interface TelegramDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  chats: TelegramChat[];
  onSave: (updatedChats: TelegramChat[]) => Promise<boolean>;
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const ChatItem = ({ chat, isSelected, onToggle }: { chat: TelegramChat; isSelected: boolean; onToggle: (id: number) => void; }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'group':
      case 'supergroup':
        return <Users className="text-white/80" size={20} />;
      case 'private':
        return <User className="text-white/80" size={20} />;
      case 'channel':
        return <Hash className="text-white/80" size={20} />;
      default:
        return <MessageSquare className="text-white/80" size={20} />;
    }
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-dark-tertiary/60 rounded-lg">
      <Checkbox
        id={`dash-chat-${chat.chat_id}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(chat.chat_id)}
        className="border-white/30"
      />
      {getIcon(chat.chat_type)}
      <div className="flex-1">
        <label htmlFor={`dash-chat-${chat.chat_id}`} className="text-white font-medium cursor-pointer">{chat.chat_name}</label>
        <p className="text-xs text-white/50 capitalize">{chat.chat_type} • ID: {chat.chat_id}</p>
      </div>
    </div>
  );
};

const TelegramDashboard: React.FC<TelegramDashboardProps> = ({ isOpen, onClose, chats, onSave, isLoading, onRefresh, isRefreshing }) => {
  const [selectedInactive, setSelectedInactive] = useState<number[]>([]);
  const [selectedActive, setSelectedActive] = useState<number[]>([]);
  const { toast } = useToast();

  const { activeChats, inactiveChats } = useMemo(() => {
    const sortedChats = [...chats].sort((a, b) => a.chat_name.localeCompare(b.chat_name));
    return {
      activeChats: sortedChats.filter(c => c.is_active),
      inactiveChats: sortedChats.filter(c => !c.is_active),
    };
  }, [chats]);

  const handleToggle = (list: number[], setList: React.Dispatch<React.SetStateAction<number[]>>, id: number) => {
    if (list.includes(id)) {
      setList(list.filter(item => item !== id));
    } else {
      setList([...list, id]);
    }
  };
  
  const handleBatchUpdate = async (activate: boolean) => {
    const idsToUpdate = activate ? selectedInactive : selectedActive;
    if (idsToUpdate.length === 0) return;

    const updatedChats = chats.map(chat => 
      idsToUpdate.includes(chat.chat_id) ? { ...chat, is_active: activate } : chat
    );

    const success = await onSave(updatedChats);
    if (success) {
      // Clear selections after successful save
      if (activate) {
        setSelectedInactive([]);
      } else {
        setSelectedActive([]);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-secondary border-white/20 text-white max-w-4xl p-0">
        <DialogHeader className="p-6">
          <DialogTitle className="text-2xl">Telegram Chat Management</DialogTitle>
          <DialogDescription className="text-white/70">
            Activate or deactivate chats for monitoring. Only active chats will be processed by Minus.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Inactive Column */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white/90">Inactive Chats ({inactiveChats.length})</h3>
            <ScrollArea className="h-72 pr-4">
              <div className="space-y-3">
                {inactiveChats.length > 0 ? (
                  inactiveChats.map(chat => (
                    <ChatItem 
                      key={chat.chat_id}
                      chat={chat} 
                      isSelected={selectedInactive.includes(chat.chat_id)}
                      onToggle={(id) => handleToggle(selectedInactive, setSelectedInactive, id)}
                    />
                  ))
                ) : (
                  <p className="text-white/50 text-center pt-10">No inactive chats found.</p>
                )}
              </div>
            </ScrollArea>
             <Button 
              onClick={() => handleBatchUpdate(true)} 
              disabled={selectedInactive.length === 0 || isLoading}
              className="w-full bg-violet hover:bg-violet-light"
            >
              Activate Selected <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Active Column */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white/90">Active Chats ({activeChats.length})</h3>
            <ScrollArea className="h-72 pr-4">
               <div className="space-y-3">
                {activeChats.length > 0 ? (
                  activeChats.map(chat => (
                    <ChatItem 
                      key={chat.chat_id}
                      chat={chat}
                      isSelected={selectedActive.includes(chat.chat_id)}
                      onToggle={(id) => handleToggle(selectedActive, setSelectedActive, id)}
                    />
                  ))
                ) : (
                  <p className="text-white/50 text-center pt-10">No active chats.</p>
                )}
              </div>
            </ScrollArea>
            <Button 
              onClick={() => handleBatchUpdate(false)} 
              disabled={selectedActive.length === 0 || isLoading}
              variant="destructive"
              className="w-full"
            >
              Deactivate Selected
            </Button>
          </div>
        </div>
        
        <DialogFooter className="bg-dark-tertiary p-4 flex justify-between">
          <Button 
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing || isLoading}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Discovered Chats'}
          </Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramDashboard; 
 
 
 
 
 
 
 
 
 
 
 