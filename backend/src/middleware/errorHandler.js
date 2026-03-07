const { formatError } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json(formatError(err.message, err.details || null));
};

module.exports = { errorHandler };
