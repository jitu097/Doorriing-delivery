const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { env } = require('./config/env');
const { initSupabase } = require('./config/db');
const adminRoutes    = require('./routes/adminRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const orderRoutes    = require('./routes/orderRoutes');
const shopRoutes     = require('./routes/shopRoutes');
const platformRoutes = require('./routes/platformRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { requestValidator } = require('./middleware/validateRequest');

initSupabase();

const app = express();

const allowedOrigins = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(o => o.trim()) : null;

app.use(helmet());
app.use(cors({ origin: allowedOrigins || true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/admin',    requestValidator('admin'), adminRoutes);
app.use('/api/delivery', requestValidator('delivery'), deliveryRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/shops',    shopRoutes);
app.use('/api/platform', platformRoutes); // public — no auth

app.use(errorHandler);

module.exports = app;
