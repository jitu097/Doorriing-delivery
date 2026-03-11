const { formatError } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    logger.error(`[${err.name || 'Error'}] ${err.message}`);
    if (err.stack) logger.error(err.stack);
  } else {
    logger.error(`[${status}] ${req.method} ${req.originalUrl} — ${err.message}`);
  }
  res.status(status).json(formatError(err.message, err.details || null));
};

module.exports = { errorHandler };
