import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { ROUTES } from '../../config/constants';
import { Button } from '../../components/common/Button';
import './AdminLogin.css';

export const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    const ok = await login({ email, password });
    if (ok) navigate(ROUTES.admin.dashboard);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <div className="auth-card__logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <span className="auth-card__brand-name">Bazarse</span>
        </div>

        <h1 className="auth-card__title">Admin Portal</h1>
        <p className="auth-card__subtitle">Sign in to manage your platform</p>

        <div className="auth-demo-box">
          <p className="auth-demo-box__title">Test Credentials</p>
          <p><span>Email:</span> admin@bazarse.com</p>
          <p><span>Password:</span> Admin@123</p>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="admin@bazarse.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" size="lg" isLoading={isLoading} className="auth-btn">
            Sign In
          </Button>
        </form>

        <p className="auth-card__footer">
          Are you a delivery partner?{' '}
          <Link to={ROUTES.delivery.login} className="auth-link">Login here</Link>
        </p>
      </div>
    </div>
  );
};
