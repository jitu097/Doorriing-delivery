'use strict';

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');
const { verifyPassword } = require('../utils/passwordHash');
const { signToken } = require('../utils/jwtHelper');

// Allowed status state-machine transitions
const VALID_TRANSITIONS = {
  accepted: 'assigned',
  picked_up: 'accepted',
  out_for_delivery: 'picked_up',
  delivered: 'out_for_delivery'
};

// Timestamp columns for each terminal transition
const TIMESTAMP_FIELDS = {
  accepted: 'accepted_at',
  picked_up: 'picked_up_at',
  delivered: 'delivered_at'
};

const login = async ({ email, password }) => {
  const { env } = require('../config/env');

  // --- Temporary hardcoded delivery partner (remove before production) ---
  if (
    env.TEMP_DELIVERY_EMAIL &&
    email === env.TEMP_DELIVERY_EMAIL &&
    password === env.TEMP_DELIVERY_PASSWORD
  ) {
    const token = signToken({ id: 'temp-delivery', email, role: 'delivery' });
    return { token, partner: { id: 'temp-delivery', name: 'Test Rider', email, role: 'delivery' } };
  }
  // -----------------------------------------------------------------------

  const supabase = getSupabaseClient();

  const { data: partner, error } = await supabase
    .from('delivery_partners')
    .select('id, name, email, phone, password_hash, vehicle_type, is_active')
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
      vehicle_type: partner.vehicle_type
    }
  };
};

const getAssignedOrders = async (deliveryPartnerId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('order_delivery_assignments')
    .select('*, orders(*)')
    .eq('delivery_partner_id', deliveryPartnerId)
    .in('status', ['assigned', 'accepted', 'picked_up', 'out_for_delivery'])
    .order('created_at', { ascending: false });

  if (error) throw createError(500, error.message);
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

  const requiredCurrentStatus = VALID_TRANSITIONS[newStatus];
  if (!requiredCurrentStatus) throw createError(422, `Unknown status: ${newStatus}`);

  if (assignment.status !== requiredCurrentStatus) {
    throw createError(
      422,
      `Cannot transition from "${assignment.status}" to "${newStatus}". ` +
        `Expected current status: "${requiredCurrentStatus}".`
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
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('order_delivery_assignments')
    .select('*, orders(*)')
    .eq('delivery_partner_id', deliveryPartnerId)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false });

  if (error) throw createError(500, error.message);
  return data;
};

module.exports = { login, getAssignedOrders, updateAssignmentStatus, getDeliveryHistory };
