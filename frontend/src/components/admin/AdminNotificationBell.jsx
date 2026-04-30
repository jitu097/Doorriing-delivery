import { useState, useRef, useEffect } from 'react';
import { Bell, Wallet } from 'lucide-react';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router-dom';

dayjs.extend(relativeTime);

export const AdminNotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead } = useAdminNotifications();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const toggleDropdown = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (n) => {
    if (!n.is_read) markAsRead(n.id);
    setIsOpen(false);
    
    // Navigate based on type
    if (n.type === 'WITHDRAWAL_REQUEST') {
      const shopId = n.data?.shop_id;
      if (shopId) navigate(`/admin/shops/${shopId}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative"
        onClick={toggleDropdown}
      >
        <Bell size={24} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed top-[64px] left-1/2 -translate-x-1/2 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:-translate-x-0 mt-2 w-[calc(100vw-32px)] sm:w-80 max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">Admin Alerts</h3>
            <button 
              onClick={() => navigate('/admin/notifications')}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div 
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-4 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 flex gap-3 ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${n.type === 'WITHDRAWAL_REQUEST' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                    <Wallet size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {n.body}
                    </p>
                    {n.created_at && dayjs(n.created_at).isValid() && (
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">
                        {dayjs(n.created_at).fromNow()}
                      </p>
                    )}
                  </div>
                  {!n.is_read && (
                    <div className="h-2 w-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                  )}
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-slate-400 text-sm">
                No notifications yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
