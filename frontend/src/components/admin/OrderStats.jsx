import { formatCurrency } from '../../utils/formatCurrency';
import './OrderStats.css';

const Stat = ({ label, value, icon, colorClass }) => (
  <div className="stat-card">
    <div className={`stat-card__icon ${colorClass}`}>
      {icon}
    </div>
    <div className="stat-card__body">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
    </div>
  </div>
);

export const OrderStats = ({ stats }) => (
  <div className="stat-grid">
    <Stat
      label="Orders Today"
      value={stats.totalOrdersToday ?? 0}
      colorClass="stat-card__icon--blue"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
      }
    />
    <Stat
      label="Revenue Today"
      value={formatCurrency(stats.revenueToday ?? 0)}
      colorClass="stat-card__icon--green"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      }
    />
    <Stat
      label="Pending Orders"
      value={stats.pendingOrders ?? 0}
      colorClass="stat-card__icon--amber"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      }
    />
    <Stat
      label="Active Shops"
      value={stats.activeShops ?? 0}
      colorClass="stat-card__icon--purple"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      }
    />
    <Stat
      label="Total Users"
      value={stats.totalUsers ?? 0}
      colorClass="stat-card__icon--indigo"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
      }
    />
    <Stat
      label="Delivery Partners"
      value={stats.activeDeliveryPartners ?? 0}
      colorClass="stat-card__icon--red"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/>
          <rect x="9" y="11" width="14" height="10" rx="2"/>
          <circle cx="12" cy="16" r="1"/>
          <circle cx="20" cy="16" r="1"/>
        </svg>
      }
    />
  </div>
);
