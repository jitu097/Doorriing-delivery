import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { messaging, getToken, onMessage, VAPID_KEY, isConfigPlaceholder, isVapidPlaceholder } from '../config/firebase';
import { adminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';

export const AdminNotificationContext = createContext(null);

export const AdminNotificationProvider = ({ children }) => {
  const { adminUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!adminUser) return;
    setIsLoading(true);
    try {
      const data = await adminService.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('[AdminNotificationProvider] Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [adminUser]);

  // Initial load
  useEffect(() => {
    if (adminUser) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [adminUser, fetchNotifications]);

  // Polling fallback
  useEffect(() => {
    if (!adminUser) return;
    const intervalId = setInterval(() => {
      fetchNotifications();
    }, 10000); // 10 seconds
    return () => clearInterval(intervalId);
  }, [adminUser, fetchNotifications]);

  // FCM Setup for Admin
  useEffect(() => {
    if (!adminUser) return;

    const setupFCM = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        if (isVapidPlaceholder || isConfigPlaceholder) return;

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          localStorage.setItem('admin_fcm_token', token);
          await adminService.registerPushToken({
            token,
            device_id: 'web',
            platform: 'web'
          });
        }
      } catch (err) {
        console.error('[AdminFCM] Setup error:', err);
      }
    };

    setupFCM();

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[AdminNotificationProvider] Foreground message:', payload);
      
      // Role filtering: Only process if it's for an admin
      if (payload.data?.role !== 'admin') return;

      // Update state in real-time
      const newNotif = {
        id: Date.now().toString(), // Temp ID for immediate display
        title: payload.notification?.title,
        body: payload.notification?.body,
        data: payload.data,
        is_read: false,
        created_at: new Date().toISOString()
      };
      
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => unsubscribe();
  }, [adminUser]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await adminService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[AdminNotificationProvider] Mark as read error:', err);
    }
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    refreshNotifications: fetchNotifications
  }), [notifications, unreadCount, isLoading, markAsRead, fetchNotifications]);

  return (
    <AdminNotificationContext.Provider value={value}>
      {children}
    </AdminNotificationContext.Provider>
  );
};
