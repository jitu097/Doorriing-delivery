import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './main.css';

// Clear any stale tokens from old bazarse.com sessions so they don't
// get sent as Authorization headers during login requests
if (localStorage.getItem('bz_admin_token')) {
  try {
    const p = JSON.parse(atob(localStorage.getItem('bz_admin_token').split('.')[1]));
    if (p.exp * 1000 <= Date.now()) localStorage.removeItem('bz_admin_token');
  } catch { localStorage.removeItem('bz_admin_token'); }
}
if (localStorage.getItem('bz_delivery_token')) {
  try {
    const p = JSON.parse(atob(localStorage.getItem('bz_delivery_token').split('.')[1]));
    if (p.exp * 1000 <= Date.now()) localStorage.removeItem('bz_delivery_token');
  } catch { localStorage.removeItem('bz_delivery_token'); }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
