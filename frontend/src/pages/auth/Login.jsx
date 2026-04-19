import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../config/constants';
import { Button } from '../../components/common/Button';
import './Login.css';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [genericError, setGenericError] = useState('');
  
  const { login, isLoading, error: authError, clearError: clearAuthError } = useAuth();
  
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearAuthError();
    setGenericError('');

    // First try admin login
    const adminRes = await login({ email, password, type: 'admin' });
    if (adminRes.success) {
      navigate(ROUTES.admin.dashboard);
      return;
    }
    
    // Admin failed, try delivery login
    const deliveryRes = await login({ email, password, type: 'delivery' });
    if (deliveryRes.success) {
      navigate(ROUTES.delivery.dashboard);
      return;
    }

    // Both failed
    setGenericError('Invalid credentials or account not found.');
  };

  const displayError = genericError || authError;

  return (
    <div className="auth-page auth-page--delivery">
      <div className="auth-card">
        <div className="auth-card__brand">
          <img src="/Doorriing.png" alt="Doorriing" className="auth-card__brand-logo" />
          <span className="auth-card__brand-name">Doorriing</span>
        </div>

        <h1 className="auth-card__title">Partner Portal</h1>
        <p className="auth-card__subtitle">Sign in to your account</p>

        <div className="auth-demo-boxes">
          <button
            type="button"
            className="auth-demo-box"
            onClick={() => { setEmail('admin@doorriing.com'); setPassword('Admin@123'); }}
          >
            <p className="auth-demo-box__title">Admin Test <span className="auth-demo-box__hint">click to fill</span></p>
            <p><span>Email:</span> admin@doorriing.com</p>
            <p><span>Password:</span> Admin@123</p>
          </button>
          <button
            type="button"
            className="auth-demo-box"
            onClick={() => { setEmail('delivery@doorriing.com'); setPassword('Delivery@123'); }}
          >
            <p className="auth-demo-box__title">Delivery Test <span className="auth-demo-box__hint">click to fill</span></p>
            <p><span>Email:</span> delivery@doorriing.com</p>
            <p><span>Password:</span> Delivery@123</p>
          </button>
        </div>

        {displayError && (
          <div className="alert alert--error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {displayError}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="name@doorriing.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
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
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" size="lg" isLoading={isLoading} className="auth-btn">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};
