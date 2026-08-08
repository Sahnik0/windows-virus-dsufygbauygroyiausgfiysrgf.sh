const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

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

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
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

// Global Error Handler
app.use(errorHandler);

module.exports = app;
