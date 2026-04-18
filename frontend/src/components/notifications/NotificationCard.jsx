import React from 'react';
import { Package, Bell, Info } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const NotificationCard = ({ notification }) => {
  const isNewAssignment = notification.data?.type === 'NEW_ASSIGNMENT' || 
                         notification.title?.toLowerCase().includes('assigned');

  return (
    <div className={`notification-card ${!notification.is_read ? 'notification-card--unread' : ''}`}>
      <div className={`notification-card__icon ${isNewAssignment ? 'notification-card__icon--assignment' : ''}`}>
        {isNewAssignment ? <Package size={18} /> : <Bell size={18} />}
      </div>
      <div className="notification-card__content">
        <h4 className="notification-card__title">{notification.title}</h4>
        <p className="notification-card__body">{notification.body}</p>
        <span className="notification-card__time">
          {dayjs(notification.created_at).fromNow()}
        </span>
      </div>
    </div>
  );
};
