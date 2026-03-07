import { RouterProvider } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { DeliveryAuthProvider } from './context/DeliveryAuthContext';
import { router } from './router';
import './styles/global.css';
import './styles/dashboard.css';
import './App.css';

export const App = () => (
  <AdminAuthProvider>
    <DeliveryAuthProvider>
      <RouterProvider router={router} />
    </DeliveryAuthProvider>
  </AdminAuthProvider>
);
