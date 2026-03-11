import { useEffect, useState, useMemo } from 'react';
import { adminService } from '../../services/adminService';
import { UserCard } from '../../components/admin/UserCard';
import { Loader } from '../../components/common/Loader';
import './UsersManagement.css';

export const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    adminService.getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message || 'Failed to load users'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email     || '').toLowerCase().includes(q) ||
      (u.phone     || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const blockedCount = useMemo(() => users.filter((u) => u.is_blocked).length, [users]);

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Users</h1>
          <p className="page-subtitle">
            {users.length} total &nbsp;&bull;&nbsp; {blockedCount} blocked
          </p>
        </div>
      </div>

      <div className="action-bar">
        <input
          className="form-input search-input"
          type="search"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {isLoading ? (
        <Loader label="Loading users…" />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No users found{search ? ` for “${search}”` : ''}.</p>
        </div>
      ) : (
        <div className="users-list">
          {filtered.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
};
