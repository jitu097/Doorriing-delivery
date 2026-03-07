import { useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { Loader } from '../../components/common/Loader';
import './OrdersOverview.css';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];

export const OrdersOverview = () => {
  const { orders, isLoading } = useOrders();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = orders.filter((o) => {
    const matchTab = activeTab === 'all' || o.status === activeTab;
    const matchSearch = !search || o.id?.includes(search) || o.shop_name?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

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
          placeholder="Search by order ID or shop..."
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
                  <td>{order.shop_name || order.shop?.name || order.shopId || '—'}</td>
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
