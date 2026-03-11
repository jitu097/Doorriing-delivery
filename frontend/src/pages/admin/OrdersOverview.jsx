import { useState, useMemo } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { Loader } from '../../components/common/Loader';
import './OrdersOverview.css';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];

export const OrdersOverview = () => {
  const { orders, isLoading, error } = useOrders();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchTab = activeTab === 'all' || o.status === activeTab;
      const matchSearch = !q ||
        o.id?.toLowerCase().includes(q) ||
        o.shops?.name?.toLowerCase().includes(q) ||
        o.customers?.full_name?.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [orders, activeTab, search]);

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1 className="page-title">Orders Overview</h1>
        <span className="page-count">{orders.length} total</span>
      </div>

      <div className="action-bar">
        <input
          className="form-input search-input"
          type="search"
          placeholder="Search by order ID, customer or shop…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            className={`filter-tab ${activeTab === tab ? 'filter-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? 'All' : tab.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {isLoading ? (
        <Loader label="Loading orders..." />
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>No orders found.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Shop</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td><code className="order-id">#{order.id?.slice(-8) ?? order.id}</code></td>
                  <td>{order.customers?.full_name || '—'}</td>
                  <td>{order.shops?.name || '—'}</td>
                  <td>{order.created_at ? formatDate(order.created_at, 'DD MMM YYYY') : '—'}</td>
                  <td>{formatCurrency(order.total_amount ?? 0)}</td>
                  <td>
                    <span className={`badge badge--${order.status}`}>
                      {order.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
