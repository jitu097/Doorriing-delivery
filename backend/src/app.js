const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { env } = require('./config/env');
const { initSupabase } = require('./config/db');
const { initFirebase } = require('./config/firebase');
const adminRoutes    = require('./routes/adminRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const orderRoutes    = require('./routes/orderRoutes');
const shopRoutes     = require('./routes/shopRoutes');
const platformRoutes = require('./routes/platformRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { requestValidator } = require('./middleware/validateRequest');

initSupabase();
initFirebase();

const app = express();

const PRODUCTION_ORIGINS = [
  'https://delivery.doorriing.com',
];

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
];

// If CORS_ORIGINS is '*' or not set at all → allow every origin (open).
// Otherwise allow only the explicit comma-separated list.
const rawOrigins = (env.CORS_ORIGINS || '').trim();
const allowAll   = !rawOrigins || rawOrigins === '*';
const allowedOrigins = allowAll
  ? null
  : rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

// When Render env var is not configured yet, fall back to the known domains.
const effectiveOrigins = allowedOrigins || [...DEV_ORIGINS, ...PRODUCTION_ORIGINS];

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (effectiveOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.options('*', cors());
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
