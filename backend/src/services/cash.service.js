'use strict';

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');
const { logger } = require('../utils/logger');

/**
 * Adds a cash collection entry when a COD order is delivered.
 * @param {Object} order - The order object
 * @param {string} deliveryPartnerId - The ID of the delivery partner
 */
const addCashCollection = async (order, deliveryPartnerId) => {
  try {
    // 1. Safety check: Only process COD orders
    if (order.payment_method?.toUpperCase() !== 'COD') {
      return null;
    }

    const supabase = getSupabaseClient();

    // 2. Duplicate protection: Check if already processed
    const { data: existing, error: fetchError } = await supabase
      .from('cash_collections')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();

    if (fetchError) {
      logger.error('Error checking existing cash collection:', fetchError);
      return null;
    }

    if (existing) {
      logger.info(`Cash collection for order ${order.id} already exists. Skipping.`);
      return null;
    }

    // 3. Insert into cash_collections
    const { data: collection, error: insertError } = await supabase
      .from('cash_collections')
      .insert({
        order_id: order.id,
        delivery_partner_id: deliveryPartnerId,
        amount: order.total_amount,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      // If it's a unique constraint error (race condition), skip silently
      if (insertError.code === '23505') {
        logger.info(`Race condition: Cash collection for order ${order.id} already created.`);
        return null;
      }
      logger.error('Error creating cash collection:', insertError);
      throw insertError;
    }

    // 4. Update delivery_partner_wallet using RPC for atomicity
    // Expects: rpc('increment_wallet_cash', { partner_id, amount })
    const { error: rpcError } = await supabase.rpc('increment_wallet_cash', {
      partner_id: deliveryPartnerId,
      amount: order.total_amount
    });

    if (rpcError) {
      logger.error('Error updating partner wallet cash:', rpcError);
      // We don't throw here to avoid failing the whole order delivery flow, 
      // but we log it as a critical error.
    }

    return collection;
  } catch (err) {
    logger.error('Failed to add cash collection:', err);
    // Fail safely
    return null;
  }
};

/**
 * Fetches all cash entries for a specific delivery partner.
 * @param {string} deliveryPartnerId - The ID of the delivery partner
 */
const getPartnerCash = async (deliveryPartnerId) => {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('cash_collections')
    .select(`
      *,
      orders (
        id,
        status,
        created_at
      )
    `)
    .eq('delivery_partner_id', deliveryPartnerId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error fetching partner cash data:', error);
    throw createError(500, 'Could not fetch cash data');
  }

  return data;
};

/**
 * Settles all pending cash for a delivery partner.
 * @param {string} deliveryPartnerId - The ID of the delivery partner
 * @param {string} adminId - The ID of the admin performing the settlement
 */
const settlePartnerCash = async (deliveryPartnerId, adminId) => {
  const supabase = getSupabaseClient();

  // 1. Fetch all pending entries
  const { data: pendingEntries, error: fetchError } = await supabase
    .from('cash_collections')
    .select('id, amount')
    .eq('delivery_partner_id', deliveryPartnerId)
    .eq('status', 'pending');

  if (fetchError) {
    logger.error('Error fetching pending cash entries:', fetchError);
    throw createError(500, 'Could not fetch pending entries');
  }

  if (!pendingEntries || pendingEntries.length === 0) {
    throw createError(400, 'No pending cash to settle');
  }

  // 2. Calculate total amount
  const totalAmount = pendingEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);

  // 3. Perform atomic operations using a single request where possible or multiple calls
  // Ideally, use a stored procedure for full atomicity, but following the flow requested:
  
  // 3.1. Insert into cash_settlements
  const { data: settlement, error: settlementError } = await supabase
    .from('cash_settlements')
    .insert({
      delivery_partner_id: deliveryPartnerId,
      amount: totalAmount,
      admin_id: adminId
    })
    .select()
    .single();

  if (settlementError) {
    logger.error('Error creating cash settlement:', settlementError);
    throw createError(500, 'Could not create settlement record');
  }

  // 3.2. Update all entries to 'settled'
  const entryIds = pendingEntries.map(e => e.id);
  const { error: updateEntriesError } = await supabase
    .from('cash_collections')
    .update({ 
      status: 'settled',
      settled_at: new Date().toISOString()
    })
    .in('id', entryIds);

  if (updateEntriesError) {
    logger.error('Error updating cash collections to settled:', updateEntriesError);
    // Critical: settlement record created but entries not updated. 
    // In a real prod env, this should be a transaction.
    throw createError(500, 'Incomplete settlement: failed to update entries');
  }

  // 3.3. Reset wallet to 0
  // Note: We use update instead of RPC if we want to force to 0. 
  // If there's a race condition with a new delivery, resetting to 0 might be dangerous.
  // However, the prompt says "Reset wallet -> 0".
  const { error: resetError } = await supabase
    .from('delivery_partners')
    .update({ wallet_cash: 0 })
    .eq('id', deliveryPartnerId);

  if (resetError) {
    logger.error('Error resetting partner wallet cash:', resetError);
    // Log error but continue
  }

  return settlement;
};

module.exports = {
  addCashCollection,
  getPartnerCash,
  settlePartnerCash
};
