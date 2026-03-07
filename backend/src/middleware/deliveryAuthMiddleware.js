'use strict';

const createError = require('http-errors');
const { verifyToken } = require('../utils/jwtHelper');

/**
 * Validates a Bearer JWT token issued to a delivery partner.
 * Attaches the decoded payload to req.deliveryPartner.
 */
const deliveryAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError(401, 'Missing or invalid Authorization header'));
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyToken(token);
    if (decoded.role !== 'delivery') {
      return next(createError(403, 'Forbidden: delivery partner access required'));
    }
    req.deliveryPartner = decoded;
    return next();
  } catch {
    return next(createError(401, 'Invalid or expired token'));
  }
};

module.exports = { deliveryAuthMiddleware };
