'use strict';

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');
const { verifyPassword } = require('../utils/passwordHash');
const { signToken } = require('../utils/jwtHelper');
const cashService = require('./cash.service');

// Allowed status state-machine transitions (value = valid previous status/es)
const VALID_TRANSITIONS = {
  accepted: ['assigned'],
  picked_up: ['accepted', 'assigned'],  // skip accept: allow direct from assigned
  out_for_delivery: ['picked_up'],
  delivered: ['out_for_delivery'],
  rejected: ['assigned']
};

// Timestamp columns for each terminal transition
const TIMESTAMP_FIELDS = {
  accepted: 'accepted_at',
  picked_up: 'picked_up_at',
  delivered: 'delivered_at',
  rejected: 'rejected_at'
};

const login = async ({ email, password }) => {
  const { env } = require('../config/env');

  // --- Temporary hardcoded delivery partner (remove before production) ---
  const TEMP_ID = '00000000-0000-0000-0000-000000000000';
  if (
    env.TEMP_DELIVERY_EMAIL &&
    email === env.TEMP_DELIVERY_EMAIL &&
    password === env.TEMP_DELIVERY_PASSWORD
  ) {
    const token = signToken({ id: TEMP_ID, email, role: 'delivery' });
    return { token, partner: { id: TEMP_ID, name: 'Test Rider', email, role: 'delivery', delivery_status: 'online' } };
  }
  // -----------------------------------------------------------------------

  const supabase = getSupabaseClient();

  const { data: partner, error } = await supabase
    .from('delivery_partners')
    .select('id, name, email, phone, password_hash, vehicle_type, is_active, delivery_status')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (error || !partner) throw createError(401, 'Invalid email or password');

  const isMatch = await verifyPassword(password, partner.password_hash);
  if (!isMatch) throw createError(401, 'Invalid email or password');

  const token = signToken({ id: partner.id, email: partner.email, role: 'delivery' });
  return {
    token,
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      vehicle_type: partner.vehicle_type,
      delivery_status: partner.delivery_status || 'online'
    }
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getAssignedOrders = async (deliveryPartnerId) => {
  if (!UUID_RE.test(deliveryPartnerId)) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('order_delivery_assignments')
    .select(`
      id,
      order_id,
      status,
      assigned_at,
      accepted_at,
      picked_up_at,
      delivered_at,
      orders (
        id,
        total_amount,
        created_at,
        customer_notes,
        payment_method,
        payment_status,
        shops ( id, name, address, phone ),
        customers (
          id, full_name, phone,
          customer_addresses ( id, address_line_1, address_line_2, city, state, pincode, landmark, phone, is_default )
        ),
        order_items (
          quantity,
          items ( name, unit, base_quantity )
        )
      )
    `)
    .eq('delivery_partner_id', deliveryPartnerId)
    .in('status', ['assigned', 'accepted', 'picked_up', 'out_for_delivery'])
    .order('assigned_at', { ascending: false });

  if (error) throw createError(500, error.message);
  return data;
};

const updateOrderStatus = async (orderId, deliveryPartnerId, newStatus) => {
  const supabase = getSupabaseClient();

  const { data: assignment, error: fetchError } = await supabase
    .from('order_delivery_assignments')
    .select('id, status')
    .eq('order_id', orderId)
    .eq('delivery_partner_id', deliveryPartnerId)
    .in('status', ['assigned', 'accepted', 'picked_up', 'out_for_delivery'])
    .order('assigned_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !assignment) throw createError(404, 'Assignment not found');

  const requiredCurrentStatuses = VALID_TRANSITIONS[newStatus];
  if (!requiredCurrentStatuses) throw createError(422, `Unknown target status: ${newStatus}`);

  if (!requiredCurrentStatuses.includes(assignment.status)) {
    throw createError(
      422,
      `Cannot transition from "${assignment.status}" to "${newStatus}". Expected one of: ${requiredCurrentStatuses.join(', ')}.`
    );
  }

  const updatePayload = { status: newStatus };
  if (TIMESTAMP_FIELDS[newStatus]) {
    updatePayload[TIMESTAMP_FIELDS[newStatus]] = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('order_delivery_assignments')
    .update(updatePayload)
    .eq('id', assignment.id)
    .select()
    .single();

  if (error) throw createError(500, error.message);

  // Sync the orders table so admin/seller side reflects the current status
  const ORDER_STATUS_MAP = {
    picked_up:        'out_for_delivery',
    out_for_delivery: 'out_for_delivery',
    delivered:        'delivered',
  };
  if (ORDER_STATUS_MAP[newStatus]) {
    await supabase
      .from('orders')
      .update({ status: ORDER_STATUS_MAP[newStatus] })
      .eq('id', orderId);

    // If delivered, trigger cash collection tracking for COD orders
    if (newStatus === 'delivered') {
      try {
        // Fetch order details for cash collection logic
        const { data: order } = await supabase
          .from('orders')
          .select('id, payment_method, total_amount')
          .eq('id', orderId)
          .single();

        if (order) {
          await cashService.addCashCollection(order, deliveryPartnerId);
        }
      } catch (err) {
        // Log but don't fail the order delivery flow
        const { logger } = require('../utils/logger');
        logger.error(`[updateOrderStatus] Cash collection hook failed for order ${orderId}:`, err);
      }
    }
  }

  return data;
};

const updateAssignmentStatus = async (assignmentId, deliveryPartnerId, newStatus) => {
  const supabase = getSupabaseClient();

  // Fetch & verify ownership in one query
  const { data: assignment, error: fetchError } = await supabase
    .from('order_delivery_assignments')
    .select('id, status, delivery_partner_id')
    .eq('id', assignmentId)
    .eq('delivery_partner_id', deliveryPartnerId)
    .single();

  if (fetchError || !assignment) throw createError(404, 'Assignment not found');

  const requiredCurrentStatuses = VALID_TRANSITIONS[newStatus];
  if (!requiredCurrentStatuses) throw createError(422, `Unknown status: ${newStatus}`);

  if (!requiredCurrentStatuses.includes(assignment.status)) {
    throw createError(
      422,
      `Cannot transition from "${assignment.status}" to "${newStatus}". ` +
        `Expected one of: ${requiredCurrentStatuses.join(', ')}.`
    );
  }

  const updatePayload = { status: newStatus };
  if (TIMESTAMP_FIELDS[newStatus]) {
    updatePayload[TIMESTAMP_FIELDS[newStatus]] = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('order_delivery_assignments')
    .update(updatePayload)
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw createError(500, error.message);
  return data;
};

const getDeliveryHistory = async (deliveryPartnerId) => {
  if (!UUID_RE.test(deliveryPartnerId)) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('order_delivery_assignments')
    .select(`
      id,
      order_id,
      status,
      assigned_at,
      delivered_at,
      orders (
        id,
        total_amount,
        shops ( id, name )
      )
    `)
    .eq('delivery_partner_id', deliveryPartnerId)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false });

  if (error) throw createError(500, error.message);
  return data;
};

const getDeliveryProfile = async (deliveryPartnerId) => {
  if (!UUID_RE.test(deliveryPartnerId)) {
    throw createError(400, 'Invalid delivery partner ID');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('delivery_partners')
    .select('id, name, email, phone, vehicle_type, is_active, delivery_status')
    .eq('id', deliveryPartnerId)
    .single();

  if (error || !data) throw createError(404, 'Delivery partner not found');
  return data;
};

const updateDeliveryStatus = async (deliveryPartnerId, deliveryStatus) => {
  if (!UUID_RE.test(deliveryPartnerId)) {
    throw createError(400, 'Invalid delivery partner ID');
  }

  const validStatuses = ['online', 'offline'];
  if (!validStatuses.includes(deliveryStatus)) {
    throw createError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('delivery_partners')
    .update({ delivery_status: deliveryStatus })
    .eq('id', deliveryPartnerId)
    .select('id, name, email, delivery_status')
    .single();

  if (error || !data) throw createError(500, error?.message || 'Failed to update delivery status');
  return data;
};

const getNotifications = async (deliveryPartnerId) => {
  if (!UUID_RE.test(deliveryPartnerId)) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('delivery_notifications')
    .select('*')
    .eq('delivery_partner_id', deliveryPartnerId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw createError(500, error.message);
  return data;
};

const getUnreadCount = async (deliveryPartnerId) => {
  if (!UUID_RE.test(deliveryPartnerId)) return 0;
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('delivery_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('delivery_partner_id', deliveryPartnerId)
    .eq('is_read', false);
  if (error) throw createError(500, error.message);
  return count || 0;
};

const markAsRead = async (notificationId, deliveryPartnerId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('delivery_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('delivery_partner_id', deliveryPartnerId)
    .select()
    .single();
  if (error) throw createError(500, error.message);
  return data;
};

const markAllNotificationsAsRead = async (deliveryPartnerId) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('delivery_notifications')
    .update({ is_read: true })
    .eq('delivery_partner_id', deliveryPartnerId)
    .eq('is_read', false);
  if (error) throw createError(500, error.message);
  return true;
};

module.exports = {
  login,
  getAssignedOrders,
  updateAssignmentStatus,
  updateOrderStatus,
  getDeliveryHistory,
  getDeliveryProfile,
  updateDeliveryStatus,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllNotificationsAsRead
};
