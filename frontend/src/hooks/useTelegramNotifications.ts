import { useState, useEffect, useCallback } from 'react';

interface TelegramNotification {
  event: string;
  chat_id: number;
  chat_name: string;
  sender_name: string;
  content: string;
  message_type: string;
  timestamp: string;
}

interface TelegramNotificationState {
  unreadCount: number;
  isFocusModeActive: boolean;
  latestNotification: TelegramNotification | null;
}

export const useTelegramNotifications = () => {
  const [state, setState] = useState<TelegramNotificationState>({
    unreadCount: 0,
    isFocusModeActive: false,
    latestNotification: null
  });

  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    // Determine WebSocket protocol based on browser's protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/calendar/test_user_001`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Telegram WebSocket connected');
      setWsConnection(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'new_telegram_message') {
          setState(prev => ({
            ...prev,
            unreadCount: prev.unreadCount + 1,
            latestNotification: data as TelegramNotification
          }));
          
          // Show browser notification if supported
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
      // Attempt to reconnect after 5 seconds
      setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }, []);

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

  const fetchInitialUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/telegram/unread_summary');
      const data = await response.json();
      
      if (data.success) {
        const totalUnread = data.total_unread_messages || 0;
        setState(prev => ({
          ...prev,
          unreadCount: totalUnread
        }));
      }
    } catch (error) {
      console.error('Failed to fetch initial unread count:', error);
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Fetch initial unread count
    fetchInitialUnreadCount();
    
    // Connect WebSocket
    const ws = connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connectWebSocket, fetchInitialUnreadCount]);

  return {
    unreadCount: state.unreadCount,
    isFocusModeActive: state.isFocusModeActive,
    latestNotification: state.latestNotification,
    toggleFocusMode: toggleFocusMode, // Use the new handler
    closeFocusMode,
    markAsRead,
    refreshUnreadCount: fetchInitialUnreadCount
  };
}; 