import { useContext } from 'react';
import { AdminNotificationContext } from '../context/AdminNotificationProvider';

export const useAdminNotifications = () => {
  const ctx = useContext(AdminNotificationContext);
  if (!ctx) throw new Error('useAdminNotifications must be used within AdminNotificationProvider');
  return ctx;
};
