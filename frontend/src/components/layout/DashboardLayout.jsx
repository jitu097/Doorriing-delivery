import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import './DashboardLayout.css';

export const DashboardLayout = ({ title, links, onLogout, user }) => (
  <div className="dashboard-layout">
    <Sidebar links={links} title={title} />
    <div className="dashboard-layout__main">
      <Navbar title={title} onLogout={onLogout} user={user} />
      <main className="dashboard-layout__content">
        <Outlet />
      </main>
    </div>
  </div>
);
