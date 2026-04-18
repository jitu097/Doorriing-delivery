'use strict';

const admin = require('firebase-admin');
const { getSupabaseClient } = require('../config/db');
const { initFirebase } = require('../config/firebase');
const { logger } = require('../utils/logger');

/**
 * Service for handling delivery-related push notifications
 */
const sendPushNotification = async (deliveryPartnerId, orderId, title, body) => {
  try {
    // Ensure Firebase is initialized
    initFirebase();
    const supabase = getSupabaseClient();

    // 1. Fetch all FCM tokens for the delivery partner
    const { data: tokensData, error: tokenError } = await supabase
      .from('delivery_notification_tokens')
      .select('fcm_token')
      .eq('delivery_partner_id', deliveryPartnerId);

    if (tokenError) {
      logger.error(`[deliveryNotification] Error fetching tokens for partner ${deliveryPartnerId}:`, tokenError);
      return;
    }

    const tokens = (tokensData || []).map(t => t.fcm_token).filter(Boolean);
    logger.info(`[deliveryNotification] Fetched ${tokens.length} tokens for partner ${deliveryPartnerId}`);

    if (tokens.length === 0) {
      logger.warn(`[deliveryNotification] ⚠️ No FCM tokens found for partner ${deliveryPartnerId}. Delivery partner will not receive a push alert for Order #${orderId}.`);
      return;
    }

    // 2. Save notification to database
    const { error: insertError } = await supabase
      .from('delivery_notifications')
      .insert({
        delivery_partner_id: deliveryPartnerId,
        title,
        body,
        data: {
          order_id: String(orderId),
          type: 'NEW_ASSIGNMENT'
        }
      });

    if (insertError) {
      logger.error(`[deliveryNotification] Error saving notification to DB:`, insertError);
      // We continue to send push even if saving to DB fails
    } else {
      logger.info(`[deliveryNotification] Notification saved to DB for partner ${deliveryPartnerId}`);
    }

    // 3. Construct multicast payload (STRICT FOR KILLED STATE)
    const message = {
      tokens,
      notification: {
        title,
        body,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      data: {
        order_id: String(orderId),
        type: 'NEW_ASSIGNMENT',
        role: 'delivery'
      },
      android: {
        priority: 'high'
      }
    };

    // 4. Send multicast notification
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`[deliveryNotification] Multicast sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);

    // 5. Cleanup invalid tokens
    if (response.failureCount > 0) {
      const tokensToDelete = [];
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errorCode = res.error?.code;
          // Common codes for stale tokens:
          // 'messaging/registration-token-not-registered'
          // 'messaging/invalid-registration-token'
          if (errorCode === 'messaging/registration-token-not-registered' || 
              errorCode === 'messaging/invalid-registration-token') {
            tokensToDelete.push(tokens[idx]);
          }
          logger.warn(`[deliveryNotification] Token failure at index ${idx}: ${errorCode}`);
        }
      });

      if (tokensToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('delivery_notification_tokens')
          .delete()
          .in('fcm_token', tokensToDelete);

        if (deleteError) {
          logger.error(`[deliveryNotification] Error deleting invalid tokens:`, deleteError);
        } else {
          logger.info(`[deliveryNotification] Deleted ${tokensToDelete.length} invalid tokens`);
        }
      }
    }

  } catch (error) {
    logger.error(`[deliveryNotification] Unexpected error in service:`, error);
  }
};

module.exports = {
  sendPushNotification
};
