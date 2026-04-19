import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { NotificationProvider } from './context/NotificationProvider';
import { OrderProvider } from './context/OrderProvider';
import { router } from './router';
import './styles/global.css';
import './styles/dashboard.css';
import './App.css';

export const App = () => (
  <AuthProvider>
    <NotificationProvider>
      <OrderProvider>
        <RouterProvider router={router} />
      </OrderProvider>
    </NotificationProvider>
  </AuthProvider>
);
