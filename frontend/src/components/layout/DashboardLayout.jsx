import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { DeliveryBottomNav } from './DeliveryBottomNav';
import { useNotifications } from '../../hooks/useNotifications';
import { IncomingOrderCard } from '../delivery/IncomingOrderCard';
import './DashboardLayout.css';

export const DashboardLayout = ({ title, links, onLogout, user }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isDelivery = title === 'Delivery';
  
  // Directly use notifications hook - it will return null values if not a delivery context
  const { currentIncomingOrder, acceptIncomingOrder, declineIncomingOrder } = useNotifications();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleClose  = useCallback(() => setSidebarOpen(false), []);
  const handleToggle = useCallback(() => setSidebarOpen((v) => !v), []);

  return (
    <div className="dashboard-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={handleClose} />
      )}
      <Sidebar
        links={links}
        title={title}
        isOpen={sidebarOpen}
        onClose={handleClose}
      />
      <div className="dashboard-layout__main">
        <Navbar
          title={title}
          onLogout={onLogout}
          user={user}
          onMenuToggle={handleToggle}
        />
        <main className={`dashboard-layout__content${isDelivery ? ' dashboard-layout__content--delivery' : ''}`}>
          <Outlet />
        </main>
        {isDelivery && <DeliveryBottomNav links={links} />}
      </div>
      {isDelivery && currentIncomingOrder && (
        <IncomingOrderCard 
          order={currentIncomingOrder} 
          onAccept={acceptIncomingOrder} 
          onDecline={declineIncomingOrder}
        />
      )}
    </div>
  );
};
