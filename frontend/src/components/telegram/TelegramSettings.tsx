import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle, MessageSquare, Users, User, Hash } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

interface TelegramChat {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  created_at: string;
}

interface TelegramStatus {
  success: boolean;
  bot_configured: boolean;
  monitored_chats_count: number;
  monitored_chats: TelegramChat[];
}

const TelegramSettings = () => {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [availableChats, setAvailableChats] = useState<TelegramChat[]>([]);
  const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
    fetchAvailableChats();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/v1/telegram/status');
      const data = await response.json();
      setStatus(data);
      
      // Pre-select currently monitored chats
      if (data.monitored_chats) {
        setSelectedChatIds(data.monitored_chats.map((chat: TelegramChat) => chat.chat_id));
      }
    } catch (error) {
      console.error("Failed to fetch Telegram status", error);
      toast({ 
        title: "Error", 
        description: "Could not fetch Telegram status.", 
        variant: 'destructive' 
      });
    }
  };

  const fetchAvailableChats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/telegram/selectable_chats');
      const data = await response.json();
      
      if (data.success) {
        setAvailableChats(data.chats || []);
      }
    } catch (error) {
      console.error("Failed to fetch available chats", error);
      toast({ 
        title: "Error", 
        description: "Could not fetch available chats.", 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChatToggle = (chatId: number, checked: boolean) => {
    if (checked) {
      setSelectedChatIds(prev => [...prev, chatId]);
    } else {
      setSelectedChatIds(prev => prev.filter(id => id !== chatId));
    }
  };

  const handleSaveSelections = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v1/telegram/monitored_chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_ids: selectedChatIds })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Settings Saved!",
          description: `Now monitoring ${data.monitored_count} chat(s).`
        });
        
        // Refresh status
        fetchStatus();
      } else {
        throw new Error(data.message || 'Failed to save settings');
      }
    } catch (error: any) {
      console.error("Failed to save monitored chats", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save chat monitoring settings.",
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const getChatTypeIcon = (chatType: string) => {
    switch (chatType) {
      case 'group':
      case 'supergroup':
        return <Users className="text-blue-400" size={16} />;
      case 'channel':
        return <Hash className="text-green-400" size={16} />;
      default:
        return <User className="text-purple-400" size={16} />;
    }
  };

  const getBotStatus = () => {
    if (!status) return null;
    
    if (!status.bot_configured) {
      return {
        icon: <AlertCircle className="text-red-400" size={16} />,
        text: "Bot Not Configured",
        description: "Telegram bot token is missing or invalid"
      };
    }
    
    return {
      icon: <CheckCircle className="text-green-400" size={16} />,
      text: "Bot Configured",
      description: "Ready to receive and send messages"
    };
  };

  const botStatus = getBotStatus();

  return (
    <div className="space-y-6">
      <Card className="bg-dark-secondary border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center gap-2">
            <MessageSquare className="text-blue-400" size={20} />
            Telegram Integration
          </CardTitle>
          <CardDescription className="text-white/70">
            Configure which Telegram chats you want Minus to monitor and help you manage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full bg-white/10" />
              <Skeleton className="h-10 w-48 bg-white/10" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bot Status Section */}
              {botStatus && (
                <div className="flex items-center justify-between p-4 bg-dark-tertiary rounded-lg">
                  <div className="flex items-center gap-4">
                    <MessageSquare className="text-white/80" size={20} />
                    <div>
                      <span className="text-white font-medium">Telegram Bot</span>
                      <p className="text-sm text-white/60">{botStatus.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {botStatus.icon}
                    <span className={status?.bot_configured ? "text-green-400" : "text-red-400"}>
                      {botStatus.text}
                    </span>
                  </div>
                </div>
              )}

              {/* Instructions */}
              {status?.bot_configured && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="text-blue-400 font-medium mb-2">How to get started:</h4>
                  <ol className="text-sm text-white/70 space-y-1 list-decimal list-inside">
                    <li>Add your bot to the Telegram chats you want to monitor</li>
                    <li>Send a message in those chats so the bot can see them</li>
                    <li>Refresh this page and select the chats below</li>
                    <li>Save your selections to start monitoring</li>
                  </ol>
                </div>
              )}

              {/* Chat Selection */}
              {status?.bot_configured && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Select Chats to Monitor</h3>
                    <Button
                      onClick={fetchAvailableChats}
                      variant="outline"
                      size="sm"
                      className="text-white border-white/20"
                    >
                      Refresh
                    </Button>
                  </div>

                  {availableChats.length === 0 ? (
                    <div className="text-center py-8 text-white/50">
                      <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No chats available yet.</p>
                      <p className="text-sm">Make sure to add the bot to your chats and send some messages first.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableChats.map((chat) => (
                        <div 
                          key={chat.chat_id} 
                          className="flex items-center space-x-3 p-3 bg-dark-tertiary/50 rounded-lg hover:bg-dark-tertiary transition-colors"
                        >
                          <Checkbox
                            id={`chat-${chat.chat_id}`}
                            checked={selectedChatIds.includes(chat.chat_id)}
                            onCheckedChange={(checked) => 
                              handleChatToggle(chat.chat_id, checked as boolean)
                            }
                          />
                          <div className="flex items-center gap-2 flex-1">
                            {getChatTypeIcon(chat.chat_type)}
                            <div>
                              <label 
                                htmlFor={`chat-${chat.chat_id}`}
                                className="text-white font-medium cursor-pointer"
                              >
                                {chat.chat_name}
                              </label>
                              <p className="text-xs text-white/50 capitalize">
                                {chat.chat_type} • ID: {chat.chat_id}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {availableChats.length > 0 && (
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <p className="text-sm text-white/60">
                        {selectedChatIds.length} chat(s) selected
                      </p>
                      <Button
                        onClick={handleSaveSelections}
                        disabled={saving}
                        className="bg-violet hover:bg-violet-light"
                      >
                        {saving ? "Saving..." : "Save Selections"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Current Status */}
              {status && (
                <div className="bg-dark-tertiary/30 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Current Status</h4>
                  <div className="text-sm text-white/70 space-y-1">
                    <p>• Bot configured: {status.bot_configured ? "Yes" : "No"}</p>
                    <p>• Monitored chats: {status.monitored_chats_count}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramSettings; 