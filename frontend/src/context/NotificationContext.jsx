import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { messaging, getToken, onMessage, VAPID_KEY, isConfigPlaceholder, isVapidPlaceholder } from '../config/firebase';
import apiClient from '../services/apiClient';
import { deliveryService } from '../services/deliveryService';
import { useDeliveryAuthContext } from './DeliveryAuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { courier } = useDeliveryAuthContext();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentIncomingOrder, setCurrentIncomingOrder] = useState(null);

  // Fetch history from backend
  const fetchNotifications = useCallback(async () => {
    if (!courier) return;
    try {
      const results = await deliveryService.getNotifications();
      setNotifications(results || []);
      
      const count = await deliveryService.getUnreadCount();
      setUnreadCount(count);

      // Check for active assignments (PERSISTENCE)
      const assigned = await deliveryService.getAssignedOnly();
      if (assigned && assigned.length > 0) {
        // Only one active assignment rule
        setCurrentIncomingOrder(assigned[0]);
      } else {
        setCurrentIncomingOrder(null);
      }
    } catch (err) {
      console.error('[NotificationContext] Error fetching history:', err);
    }
  }, [courier]);

  // Initial setup for FCM
  useEffect(() => {
    if (!courier) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    const setupFCM = async () => {
      console.log('[FCM] Initializing Firebase Messaging...');
      try {
        const permission = await Notification.requestPermission();
        console.log('[FCM] Permission status:', permission);
        if (permission !== 'granted') return;

        // Verify VAPID Key and Firebase Config are not placeholders
        if (isVapidPlaceholder || isConfigPlaceholder) {
          const reason = isVapidPlaceholder ? 'VAPID_KEY' : 'firebaseConfig';
          console.warn(`[FCM] Setup aborted: Please set your actual ${reason} in config/firebase.js`);
          return;
        }

        console.log('[FCM] Generating Token...');
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          console.log('[FCM] Token Generated:', token);
          console.log('[FCM] Syncing token to backend...');
          
          await apiClient.post('/delivery/push-token', {
            token,
            device_id: 'web',
            platform: 'web'
          });
          console.log('[FCM] Token saved successfully');
        } else {
          console.warn('[FCM] No token received');
        }
      } catch (err) {
        console.error('[FCM] Setup error:', err);
      }
    };

    setupFCM();

    // Foreground listener
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[NotificationContext] Foreground message received:', payload);
      
      // ✅ CRITICAL: Role-based filtering
      if (payload.data?.role !== 'delivery') {
        return;
      }

      const newNotif = {
        id: Date.now().toString(), // fallback ID
        title: payload.notification.title,
        body: payload.notification.body,
        data: payload.data,
        is_read: false,
        created_at: new Date().toISOString()
      };
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Handle NEW_ASSIGNMENT logic
      if (payload.data?.type === 'NEW_ASSIGNMENT') {
        console.log('[NotificationContext] New assignment received, fetching details...');
        deliveryService.getAssignedOnly().then(assigned => {
          if (assigned && assigned.length > 0) {
            setCurrentIncomingOrder(assigned[0]);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [courier, fetchNotifications]);

  const acceptIncomingOrder = useCallback(async (assignmentId) => {
    try {
      await deliveryService.acceptOrder(assignmentId);
      setCurrentIncomingOrder(null);
      // Optional: trigging a refresh of active orders list if needed
    } catch (err) {
      console.error('[NotificationContext] Error accepting order:', err);
      throw err;
    }
  }, []);

  const declineIncomingOrder = useCallback(async (assignmentId) => {
    try {
      await deliveryService.declineOrder(assignmentId);
      setCurrentIncomingOrder(null);
    } catch (err) {
      console.error('[NotificationContext] Error declining order:', err);
      throw err;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await deliveryService.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('[NotificationContext] Error marking all as read:', err);
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      currentIncomingOrder,
      acceptIncomingOrder,
      declineIncomingOrder,
      markAllAsRead 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be within NotificationProvider');
  return ctx;
};
