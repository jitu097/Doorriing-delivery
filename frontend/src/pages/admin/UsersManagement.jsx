import { useEffect, useState } from 'react';
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

  const filtered = users.filter((u) =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="users-page">
      <div className="page-header">
        <h1 className="page-title">Platform Users</h1>
        <span className="page-count">{users.length} users</span>
      </div>

      <div className="action-bar">
        <input
          className="form-input search-input"
          type="search"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {isLoading ? (
        <Loader label="Loading users..." />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No users found{search ? ` for "${search}"` : ''}.</p>
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
