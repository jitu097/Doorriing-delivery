import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ShopsManagement } from './pages/admin/ShopsManagement';
import { UsersManagement } from './pages/admin/UsersManagement';
import { OrdersOverview } from './pages/admin/OrdersOverview';
import { DeliveryPartners } from './pages/admin/DeliveryPartners';
import { PlatformSettings } from './pages/admin/PlatformSettings';
import { AdminLogin } from './pages/auth/AdminLogin';
import { DeliveryLogin } from './pages/auth/DeliveryLogin';
import { DeliveryDashboard } from './pages/delivery/DeliveryDashboard';
import { AssignedOrders } from './pages/delivery/AssignedOrders';
import { ActiveDeliveries } from './pages/delivery/ActiveDeliveries';
import { DeliveryHistory } from './pages/delivery/DeliveryHistory';
import { ROUTES } from './config/constants';
import { useAdminAuth } from './hooks/useAdminAuth';
import { useDeliveryAuth } from './hooks/useDeliveryAuth';
import './router.css';

const adminLinks = [
  { to: ROUTES.admin.dashboard,         label: 'Dashboard' },
  { to: ROUTES.admin.shops,             label: 'Shops' },
  { to: ROUTES.admin.users,             label: 'Users' },
  { to: ROUTES.admin.orders,            label: 'Orders' },
  { to: ROUTES.admin.deliveryPartners,  label: 'Delivery Partners' },
  { to: ROUTES.admin.settings,          label: 'Settings' }
];

const deliveryLinks = [
  { to: ROUTES.delivery.dashboard, label: 'Overview' },
  { to: ROUTES.delivery.assigned,  label: 'Assigned' },
  { to: ROUTES.delivery.active,    label: 'Active' },
  { to: ROUTES.delivery.history,   label: 'History' }
];

const AdminRoute = () => {
  const { adminUser, logout } = useAdminAuth();
  if (!adminUser) {
    return <Navigate to="/admin/login" replace />;
  }
  return <DashboardLayout title="Admin" links={adminLinks} onLogout={logout} user={adminUser} />;
};

const DeliveryRoute = () => {
  const { courier, logout } = useDeliveryAuth();
  if (!courier) {
    return <Navigate to="/delivery/login" replace />;
  }
  return <DashboardLayout title="Delivery" links={deliveryLinks} onLogout={logout} user={courier} />;
};

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin/login" replace /> },
  { path: '/admin/login', element: <AdminLogin /> },
  { path: '/delivery/login', element: <DeliveryLogin /> },
  {
    path: '/admin',
    element: <AdminRoute />,
    children: [
      { index: true, element: <Navigate to={ROUTES.admin.dashboard} replace /> },
      { path: 'dashboard', element: <AdminDashboard /> },
      { path: 'shops', element: <ShopsManagement /> },
      { path: 'users', element: <UsersManagement /> },
      { path: 'orders', element: <OrdersOverview /> },
      { path: 'delivery-partners', element: <DeliveryPartners /> },
      { path: 'settings', element: <PlatformSettings /> }
    ]
  },
  {
    path: '/delivery',
    element: <DeliveryRoute />,
    children: [
      { index: true, element: <Navigate to={ROUTES.delivery.dashboard} replace /> },
      { path: 'dashboard', element: <DeliveryDashboard /> },
      { path: 'assigned', element: <AssignedOrders /> },
      { path: 'active', element: <ActiveDeliveries /> },
      { path: 'history', element: <DeliveryHistory /> }
    ]
  }
]);
