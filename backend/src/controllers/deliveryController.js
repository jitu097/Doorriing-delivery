'use strict';

const { formatResponse } = require('../utils/responseFormatter');
const deliveryService = require('../services/deliveryService');

// POST /api/delivery/login
const login = async (req, res, next) => {
  try {
    const result = await deliveryService.login(req.body);
    return res.json(formatResponse(result, 'Login successful'));
  } catch (err) {
    return next(err);
  }
};

// GET /api/delivery/orders
const getAssignedOrders = async (req, res, next) => {
  try {
    const orders = await deliveryService.getAssignedOrders(req.deliveryPartner.id);
    return res.json(formatResponse(orders));
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/delivery/assignments/:assignmentId/status  { status }
const updateAssignmentStatus = async (req, res, next) => {
  try {
    const updated = await deliveryService.updateAssignmentStatus(
      req.params.assignmentId,
      req.deliveryPartner.id,
      req.body.status
    );
    return res.json(formatResponse(updated, 'Delivery status updated'));
  } catch (err) {
    return next(err);
  }
};

// GET /api/delivery/history
const getDeliveryHistory = async (req, res, next) => {
  try {
    const history = await deliveryService.getDeliveryHistory(req.deliveryPartner.id);
    return res.json(formatResponse(history));
  } catch (err) {
    return next(err);
  }
};

module.exports = { login, getAssignedOrders, updateAssignmentStatus, getDeliveryHistory };
