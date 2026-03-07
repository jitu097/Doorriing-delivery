import { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { OrderStats } from '../../components/admin/OrderStats';
import { Loader } from '../../components/common/Loader';
import './AdminDashboard.css';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminService.getDashboard()
      .then(setStats)
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <Loader label="Loading dashboard..." />;

  if (error) {
    return (
      <div className="alert alert--error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {error}
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Dashboard Overview</h1>
        <p className="page-subtitle">Welcome back! Here&apos;s what&apos;s happening on the platform.</p>
      </div>
      {stats && <OrderStats stats={stats} />}
    </div>
  );
};
