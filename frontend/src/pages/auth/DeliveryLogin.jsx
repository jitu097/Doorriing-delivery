import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDeliveryAuth } from '../../hooks/useDeliveryAuth';
import { ROUTES } from '../../config/constants';
import { Button } from '../../components/common/Button';
import './DeliveryLogin.css';

export const DeliveryLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useDeliveryAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    const ok = await login({ email, password });
    if (ok) navigate(ROUTES.delivery.dashboard);
  };

  return (
    <div className="auth-page auth-page--delivery">
      <div className="auth-card">
        <div className="auth-card__brand">
          <div className="auth-card__logo auth-card__logo--teal">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/>
              <rect x="9" y="11" width="14" height="10" rx="2"/>
              <circle cx="12" cy="16" r="1"/>
              <circle cx="20" cy="16" r="1"/>
            </svg>
          </div>
          <span className="auth-card__brand-name">Bazarse</span>
        </div>

        <h1 className="auth-card__title">Delivery Portal</h1>
        <p className="auth-card__subtitle">Sign in to manage your deliveries</p>

        <div className="auth-demo-box">
          <p className="auth-demo-box__title">Test Credentials</p>
          <p><span>Email:</span> delivery@bazarse.com</p>
          <p><span>Password:</span> Delivery@123</p>
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
              placeholder="partner@bazarse.com"
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
          Are you an admin?{' '}
          <Link to={ROUTES.admin.login} className="auth-link">Login here</Link>
        </p>
      </div>
    </div>
  );
};
