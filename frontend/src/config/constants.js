export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const ROUTES = {
  admin: {
    base: '/admin',
    dashboard: '/admin/dashboard',
    shops: '/admin/shops',
    shopDetails: (id) => `/admin/shops/${id}`,
    users: '/admin/users',
    orders: '/admin/orders',
    deliveryPartners: '/admin/delivery-partners',
    settings: '/admin/settings'
  },
  delivery: {
    base: '/delivery',
    dashboard: '/delivery/dashboard',
    assigned: '/delivery/assigned',
    active: '/delivery/active',
    history: '/delivery/history'
  },
  auth: {
    login: '/login'
  }
};
