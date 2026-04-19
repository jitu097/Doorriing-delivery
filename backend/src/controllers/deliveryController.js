const createError = require('http-errors');
const { formatResponse } = require('../utils/responseFormatter');
const deliveryService = require('../services/deliveryService');
const { getSupabaseClient } = require('../config/db');
const { logger } = require('../utils/logger');

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
    let assignments = await deliveryService.getAssignedOrders(req.deliveryPartner.id);
    
    // Filter by status if query provided (e.g., status=assigned)
    if (req.query.status) {
      assignments = assignments.filter(a => a.status === req.query.status);
    }
    
    // Transform to requested flat format
    const flattened = assignments.map(a => {
      const order = a.orders || {};
      const shop = order.shops || {};
      const customer = order.customers || {};
      const addressObj = customer.customer_addresses?.find(addr => addr.is_default) || customer.customer_addresses?.[0] || {};
      
      return {
        assignment_id: a.id,
        id: a.id, // Legacy compatibility for React keys
        order_id: a.order_id,
        shop_name: shop.name || 'N/A',
        address: addressObj.address_line_1 ? `${addressObj.address_line_1}, ${addressObj.city}` : 'N/A',
        total_price: Number(order.total_amount || 0),
        status: a.status,
        // Re-inject nested structures for compatibility with DeliveryOrderCard
        orders: order,
        raw_order: order 
      };
    });

    return res.json(formatResponse(flattened));
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

// POST /api/delivery/assignments/:assignmentId/accept
const acceptOrder = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    console.log("Accepting assignment:", assignmentId);
    const updated = await deliveryService.updateAssignmentStatus(
      assignmentId, req.deliveryPartner.id, 'accepted'
    );
    return res.json(formatResponse(updated, 'Order accepted'));
  } catch (err) {
    return next(err);
  }
};

// POST /api/delivery/assignments/:assignmentId/decline
const declineOrder = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    console.log("Declining assignment:", assignmentId);
    const updated = await deliveryService.updateAssignmentStatus(
      assignmentId, req.deliveryPartner.id, 'rejected'
    );
    return res.json(formatResponse(updated, 'Order declined'));
  } catch (err) {
    return next(err);
  }
};

// POST /api/delivery/orders/:orderId/picked-up
const pickedUp = async (req, res, next) => {
  try {
    const updated = await deliveryService.updateOrderStatus(
      req.params.orderId, req.deliveryPartner.id, 'picked_up'
    );
    return res.json(formatResponse(updated, 'Order picked up'));
  } catch (err) {
    return next(err);
  }
};

// POST /api/delivery/orders/:orderId/out-for-delivery
const outForDelivery = async (req, res, next) => {
  try {
    const updated = await deliveryService.updateOrderStatus(
      req.params.orderId, req.deliveryPartner.id, 'out_for_delivery'
    );
    return res.json(formatResponse(updated, 'Out for delivery'));
  } catch (err) {
    return next(err);
  }
};

// POST /api/delivery/orders/:orderId/delivered
const delivered = async (req, res, next) => {
  try {
    const updated = await deliveryService.updateOrderStatus(
      req.params.orderId, req.deliveryPartner.id, 'delivered'
    );
    return res.json(formatResponse(updated, 'Order delivered'));
  } catch (err) {
    return next(err);
  }
};

// POST /api/delivery/push-token
const saveDeliveryToken = async (req, res, next) => {
  try {
    const { token, device_id, platform } = req.body;
    const deliveryPartnerId = req.deliveryPartner.id;

    if (!token) throw createError(400, 'FCM token is required');

    const supabase = getSupabaseClient();

    // Upsert into delivery_notification_tokens
    // onConflict: fcm_token (ensure this unique constraint exists in DB)
    console.log("[push-token] Saving token:", token);
    const { data, error } = await supabase
      .from('delivery_notification_tokens')
      .upsert({
        fcm_token: token,
        delivery_partner_id: deliveryPartnerId,
        device_id: device_id || 'web',
        platform: platform || 'web',
        role: 'delivery',
        last_used_at: new Date()
      }, {
        onConflict: 'fcm_token'
      })
      .select()
      .single();

    if (error) {
      console.error("[push-token] Error:", error);
      throw error;
    }

    console.log("[push-token] Success:", data);
    return res.json({
      success: true,
      message: 'Push token saved successfully',
      data
    });
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/delivery/push-token
const deleteDeliveryToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) throw createError(400, 'FCM token is required');

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('delivery_notification_tokens')
      .delete()
      .eq('fcm_token', token)
      .eq('role', 'delivery'); // safety

    if (error) throw error;
    
    return res.json({ success: true, message: 'Push token deleted' });
  } catch (err) {
    return next(err);
  }
};

// GET /api/delivery/notifications
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await deliveryService.getNotifications(req.deliveryPartner.id);
    return res.json(formatResponse(notifications));
  } catch (err) {
    return next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await deliveryService.getUnreadCount(req.deliveryPartner.id);
    return res.json(formatResponse({ count }));
  } catch (err) {
    return next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const result = await deliveryService.markAsRead(req.params.id, req.deliveryPartner.id);
    return res.json(formatResponse(result, 'Notification marked as read'));
  } catch (err) {
    return next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    await deliveryService.markAllNotificationsAsRead(req.deliveryPartner.id);
    return res.json(formatResponse(null, 'All notifications marked as read'));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  login,
  getAssignedOrders,
  updateAssignmentStatus,
  getDeliveryHistory,
  acceptOrder,
  declineOrder,
  pickedUp,
  outForDelivery,
  delivered,
  saveDeliveryToken,
  deleteDeliveryToken,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
};
