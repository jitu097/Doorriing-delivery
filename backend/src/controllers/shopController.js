'use strict';

const { formatResponse } = require('../utils/responseFormatter');
const shopService = require('../services/shopService');

// GET /api/shops
const listShops = async (req, res, next) => {
  try {
    const shops = await shopService.getShops();
    return res.json(formatResponse(shops));
  } catch (err) {
    return next(err);
  }
};

// GET /api/shops/:shopId
const getShop = async (req, res, next) => {
  try {
    const shop = await shopService.getShopById(req.params.shopId);
    return res.json(formatResponse(shop));
  } catch (err) {
    return next(err);
  }
};

module.exports = { listShops, getShop };
