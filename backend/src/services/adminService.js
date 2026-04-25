'use strict';

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/passwordHash');
const { signToken } = require('../utils/jwtHelper');
const { logger } = require('../utils/logger');
const { sendPushNotification } = require('./deliveryNotificationService');

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
    supabase.from('delivery_partners').select('id, wallet_cash').eq('is_active', true)
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
    activeDeliveryPartners: partnersRes.data?.length || 0,
    totalPendingCash: partnersRes.data?.reduce((sum, p) => sum + (Number(p.wallet_cash) || 0), 0) || 0
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

// GET /api/admin/shops/:shopId  — info only
const getShopById = async (shopId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shops')
    .select('id, shop_name, owner_name, city, business_type, is_active, is_blocked, phone, created_at')
    .eq('id', shopId)
    .single();

  if (error) {
    if (error.code === 'PGRST116' || error.code === '406') {
      throw createError(404, 'Shop not found');
    }
    logger.error(`[getShopById] DB error id="${shopId}": ${error.code} ${error.message}`);
    throw createError(500, `Database error: ${error.message}`);
  }
  if (!data) {
    throw createError(404, 'Shop not found');
  }
  return data;
};

// GET /api/admin/shops/:shopId/analytics
const ACTIVE_STATUSES = ['pending', 'confirmed', 'accepted', 'assigned', 'picked_up', 'out_for_delivery'];

const getShopAnalytics = async (shopId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select('status, total_amount')
    .eq('shop_id', shopId);

  if (error) throw createError(500, error.message);
  const orders = data || [];

  return {
    total_orders:     orders.length,
    active_orders:    orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    cancelled_orders: orders.filter((o) => o.status === 'cancelled').length,
    delivered_orders: orders.filter((o) => o.status === 'delivered').length,
    total_revenue:    orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  };
};

// GET /api/admin/shops/:shopId/orders  — paginated
const getShopOrders = async (shopId, { page = 1, limit = 20 } = {}) => {
  const supabase = getSupabaseClient();
  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  const { data, error, count } = await supabase
    .from('orders')
    .select('id, status, total_amount, created_at', { count: 'exact' })
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw createError(500, error.message);
  return { orders: data || [], total: count || 0, page: Number(page), limit: Number(limit) };
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
    .from('customers')
    .select('id, full_name, email, phone, created_at, is_blocked')
    .order('created_at', { ascending: false });

  if (error) throw createError(500, error.message);
  return data || [];
};

const setUserBlockStatus = async (userId, is_blocked) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('customers')
    .update({ is_blocked, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, full_name, email, phone, created_at, is_blocked')
    .single();

  if (error) {
    logger.error(`[setUserBlockStatus] error: ${error.code} ${error.message}`);
    throw createError(
      error.code === 'PGRST116' ? 404 : 500,
      error.code === 'PGRST116' ? 'User not found' : error.message
    );
  }
  if (!data) throw createError(404, 'User not found');
  return data;
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

  // Guard 2: reject if the delivery partner already has an active 'assigned' order
  const { data: partnerExisting } = await supabase
    .from('order_delivery_assignments')
    .select('id')
    .eq('delivery_partner_id', deliveryPartnerId)
    .eq('status', 'assigned')
    .maybeSingle();

  if (partnerExisting) {
    throw createError(409, 'Delivery partner already has an active assigned order. They must accept or decline before receiving another.');
  }

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

  // Trigger notification — wrapped in try/catch to not block core flow
  try {
    sendPushNotification(
      deliveryPartnerId,
      orderId,
      'New Delivery Assigned',
      `Order #${orderId} assigned to you`
    );
  } catch (err) {
    logger.error(`[assignDeliveryPartner] Notification hook failed:`, err);
  }

  return data;
};

// ---------------------------------------------------------------------------
// Withdrawal Requests
// ---------------------------------------------------------------------------

const getShopWithdrawals = async (shopId) => {
  const supabase = getSupabaseClient();

  // Fetch withdrawal requests and payout accounts in parallel
  const [{ data: requests, error }, { data: payoutAccounts }] = await Promise.all([
    supabase
      .from('seller_withdraw_requests')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false }),
    supabase
      .from('seller_payout_accounts')
      .select('id, type, upi_id, account_number, ifsc_code, bank_name, account_holder_name, contact_name, phone_number, is_default')
      .eq('shop_id', shopId)
  ]);

  if (error) {
    logger.error(`[getShopWithdrawals] DB error: ${error.code} ${error.message}`);
    throw createError(500, error.message);
  }

  const accounts = payoutAccounts || [];

  // Attach payout account details to each request so the admin sees where to transfer
  return (requests || []).map((req) => ({
    ...req,
    payout_account:
      accounts.find((a) => a.id === req.payout_account_id) ||
      accounts.find((a) => a.is_default) ||
      accounts[0] ||
      null
  }));
};

