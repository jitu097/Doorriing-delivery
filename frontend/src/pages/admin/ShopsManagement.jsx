import { useEffect, useState, useMemo } from 'react';
import { adminService } from '../../services/adminService';
import { ShopCard } from '../../components/admin/ShopCard';
import { Loader } from '../../components/common/Loader';
import './ShopsManagement.css';

export const ShopsManagement = () => {
  const [shops, setShops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    adminService.getShops()
      .then(setShops)
      .catch((err) => setError(err.message || 'Failed to load shops'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return shops;
    const q = search.toLowerCase();
    return shops.filter((s) =>
      s.shop_name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q)
    );
  }, [shops, search]);

  return (
    <div className="shops-page">
      <div className="page-header">
        <h1 className="page-title">Shops Management</h1>
        <span className="page-count">{shops.length} shops</span>
      </div>

      <div className="action-bar">
        <input
          className="form-input search-input"
          type="search"
          placeholder="Search by name or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {isLoading ? (
        <Loader label="Loading shops..." />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No shops found{search ? ` for "${search}"` : ''}.</p>
        </div>
      ) : (
        <div className="shops-grid">
          {filtered.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
};
