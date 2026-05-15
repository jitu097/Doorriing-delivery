'use strict';

const admin = require('firebase-admin');
const { getSupabaseClient } = require('../config/db');
const { initFirebase } = require('../config/firebase');
const { logger } = require('../utils/logger');

/**
 * Send a native FCM push notification to all registered devices of a delivery partner.
 *
 * @param {string} deliveryPartnerId  - UUID of the delivery partner
 * @param {string} orderId            - UUID of the order
 * @param {string} title              - Notification title
 * @param {string} body               - Notification body text
 */
const sendPushNotification = async (deliveryPartnerId, orderId, title, body) => {
  try {
    // Ensure Firebase Admin SDK is initialised (safe to call multiple times)
    initFirebase();
    const supabase = getSupabaseClient();

    // -----------------------------------------------------------------------
    // 1. Fetch all FCM tokens registered for this delivery partner
    // -----------------------------------------------------------------------
    const { data: tokensData, error: tokenError } = await supabase
      .from('delivery_notification_tokens')
      .select('fcm_token')
      .eq('delivery_partner_id', deliveryPartnerId)
      .eq('role', 'delivery');

    if (tokenError) {
      logger.error(`[FCM] Error fetching tokens for partner ${deliveryPartnerId}:`, tokenError);
      return;
    }

    const tokens = (tokensData || []).map(t => t.fcm_token).filter(Boolean);
    logger.info(`[FCM] Found ${tokens.length} token(s) for partner ${deliveryPartnerId}`);

    if (tokens.length === 0) {
      logger.warn(
        `[FCM] ⚠️  No FCM tokens for partner ${deliveryPartnerId}. ` +
        `Order #${orderId} push notification SKIPPED. ` +
        `Ensure the delivery partner has logged in on the Android app at least once.`
      );
      // Still fall through to save DB notification so in-app polling works as fallback
    }

    // -----------------------------------------------------------------------
    // 2. Persist notification to DB — in-app polling reads from here
    // -----------------------------------------------------------------------
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
      logger.error(`[FCM] Error saving notification to DB:`, insertError);
      // Continue sending push even if DB insert fails
    } else {
      logger.info(`[FCM] DB notification saved for partner ${deliveryPartnerId}`);
    }

    // -----------------------------------------------------------------------
    // 3. Skip FCM send if no tokens registered
    // -----------------------------------------------------------------------
    if (tokens.length === 0) {
      return;
    }

    // -----------------------------------------------------------------------
    // 4. Build and send FCM message for each token
    // -----------------------------------------------------------------------
    for (const fcmToken of tokens) {
      const message = {
        token: fcmToken,
        notification: {
          title: "New Delivery Assigned",
          body: "You have a new order"
        },
        android: {
          priority: "high",
          notification: {
            channelId: "delivery_notifications",
            sound: "default"
          }
        },
        data: {
          type: "NEW_ASSIGNMENT",
          order_id: String(orderId)
        }
      };

      try {
        logger.info(`[FCM] Sending push to token: ${fcmToken.substring(0, 15)}...`);
        const response = await admin.messaging().send(message);
        logger.info(`[FCM] Successfully sent message: ${response}`);
      } catch (sendError) {
        logger.error(`[FCM] Error sending message to token ${fcmToken.substring(0, 15)}...:`, sendError);
        
        // Cleanup stale token if unregistered
        if (
          sendError.code === 'messaging/registration-token-not-registered' ||
          sendError.code === 'messaging/invalid-registration-token'
        ) {
          logger.info(`[FCM] Removing stale token...`);
          await supabase.from('delivery_notification_tokens').delete().eq('fcm_token', fcmToken);
        }
      }
    }

  } catch (error) {
    logger.error(`[FCM] Unexpected error in sendPushNotification:`, error);
  }
};

module.exports = { sendPushNotification };
