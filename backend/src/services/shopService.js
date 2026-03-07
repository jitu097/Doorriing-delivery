'use strict';

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');

const getShops = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shops')
    .select('id, shop_name, owner_name, city, business_type, is_active, is_blocked, phone, created_at')
    .order('created_at', { ascending: false });

  if (error) throw createError(500, error.message);
  return data;
};

const getShopById = async (shopId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single();

  if (error || !data) throw createError(404, 'Shop not found');
  return data;
};

module.exports = { getShops, getShopById };
