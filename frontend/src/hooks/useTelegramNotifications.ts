import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface TelegramNotification {
  event: string;
  chat_id: number;
  chat_name: string;
  sender_name: string;
  content: string;
  message_type: string;
  timestamp: string;
}

interface ChatSummary {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  unread_count: number;
  latest_message: string;
  latest_sender: string;
  latest_timestamp: string;
}

interface TelegramNotificationState {
  unreadCount: number;
  isFocusModeActive: boolean;
  latestNotification: TelegramNotification | null;
  unreadChats: ChatSummary[];
  recentChats: ChatSummary[];
  loadingSummary: boolean;
}

export const useTelegramNotifications = () => {
  const [state, setState] = useState<TelegramNotificationState>({
    unreadCount: 0,
    isFocusModeActive: false,
    latestNotification: null,
    unreadChats: [],
    recentChats: [],
    loadingSummary: true,
  });

  const fetchSummary = useCallback(async () => {
    setState(prev => ({ ...prev, loadingSummary: true }));
    try {
      const response = await fetch('/api/v1/telegram/summary');
      const data = await response.json();
      
      if (data.success) {
        const unread = data.summary.unread || [];
        const recent = data.summary.recent || [];
        const totalUnread = unread.reduce((acc: number, chat: any) => acc + (chat.unread_count || 0), 0);
        setState(prev => ({
          ...prev,
          unreadCount: totalUnread,
          unreadChats: unread,
          recentChats: recent,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch telegram summary:', error);
    } finally {
      setState(prev => ({ ...prev, loadingSummary: false }));
    }
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    fetchSummary();

    let ws: WebSocket | null = null;
    
    const startSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
          console.error("User not authenticated, cannot connect WebSocket.");
          return;
      }
      const userId = session.user.id;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/${userId}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => console.log('Telegram WebSocket connected');
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'telegram_new_message') {
            fetchSummary(); // Refetch summary on new message for consistency
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`New message from ${data.sender_name}`, {
                body: data.content,
                icon: '/favicon.ico',
                tag: `telegram-${data.chat_id}`
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('Telegram WebSocket disconnected, attempting to reconnect...');
        setTimeout(startSocket, 5000);
      };
      
      ws.onerror = (error) => console.error('WebSocket error:', error);
    };

    startSocket();
    
    return () => {
      if (ws) {
        ws.onclose = null; // prevent reconnect on manual close
        ws.close();
      }
    };
  }, [fetchSummary]);

  const toggleFocusMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isFocusModeActive: !prev.isFocusModeActive
    }));
  }, []);

  const closeFocusMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isFocusModeActive: false
    }));
  }, []);

  const markAsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      unreadCount: 0
    }));
  }, []);

  return {
    ...state,
    toggleFocusMode,
    closeFocusMode,
    markAsRead,
    refreshSummary: fetchSummary,
  };
};
