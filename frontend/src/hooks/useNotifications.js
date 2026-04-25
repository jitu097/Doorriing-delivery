import { useContext } from 'react';
import { NotificationContext } from '../context/NotificationProvider';

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  return ctx || {};
};
