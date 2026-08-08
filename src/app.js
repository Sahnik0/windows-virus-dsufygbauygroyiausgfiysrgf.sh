const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import modular API router definitions
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const orgsRoutes = require('./modules/orgs/orgs.routes');
const vehiclesRoutes = require('./modules/vehicles/vehicles.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const ridesRoutes = require('./modules/rides/rides.routes');
const tripsRoutes = require('./modules/trips/trips.routes');
const trackingRoutes = require('./modules/tracking/tracking.routes');
const chatRoutes = require('./modules/chat/chat.routes');
const walletRoutes = require('./modules/wallet/wallet.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Security headers with Helmet
app.use(helmet());

// Cross-Origin Resource Sharing (CORS) enabled for all origins
app.use(cors());

// Parse incoming JSON body and capture raw body buffer for Webhook HMAC verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Parse URL-encoded body data
app.use(express.urlencoded({ extended: true }));

// Log HTTP requests in development environment
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check route for Render load balancer health checks
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Mount module REST API endpoints under /api/v1 prefix
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/orgs', orgsRoutes);
app.use('/api/v1/vehicles', vehiclesRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/rides', ridesRoutes);
app.use('/api/v1/trips', tripsRoutes);
app.use('/api/v1/trips', trackingRoutes);
app.use('/api/v1/trips', chatRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/reports', reportsRoutes);

// Global centralized error handling middleware
app.use(errorHandler);

module.exports = app;
