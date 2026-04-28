'use strict';

const Joi = require('joi');
const createError = require('http-errors');

// ---------------------------------------------------------------------------
// Joi schemas — one entry per route that needs request-body validation
// ---------------------------------------------------------------------------
const schemas = {
  adminLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  deliveryLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  createDeliveryPartner: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    password: Joi.string().min(6).required(),
    vehicle_type: Joi.string().valid('bike', 'scooter', 'car', 'cycle').required()
  }),

  assignDelivery: Joi.object({
    order_id: Joi.string().uuid().required(),
    delivery_partner_id: Joi.string().uuid().required()
  }),

  updateAssignmentStatus: Joi.object({
    status: Joi.string()
      .valid('accepted', 'picked_up', 'out_for_delivery', 'delivered')
      .required()
  }),

  updateDeliveryStatus: Joi.object({
    delivery_status: Joi.string()
      .valid('online', 'offline')
      .required()
  }),

  updatePlatformSettings: Joi.object({
    min_order_amount:   Joi.number().min(0).optional(),
    delivery_fee:       Joi.number().min(0).optional(),
    convenience_fee:    Joi.number().min(0).optional(),
    free_delivery_above: Joi.number().min(0).optional()
  }).min(1),

  setBlockStatus: Joi.object({
    is_blocked: Joi.boolean().required()
  }),

  setActiveStatus: Joi.object({
    is_active: Joi.boolean().required()
  }),

  rejectWithdrawal: Joi.object({
    admin_note: Joi.string().max(500).allow('', null).optional()
  }),

  saveDeliveryToken: Joi.object({
    token: Joi.string().required(),
    device_id: Joi.string().required(),
    platform: Joi.string().valid('android', 'ios', 'web').required()
  })
};

/**
 * Returns middleware that validates req.body against the named Joi schema.
 * Responds 422 with an array of validation messages on failure.
 */
const validateBody = (schemaName) => (req, res, next) => {
  const schema = schemas[schemaName];
  if (!schema) return next();

  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const details = error.details.map((d) => d.message);
    const err = createError(422, 'Validation failed');
    err.details = details;
    return next(err);
  }
  return next();
};

// Kept for backwards-compatibility with app.js — acts as a passthrough
const requestValidator = () => (req, res, next) => next();

module.exports = { validateBody, requestValidator };
