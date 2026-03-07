'use strict';

const { formatResponse } = require('../utils/responseFormatter');
const orderService = require('../services/orderService');

// GET /api/admin/orders?status=&shopId=&page=&limit=
const listOrders = async (req, res, next) => {
  try {
    const { status, shopId, page = 1, limit = 20 } = req.query;
    const result = await orderService.getOrders({ status, shopId, page, limit });
    return res.json(formatResponse(result));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/orders/:orderId
const getOrder = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.orderId);
    return res.json(formatResponse(order));
  } catch (err) {
    return next(err);
  }
};

module.exports = { listOrders, getOrder };
