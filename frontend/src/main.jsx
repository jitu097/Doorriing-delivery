import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { isJwtExpired } from './utils/jwt';
import './main.css';

// Clear any stale tokens from old bazarse.com sessions so they don't
// get sent as Authorization headers during login requests
if (localStorage.getItem('bz_admin_token')) {
  if (isJwtExpired(localStorage.getItem('bz_admin_token'))) {
    localStorage.removeItem('bz_admin_token');
  }
}
if (localStorage.getItem('bz_delivery_token')) {
  if (isJwtExpired(localStorage.getItem('bz_delivery_token'))) {
    localStorage.removeItem('bz_delivery_token');
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);