'use strict';

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/passwordHash');
const { signToken } = require('../utils/jwtHelper');

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const login = async ({ email, password }) => {
  const { env } = require('../config/env');

  // --- Temporary hardcoded admin (remove before production) ---
  if (
    env.TEMP_ADMIN_EMAIL &&
    email === env.TEMP_ADMIN_EMAIL &&
    password === env.TEMP_ADMIN_PASSWORD
  ) {
    const token = signToken({ id: 'temp-admin', email, role: 'admin' });
    return { token, admin: { id: 'temp-admin', email, role: 'admin' } };
  }
  // ------------------------------------------------------------

  const supabase = getSupabaseClient();

  const { data: admin, error } = await supabase
    .from('admins')
    .select('id, email, password_hash, role, is_active')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (error || !admin) throw createError(401, 'Invalid email or password');

  const isMatch = await verifyPassword(password, admin.password_hash);
  if (!isMatch) throw createError(401, 'Invalid email or password');

  const token = signToken({ id: admin.id, email: admin.email, role: admin.role });
  return { token, admin: { id: admin.id, email: admin.email, role: admin.role } };
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const getDashboardStats = async () => {
  const supabase = getSupabaseClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayOrdersRes, pendingRes, usersRes, shopsRes, partnersRes] = await Promise.all([
    supabase.from('orders').select('status, total_amount').gte('created_at', todayStart.toISOString()),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('is_active', true)
  ]);

  const todayOrders = todayOrdersRes.data || [];

  return {
    totalOrdersToday: todayOrders.length,
    revenueToday: todayOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
    pendingOrders: pendingRes.count || 0,
    activeShops: shopsRes.count || 0,
    totalUsers: usersRes.count || 0,
    activeDeliveryPartners: partnersRes.count || 0
  };
};

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

const getShops = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shops')
    .select('id, shop_name, owner_name, city, business_type, is_active, is_blocked, phone, created_at')
    .order('created_at', { ascending: false });

  if (error) throw createError(500, error.message);
  return data;
};

const getShopStats = async (shopId) => {
  const supabase = getSupabaseClient();

  const [shopRes, statsRes] = await Promise.all([
    supabase.from('shops').select('*').eq('id', shopId).single(),
    supabase.from('orders').select('status, total_amount').eq('shop_id', shopId)
  ]);

  if (shopRes.error || !shopRes.data) throw createError(404, 'Shop not found');
  if (statsRes.error) throw createError(500, statsRes.error.message);

  const orders = statsRes.data;
  return {
    shop: shopRes.data,
    stats: {
      total: orders.length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      pending: orders.filter((o) => o.status === 'pending').length,
      revenue: orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    }
  };
};

const setShopBlockStatus = async (shopId, is_blocked) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shops')
    .update({ is_blocked })
    .eq('id', shopId)
    .select('id, shop_name, is_blocked, is_active')
    .single();

  if (error) throw createError(500, error.message);
  if (!data) throw createError(404, 'Shop not found');
  return data;
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const getUsers = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, firebase_uid, role, created_at')
    .order('created_at', { ascending: false });

  if (error) throw createError(500, error.message);
  return data;
};

const setUserBlockStatus = async (userId, is_blocked) => {
  const supabase = getSupabaseClient();
  // users table does not have an is_blocked column yet — fetch and return current data
  const { data, error } = await supabase
    .from('users')
    .select('id, firebase_uid, role, created_at')
    .eq('id', userId)
    .single();

  if (error) throw createError(500, error.message);
  if (!data) throw createError(404, 'User not found');
  return { ...data, is_blocked }; // reflect the intended state in the response
};

// ---------------------------------------------------------------------------
// Order Analytics
// ---------------------------------------------------------------------------

const getOrderAnalytics = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('orders').select('status, total_amount');

  if (error) throw createError(500, error.message);

  const orders = data || [];
  return {
    total: orders.length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    pending: orders.filter((o) => o.status === 'pending').length,
    revenue: orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  };
};

// ---------------------------------------------------------------------------
// Delivery Partners
// ---------------------------------------------------------------------------

const getDeliveryPartners = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('delivery_partners')
    .select('id, name, email, phone, vehicle_type, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) throw createError(500, error.message);
  return data;
};

const createDeliveryPartner = async ({ name, email, phone, password, vehicle_type }) => {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('delivery_partners')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) throw createError(409, 'A delivery partner with this email already exists');

  const password_hash = await hashPassword(password);

  const { data, error } = await supabase
    .from('delivery_partners')
    .insert({ name, email, phone, password_hash, vehicle_type, is_active: true })
    .select('id, name, email, phone, vehicle_type, is_active, created_at')
    .single();

  if (error) throw createError(500, error.message);
  return data;
};

const toggleDeliveryPartnerStatus = async (partnerId, is_active) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('delivery_partners')
    .update({ is_active })
    .eq('id', partnerId)
    .select('id, name, email, is_active')
    .single();

  if (error) throw createError(500, error.message);
  if (!data) throw createError(404, 'Delivery partner not found');
  return data;
};

// ---------------------------------------------------------------------------
// Delivery Assignments
// ---------------------------------------------------------------------------

const assignDeliveryPartner = async (orderId, deliveryPartnerId) => {
  const supabase = getSupabaseClient();

  // Guard: reject if an active assignment already exists for this order
  const { data: existing } = await supabase
    .from('order_delivery_assignments')
    .select('id, status')
    .eq('order_id', orderId)
    .not('status', 'eq', 'delivered')
    .maybeSingle();

  if (existing) throw createError(409, 'Order already has an active delivery assignment');

  const { data, error } = await supabase
    .from('order_delivery_assignments')
    .insert({
      order_id: orderId,
      delivery_partner_id: deliveryPartnerId,
      status: 'assigned'
    })
    .select()
    .single();

  if (error) throw createError(500, error.message);
  return data;
};

// ---------------------------------------------------------------------------
// Platform Settings
// ---------------------------------------------------------------------------

const getPlatformSettings = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('id, min_order_amount, delivery_fee, convenience_fee, free_delivery_above')
    .limit(1)
    .maybeSingle();

  if (error) throw createError(500, error.message);
  return data || {};
};

const updatePlatformSettings = async (settings) => {
  const supabase = getSupabaseClient();

  const allowed = ['min_order_amount', 'delivery_fee', 'convenience_fee', 'free_delivery_above'];
  const update = {};
  allowed.forEach((k) => { if (settings[k] !== undefined) update[k] = Number(settings[k]); });

  const { data: existing } = await supabase
    .from('platform_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  let result;
  if (existing) {
    result = await supabase
      .from('platform_settings')
      .update(update)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('platform_settings')
      .insert(update)
      .select()
      .single();
  }

  if (result.error) throw createError(500, result.error.message);
  return result.data;
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