const approveWithdrawal = async (withdrawId) => {
  const supabase = getSupabaseClient();

  // 1. Load the request — must exist and be pending
  const { data: req, error: reqErr } = await supabase
    .from('seller_withdraw_requests')
    .select('*')
    .eq('id', withdrawId)
    .single();

  if (reqErr) {
    logger.error(`[approveWithdrawal] fetch error: ${reqErr.code} ${reqErr.message}`);
    throw createError(reqErr.code === 'PGRST116' ? 404 : 500,
      reqErr.code === 'PGRST116' ? 'Withdrawal request not found' : reqErr.message);
  }
  if (!req) throw createError(404, 'Withdrawal request not found');
  if (req.status !== 'pending') throw createError(409, `Request is already ${req.status}`);

  const { amount, shop_id, wallet_id } = req;
  logger.info(`[approveWithdrawal] Processing: id=${withdrawId} amount=${amount}`);

  // 2. Fetch current wallet by its primary key id
  const { data: wallet, error: walletErr } = await supabase
    .from('seller_wallets')
    .select('id, balance, total_withdrawn')
    .eq('id', wallet_id)
    .single();

  if (walletErr || !wallet) {
    logger.error(`[approveWithdrawal] wallet fetch failed: ${walletErr?.message}`);
    throw createError(500, walletErr?.message || 'Wallet not found');
  }

  const currentBalance   = Number(wallet.balance);
  const currentWithdrawn = Number(wallet.total_withdrawn) || 0;

  if (currentBalance < Number(amount)) {
    throw createError(422, `Insufficient wallet balance (available: ₹${currentBalance.toFixed(2)})`);
  }

  // 3. Deduct balance — update by primary key id (no upsert needed)
  const { error: deductErr } = await supabase
    .from('seller_wallets')
    .update({
      balance:          currentBalance - Number(amount),
      total_withdrawn:  currentWithdrawn + Number(amount),
      updated_at:       new Date().toISOString()
    })
    .eq('id', wallet_id);

  if (deductErr) {
    logger.error(`[approveWithdrawal] balance deduct failed: ${deductErr.message}`);
    throw createError(500, deductErr.message);
  }

  // 4. Insert debit transaction with correct columns
  const { error: txErr } = await supabase
    .from('seller_wallet_transactions')
    .insert({
      wallet_id,
      shop_id,
      type:                'withdrawal',
      amount,
      description:         `Withdrawal approved by admin`,
      withdraw_request_id: withdrawId
    });

  if (txErr) {
    logger.error(`[approveWithdrawal] transaction insert failed: ${txErr.message}`);
    throw createError(500, txErr.message);
  }

  // 5. Mark request as approved
  const { data: updated, error: updateErr } = await supabase
    .from('seller_withdraw_requests')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', withdrawId)
    .select('*')
    .single();

  if (updateErr) {
    logger.error(`[approveWithdrawal] status update failed: ${updateErr.message}`);
    throw createError(500, updateErr.message);
  }

  logger.info(`[approveWithdrawal] SUCCESS: withdrawal ${withdrawId} approved`);
  return updated;
};

const rejectWithdrawal = async (withdrawId, adminNote = '') => {
  const supabase = getSupabaseClient();

  const { data: req, error: reqErr } = await supabase
    .from('seller_withdraw_requests')
    .select('id, status')
    .eq('id', withdrawId)
    .single();

  if (reqErr) {
    throw createError(reqErr.code === 'PGRST116' ? 404 : 500,
      reqErr.code === 'PGRST116' ? 'Withdrawal request not found' : reqErr.message);
  }
  if (!req) throw createError(404, 'Withdrawal request not found');
  if (req.status !== 'pending') throw createError(409, `Request is already ${req.status}`);

  const { data: updated, error: updateErr } = await supabase
    .from('seller_withdraw_requests')
    .update({ status: 'rejected', admin_notes: adminNote || null, updated_at: new Date().toISOString() })
    .eq('id', withdrawId)
    .select('*')
    .single();

  if (updateErr) throw createError(500, updateErr.message);
  return updated;
};

// ---------------------------------------------------------------------------
// Platform Settings
// ---------------------------------------------------------------------------

const getPlatformSettings = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('id, min_order_amount, delivery_fee, convenience_fee, free_delivery_above, updated_at')
    .limit(1)
    .maybeSingle();

  if (error) throw createError(500, error.message);
  return data || {};
};

const updatePlatformSettings = async (settings) => {
  const supabase = getSupabaseClient();

  const allowed = ['min_order_amount', 'delivery_fee', 'convenience_fee', 'free_delivery_above'];
  const update = { updated_at: new Date().toISOString() };
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
  getShopById,
  getShopAnalytics,
  getShopOrders,
  getShopStats,
  setShopBlockStatus,
  getUsers,
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
  updatePlatformSettings
};
