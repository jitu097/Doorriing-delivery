'use strict';

const { formatResponse } = require('../utils/responseFormatter');
const adminService = require('../services/adminService');

// POST /api/admin/login
const login = async (req, res, next) => {
  try {
    const result = await adminService.login(req.body);
    return res.json(formatResponse(result, 'Login successful'));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/dashboard
const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    return res.json(formatResponse(stats));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/shops
const getShops = async (req, res, next) => {
  try {
    const shops = await adminService.getShops();
    return res.json(formatResponse(shops));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/shops/:shopId/stats
const getShopStats = async (req, res, next) => {
  try {
    const stats = await adminService.getShopStats(req.params.shopId);
    return res.json(formatResponse(stats));
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/shops/:shopId/block  { is_blocked: boolean }
const setShopBlockStatus = async (req, res, next) => {
  try {
    const shop = await adminService.setShopBlockStatus(
      req.params.shopId,
      req.body.is_blocked
    );
    const action = req.body.is_blocked ? 'blocked' : 'unblocked';
    return res.json(formatResponse(shop, `Shop ${action} successfully`));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/users
const getUsers = async (req, res, next) => {
  try {
    const users = await adminService.getUsers();
    return res.json(formatResponse(users));
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/users/:userId/block  { is_blocked: boolean }
const setUserBlockStatus = async (req, res, next) => {
  try {
    const user = await adminService.setUserBlockStatus(
      req.params.userId,
      req.body.is_blocked
    );
    const action = req.body.is_blocked ? 'blocked' : 'unblocked';
    return res.json(formatResponse(user, `User ${action} successfully`));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/orders/analytics
const getOrderAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getOrderAnalytics();
    return res.json(formatResponse(analytics));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/delivery-partners
const getDeliveryPartners = async (req, res, next) => {
  try {
    const partners = await adminService.getDeliveryPartners();
    return res.json(formatResponse(partners));
  } catch (err) {
    return next(err);
  }
};

// POST /api/admin/delivery-partners
const createDeliveryPartner = async (req, res, next) => {
  try {
    const partner = await adminService.createDeliveryPartner(req.body);
    return res.status(201).json(formatResponse(partner, 'Delivery partner created successfully'));
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/delivery-partners/:partnerId/status  { is_active: boolean }
const toggleDeliveryPartnerStatus = async (req, res, next) => {
  try {
    const partner = await adminService.toggleDeliveryPartnerStatus(
      req.params.partnerId,
      req.body.is_active
    );
    const action = req.body.is_active ? 'activated' : 'deactivated';
    return res.json(formatResponse(partner, `Delivery partner ${action}`));
  } catch (err) {
    return next(err);
  }
};

// POST /api/admin/assignments  { order_id, delivery_partner_id }
const assignDeliveryPartner = async (req, res, next) => {
  try {
    const assignment = await adminService.assignDeliveryPartner(
      req.body.order_id,
      req.body.delivery_partner_id
    );
    return res.status(201).json(formatResponse(assignment, 'Delivery partner assigned successfully'));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/settings
const getPlatformSettings = async (req, res, next) => {
  try {
    const settings = await adminService.getPlatformSettings();
    return res.json(formatResponse(settings));
  } catch (err) {
    return next(err);
  }
};

// PUT /api/admin/settings
const updatePlatformSettings = async (req, res, next) => {
  try {
    const updated = await adminService.updatePlatformSettings(req.body);
    return res.json(formatResponse(updated, 'Platform settings updated'));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  login,
  getDashboardStats,
  getShops,
  getShopStats,
  setShopBlockStatus,
  getUsers,
  setUserBlockStatus,
  getOrderAnalytics,
  getDeliveryPartners,
  createDeliveryPartner,
  toggleDeliveryPartnerStatus,
  assignDeliveryPartner,
  getPlatformSettings,
  updatePlatformSettings
};
