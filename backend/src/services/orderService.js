'use strict';

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');

const getOrders = async ({ status, shopId, page = 1, limit = 20 } = {}) => {
  const supabase = getSupabaseClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('orders')
    .select('*, shops(id, shop_name, city)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  if (shopId) query = query.eq('shop_id', shopId);

  const { data, error, count } = await query;
  if (error) throw createError(500, error.message);

  return { orders: data, total: count, page: Number(page), limit: Number(limit) };
};

const getOrderById = async (orderId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, shops(id, shop_name, city), order_delivery_assignments(id, status, accepted_at, picked_up_at, delivered_at, delivery_partners!delivery_partner_id(id, name, phone))'
    )
    .eq('id', orderId)
    .single();

  if (error || !data) throw createError(404, 'Order not found');
  return data;
};

module.exports = { getOrders, getOrderById };
