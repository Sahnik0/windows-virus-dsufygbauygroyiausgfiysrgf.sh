// Global Express error handler middleware to intercept and format all unhandled errors
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('Unhandled Error:', err);

  // Use custom statusCode attached to error, or fallback to 500 Internal Server Error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    message,
    // Include stack trace only in development environment
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
