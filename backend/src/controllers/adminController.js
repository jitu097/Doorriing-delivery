'use strict';

const { formatResponse } = require('../utils/responseFormatter');
const adminService = require('../services/adminService');
const cashService = require('../services/cash.service');
const { logger } = require('../utils/logger');

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

// GET /api/admin/shops/:shopId
const getShopById = async (req, res, next) => {
  try {
    const { shopId } = req.params;
    const shop = await adminService.getShopById(shopId);
    return res.json(formatResponse(shop));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/shops/:shopId/analytics
const getShopAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getShopAnalytics(req.params.shopId);
    return res.json(formatResponse(analytics));
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/shops/:shopId/orders
const getShopOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await adminService.getShopOrders(req.params.shopId, { page, limit });
    return res.json(formatResponse(result));
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

// PATCH /api/admin/users/:userId/block
const blockUser = async (req, res, next) => {
  try {
    const user = await adminService.setUserBlockStatus(req.params.userId, true);
    return res.json(formatResponse(user, 'User blocked successfully'));
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/users/:userId/unblock
const unblockUser = async (req, res, next) => {
  try {
    const user = await adminService.setUserBlockStatus(req.params.userId, false);
    return res.json(formatResponse(user, 'User unblocked successfully'));
  } catch (err) {
    return next(err);
  }
};

// kept for backward-compat (not used by any route)
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

// GET /api/admin/shops/:shopId/withdrawals
const getShopWithdrawals = async (req, res, next) => {
  try {
    const { shopId } = req.params;
    const data = await adminService.getShopWithdrawals(shopId);
    return res.json(formatResponse(data));
  } catch (err) {
    return next(err);
  }
};

// POST /api/admin/withdrawals/:withdrawId/approve
const approveWithdrawal = async (req, res, next) => {
  try {
    const { withdrawId } = req.params;
    logger.info(`Withdrawal approve request: id=${withdrawId} admin=${req.admin?.email}`);
    const data = await adminService.approveWithdrawal(withdrawId);
    return res.json(formatResponse(data, 'Withdrawal approved successfully'));
  } catch (err) {
    return next(err);
  }
};

// POST /api/admin/withdrawals/:withdrawId/reject
const rejectWithdrawal = async (req, res, next) => {
  try {
    const { withdrawId } = req.params;
    const { admin_note } = req.body;
    const data = await adminService.rejectWithdrawal(withdrawId, admin_note);
    return res.json(formatResponse(data, 'Withdrawal rejected'));
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

// GET /api/admin/delivery-partners/:id/cash
const getPartnerCash = async (req, res, next) => {
  try {
    const data = await cashService.getPartnerCash(req.params.id);
    return res.json(formatResponse(data));
  } catch (err) {
    return next(err);
  }
};

// POST /api/admin/delivery-partners/:id/settle-cash
const settleCash = async (req, res, next) => {
  try {
    const adminId = req.admin.id;
    const data = await cashService.settlePartnerCash(req.params.id, adminId);
    return res.json(formatResponse(data, 'Cash settled successfully'));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  login,
  getDashboardStats,
  getShops,
  getShopById,
  getShopAnalytics,
  getShopOrders,
  getShopStats,
  setShopBlockStatus,
  getUsers,
  blockUser,
  unblockUser,
  setUserBlockStatus,
  getOrderAnalytics,
  getDeliveryPartners,
  createDeliveryPartner,
  toggleDeliveryPartnerStatus,
  assignDeliveryPartner,
  getShopWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getPlatformSettings,
  updatePlatformSettings,
  getPartnerCash,
  settleCash,
  // Notifications
  getNotifications: async (req, res, next) => {
    try {
      const adminId = req.admin.id;
      const data = await require('../services/adminNotification.service').getNotifications(adminId);
      return res.json(formatResponse(data));
    } catch (err) {
      return next(err);
    }
  },
  markNotificationRead: async (req, res, next) => {
    try {
      const adminId = req.admin.id;
      const { id } = req.params;
      const data = await require('../services/adminNotification.service').markAsRead(id, adminId);
      return res.json(formatResponse(data, 'Notification marked as read'));
    } catch (err) {
      return next(err);
    }
  },
  registerPushToken: async (req, res, next) => {
    try {
      const adminId = req.admin.id;
      const { token, device_id, platform } = req.body;
      const data = await require('../services/adminNotification.service').registerToken({
        adminId,
        fcm_token: token,
        device_id,
        platform
      });
      return res.json(formatResponse(data, 'Push token registered'));
    } catch (err) {
      return next(err);
    }
  },
  removePushToken: async (req, res, next) => {
    try {
      const { token } = req.params;
      await require('../services/adminNotification.service').removeToken(token);
      return res.json(formatResponse(null, 'Push token removed'));
    } catch (err) {
      return next(err);
    }
  }
};
