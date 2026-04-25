import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { router } from './router';
import './styles/global.css';
import './styles/dashboard.css';
import './App.css';

export const App = () => (
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>
);
