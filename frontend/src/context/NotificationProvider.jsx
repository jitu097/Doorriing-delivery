import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { messaging, getToken, onMessage, VAPID_KEY, isConfigPlaceholder, isVapidPlaceholder } from '../config/firebase';
import apiClient from '../services/apiClient';
import { deliveryService } from '../services/deliveryService';
import { useAuth } from '../hooks/useAuth';

export const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { courier } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentIncomingOrder, setCurrentIncomingOrder] = useState(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // DB-First Rule: Fetch active assignments from DB
  const fetchActiveAssignment = useCallback(async () => {
    if (!courier) return;
    try {
      // Fetch specifically 'assigned' status orders to show the card
      const response = await apiClient.get('/delivery/assigned-orders?status=assigned');
      const assigned = response.data.data;
      
      if (assigned && assigned.length > 0) {
        // Enforce single active assignment rule: take the most recent one
        setCurrentIncomingOrder(assigned[0]);
      } else {
        setCurrentIncomingOrder(null);
      }
    } catch (err) {
      console.error('[NotificationProvider] Failed to fetch active assignment:', err);
    }
  }, [courier]);

  const fetchHistory = useCallback(async () => {
    if (!courier) return;
    try {
      const results = await deliveryService.getNotifications();
      setNotifications(results || []);
      
      const count = await deliveryService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('[NotificationProvider] Error fetching history:', err);
    }
  }, [courier]);

  // Initial load
  useEffect(() => {
    if (courier) {
      fetchActiveAssignment();
      fetchHistory();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setCurrentIncomingOrder(null);
    }
  }, [courier, fetchActiveAssignment, fetchHistory]);

  // FCM Setup
  useEffect(() => {
    if (!courier) return;

    const setupFCM = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        if (isVapidPlaceholder || isConfigPlaceholder) return;

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          localStorage.setItem('fcm_token', token); // Cache for logout cleanup
          await apiClient.post('/delivery/push-token', {
            token,
            device_id: 'web',
            platform: 'web'
          });
        }
      } catch (err) {
        console.error('[FCM] Setup error:', err);
      }
    };

    setupFCM();

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[NotificationProvider] Foreground message:', payload);
      
      // Role filtering
      if (payload.data?.role !== 'delivery') return;

      const newNotif = {
        id: Date.now().toString(),
        title: payload.notification?.title,
        body: payload.notification?.body,
        data: payload.data,
        is_read: false,
        created_at: new Date().toISOString()
      };
      
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(prev => prev + 1);

      if (payload.data?.type === 'NEW_ASSIGNMENT') {
        fetchActiveAssignment();
      }
    });

    return () => unsubscribe();
  }, [courier, fetchActiveAssignment]);

  const acceptIncomingOrder = useCallback(async (assignmentId) => {
    try {
      await deliveryService.acceptOrder(assignmentId);
      setCurrentIncomingOrder(null);
    } catch (err) {
      console.error('[NotificationProvider] Accept error:', err);
      throw err;
    }
  }, []);

  const declineIncomingOrder = useCallback(async (assignmentId) => {
    try {
      await deliveryService.declineOrder(assignmentId);
      setCurrentIncomingOrder(null);
    } catch (err) {
      console.error('[NotificationProvider] Decline error:', err);
      throw err;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await deliveryService.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('[NotificationProvider] Read error:', err);
    }
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    currentIncomingOrder,
    acceptIncomingOrder,
    declineIncomingOrder,
    markAllAsRead,
    refreshAssignment: fetchActiveAssignment
  }), [notifications, unreadCount, currentIncomingOrder, acceptIncomingOrder, declineIncomingOrder, markAllAsRead, fetchActiveAssignment]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
