'use strict';

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

/**
 * Sign a JWT token with the configured secret and expiry.
 * @param {object} payload - Data to embed in the token.
 * @returns {string} Signed JWT string.
 */
const signToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

/**
 * Verify and decode a JWT token.
 * Throws a JsonWebTokenError if the token is invalid or expired.
 * @param {string} token - Raw JWT string.
 * @returns {object} Decoded payload.
 */
const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);

module.exports = { signToken, verifyToken };
