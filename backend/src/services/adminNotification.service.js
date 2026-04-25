'use strict';

const admin = require('firebase-admin');
const { getSupabaseClient } = require('../config/db');
const { initFirebase } = require('../config/firebase');
const { logger } = require('../utils/logger');

/**
 * Service for handling Admin Notifications
 */

/**
 * Send withdrawal notification to all registered admins
 * @param {string} withdrawalId 
 * @param {string} shopName 
 * @param {number} amount 
 */
const sendWithdrawalNotification = async (withdrawalId, shopName, amount) => {
  try {
    initFirebase();
    const supabase = getSupabaseClient();

    // 1. Deduplication: Check if notification already exists for this withdrawal
    const { data: existing, error: fetchErr } = await supabase
      .from('admin_notifications')
      .select('id')
      .eq('type', 'WITHDRAWAL_REQUEST')
      .contains('data', { withdrawal_id: withdrawalId })
      .maybeSingle();

    if (fetchErr) {
      logger.error('[AdminNotification] Error checking existing notification:', fetchErr);
    }
    if (existing) {
      logger.info(`[AdminNotification] Notification for withdrawal ${withdrawalId} already exists. Skipping.`);
      return;
    }

    const title = 'New Withdrawal Request';
    const body = `${shopName} has requested a withdrawal of ₹${amount}`;
    const notificationData = {
      withdrawal_id: withdrawalId,
      shop_name: shopName,
      amount: String(amount),
      type: 'WITHDRAWAL_REQUEST'
    };

    // 2. Save to database
    const { error: insertErr } = await supabase
      .from('admin_notifications')
      .insert({
        title,
        body,
        type: 'WITHDRAWAL_REQUEST',
        data: notificationData,
        target_type: 'all'
      });

    if (insertErr) {
      logger.error('[AdminNotification] Error saving notification to DB:', insertErr);
    }

    // 3. Fetch all admin FCM tokens
    const { data: tokensData, error: tokenErr } = await supabase
      .from('admin_notification_tokens')
      .select('fcm_token');

    if (tokenErr) {
      logger.error('[AdminNotification] Error fetching admin tokens:', tokenErr);
      return;
    }

    const tokens = (tokensData || []).map(t => t.fcm_token).filter(Boolean);
    if (tokens.length === 0) {
      logger.warn(`[AdminNotification] No admin tokens found. Push notification skipped for withdrawal ${withdrawalId}`);
      return;
    }

    // 4. Send multicast notification
    const message = {
      tokens,
      notification: { title, body },
      data: {
        ...notificationData,
        role: 'admin'
      },
      android: { priority: 'high' }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`[AdminNotification] Multicast sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);

    // 5. Cleanup invalid tokens
    if (response.failureCount > 0) {
      const tokensToDelete = [];
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errorCode = res.error?.code;
          if (errorCode === 'messaging/registration-token-not-registered' || 
              errorCode === 'messaging/invalid-registration-token') {
            tokensToDelete.push(tokens[idx]);
          }
        }
      });

      if (tokensToDelete.length > 0) {
        await supabase
          .from('admin_notification_tokens')
          .delete()
          .in('fcm_token', tokensToDelete);
        logger.info(`[AdminNotification] Deleted ${tokensToDelete.length} invalid admin tokens`);
      }
    }
  } catch (err) {
    logger.error('[AdminNotification] Unexpected error in sendWithdrawalNotification:', err);
  }
};

/**
 * Get notifications for admin
 * @param {string} adminId 
 */
const getNotifications = async (adminId) => {
  const supabase = getSupabaseClient();
  
  // Fetch latest 20 notifications (either for all or for this specific admin)
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .or(`admin_id.eq."${adminId}",admin_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    logger.error('[AdminNotification] Error fetching notifications:', error);
    throw error;
  }

  // Get unread count
  const { count, error: countErr } = await supabase
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .or(`admin_id.eq."${adminId}",admin_id.is.null`)
    .eq('is_read', false);

  if (countErr) {
    logger.error('[AdminNotification] Error fetching unread count:', countErr);
  }

  return {
    notifications: data || [],
    unreadCount: count || 0
  };
};

/**
 * Mark a notification as read
 * @param {string} notificationId 
 * @param {string} adminId 
 */
const markAsRead = async (notificationId, adminId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('admin_notifications')
    .update({ 
      is_read: true, 
      read_at: new Date().toISOString() 
    })
    .eq('id', notificationId)
    .select()
    .single();

  if (error) {
    logger.error('[AdminNotification] Error marking notification as read:', error);
    throw error;
  }
  return data;
};

/**
 * Register/Update admin FCM token
 */
const registerToken = async ({ adminId, fcm_token, device_id, platform }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('admin_notification_tokens')
    .upsert({
      fcm_token,
      admin_id: adminId,
      device_id,
      platform,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    logger.error('[AdminNotification] Error registering token:', error);
    throw error;
  }
  return data;
};

/**
 * Remove admin FCM token
 */
const removeToken = async (fcm_token) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('admin_notification_tokens')
    .delete()
    .eq('fcm_token', fcm_token);

  if (error) {
    logger.error('[AdminNotification] Error removing token:', error);
    throw error;
  }
  return true;
};

module.exports = {
  sendWithdrawalNotification,
  getNotifications,
  markAsRead,
  registerToken,
  removeToken
};
