/**
 * Global Error Handler Middleware
 */
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console/file
  logger.error(`${err.message} | ${req.method} ${req.originalUrl}`);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error.message = `Resource not found with id: ${err.value}`;
    return res.status(404).json({ success: false, message: error.message });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error.message = `Duplicate value for field: ${field}`;
    return res.status(400).json({ success: false, message: error.message });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File size exceeds 5MB limit' });
  }

  // Google API errors
  if (err.code === 401 || err.message === 'invalid_grant') {
    return res.status(401).json({
      success: false,
      message: 'Gmail session expired. Please disconnect and reconnect your Gmail account.',
      code: 'GMAIL_AUTH_EXPIRED'
    });
  }
  if (err.code === 403 || (err.errors && err.errors[0]?.reason === 'insufficientPermissions')) {
    return res.status(403).json({
      success: false,
      message: 'Gmail permissions are insufficient. Please disconnect and reconnect your Gmail account to grant the required permissions.',
      code: 'GMAIL_INSUFFICIENT_PERMISSIONS'
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
