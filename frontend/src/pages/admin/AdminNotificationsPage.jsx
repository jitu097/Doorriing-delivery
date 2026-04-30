import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import dayjs from 'dayjs';
import { Wallet, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminNotificationsPage = () => {
  const { notifications, isLoading, markAsRead } = useAdminNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (n) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.type === 'WITHDRAWAL_REQUEST') {
      const shopId = n.data?.shop_id;
      if (shopId) navigate(`/admin/shops/${shopId}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">Manage withdrawal requests and system alerts</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {notifications.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div 
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-5 flex items-start gap-4 transition-all cursor-pointer hover:bg-slate-50 group ${!n.is_read ? 'bg-indigo-50/20' : ''}`}
                >
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${n.type === 'WITHDRAWAL_REQUEST' ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-500'}`}>
                    <Wallet size={24} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`text-base ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {n.title}
                      </h3>
                      {n.created_at && dayjs(n.created_at).isValid() && (
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-4">
                          {dayjs(n.created_at).format('MMM D, h:mm A')}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 mt-1 text-sm leading-relaxed max-w-2xl">
                      {n.body}
                    </p>
                    
                    {!n.is_read && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(n.id);
                        }}
                        className="mt-3 flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg w-fit"
                      >
                        <CheckCircle2 size={14} />
                        Mark as read
                      </button>
                    )}
                  </div>

                  <div className="self-center text-slate-300 group-hover:text-slate-500 transition-colors">
                    <ChevronRight size={20} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-20 text-center">
              <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <Wallet size={32} />
              </div>
              <h3 className="text-slate-800 font-semibold">All caught up!</h3>
              <p className="text-slate-500 text-sm mt-1">No new notifications to show.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsPage;
