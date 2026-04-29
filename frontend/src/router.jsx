import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Loader } from './components/common/Loader';
import { ROUTES } from './config/constants';
import { useAuth } from './hooks/useAuth';
import { NotificationProvider } from './context/NotificationProvider';
import { AdminNotificationProvider } from './context/AdminNotificationProvider';
import { OrderProvider } from './context/OrderProvider';
import './router.css';

// Lazy-loaded admin pages
const AdminDashboard   = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const ShopsManagement  = lazy(() => import('./pages/admin/ShopsManagement').then((m) => ({ default: m.ShopsManagement })));
const AdminShopDetails = lazy(() => import('./pages/admin/AdminShopDetails').then((m) => ({ default: m.AdminShopDetails })));
const UsersManagement  = lazy(() => import('./pages/admin/UsersManagement').then((m) => ({ default: m.UsersManagement })));
const OrdersOverview   = lazy(() => import('./pages/admin/OrdersOverview').then((m) => ({ default: m.OrdersOverview })));
const DeliveryPartners = lazy(() => import('./pages/admin/DeliveryPartners').then((m) => ({ default: m.DeliveryPartners })));
const PartnerCashDetails = lazy(() => import('./pages/admin/PartnerCashDetails').then((m) => ({ default: m.PartnerCashDetails })));
const PlatformSettings = lazy(() => import('./pages/admin/PlatformSettings').then((m) => ({ default: m.PlatformSettings })));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotificationsPage'));

// Lazy-loaded delivery pages
const DeliveryDashboard = lazy(() => import('./pages/delivery/DeliveryDashboard').then((m) => ({ default: m.DeliveryDashboard })));
const AssignedOrders    = lazy(() => import('./pages/delivery/AssignedOrders').then((m) => ({ default: m.AssignedOrders })));
const ActiveDeliveries  = lazy(() => import('./pages/delivery/ActiveDeliveries').then((m) => ({ default: m.ActiveDeliveries })));
const DeliveryHistory   = lazy(() => import('./pages/delivery/DeliveryHistory').then((m) => ({ default: m.DeliveryHistory })));

// Lazy-loaded auth
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));

const PageLoader = () => <Loader label="Loading..." />;

const adminLinks = [
  { to: ROUTES.admin.dashboard,         label: 'Dashboard' },
  { to: ROUTES.admin.shops,             label: 'Shops' },
  { to: ROUTES.admin.users,             label: 'Users' },
  { to: ROUTES.admin.orders,            label: 'Orders' },
  { to: ROUTES.admin.deliveryPartners,  label: 'Delivery Partners' },
  { to: ROUTES.admin.settings,          label: 'Platform Settings' }
];

const deliveryLinks = [
  { to: ROUTES.delivery.dashboard, label: 'Overview' },
  { to: ROUTES.delivery.assigned,  label: 'Assigned' },
  { to: ROUTES.delivery.history,   label: 'History' }
];

const AdminRoute = () => {
  const { adminUser, logout, isLoading } = useAuth();
  
  if (isLoading) return <PageLoader />;
  if (!adminUser) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AdminNotificationProvider>
      <OrderProvider>
        <DashboardLayout title="Admin" links={adminLinks} onLogout={logout} user={adminUser} />
      </OrderProvider>
    </AdminNotificationProvider>
  );
};

const DeliveryRoute = () => {
  const { courier, logout, isLoading } = useAuth();
  
  if (isLoading) return <PageLoader />;
  if (!courier) {
    return <Navigate to="/login" replace />;
  }
  return (
    <NotificationProvider>
      <OrderProvider>
        <DashboardLayout title="Delivery" links={deliveryLinks} onLogout={logout} user={courier} />
      </OrderProvider>
    </NotificationProvider>
  );
};

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    )
  },
  {
    path: '/admin',
    element: <AdminRoute />,
    children: [
      { index: true, element: <Navigate to={ROUTES.admin.dashboard} replace /> },
      { path: 'dashboard',          element: <Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense> },
      { path: 'shops',              element: <Suspense fallback={<PageLoader />}><ShopsManagement /></Suspense> },
      { path: 'shops/:shopId',      element: <Suspense fallback={<PageLoader />}><AdminShopDetails /></Suspense> },
      { path: 'users',              element: <Suspense fallback={<PageLoader />}><UsersManagement /></Suspense> },
      { path: 'orders',             element: <Suspense fallback={<PageLoader />}><OrdersOverview /></Suspense> },
      { path: 'delivery-partners',      element: <Suspense fallback={<PageLoader />}><DeliveryPartners /></Suspense> },
      { path: 'delivery-partners/:id/cash', element: <Suspense fallback={<PageLoader />}><PartnerCashDetails /></Suspense> },
      { path: 'settings',               element: <Suspense fallback={<PageLoader />}><PlatformSettings /></Suspense> },
      { path: 'notifications',          element: <Suspense fallback={<PageLoader />}><AdminNotifications /></Suspense> }
    ]
  },
  {
    path: '/delivery',
    element: <DeliveryRoute />,
    children: [
      { index: true, element: <Navigate to={ROUTES.delivery.assigned} replace /> },
      { path: 'dashboard', element: <Suspense fallback={<PageLoader />}><DeliveryDashboard /></Suspense> },
      { path: 'assigned',  element: <Suspense fallback={<PageLoader />}><AssignedOrders /></Suspense> },
      { path: 'active',    element: <Suspense fallback={<PageLoader />}><ActiveDeliveries /></Suspense> },
      { path: 'history',   element: <Suspense fallback={<PageLoader />}><DeliveryHistory /></Suspense> }
    ]
  }
]);
