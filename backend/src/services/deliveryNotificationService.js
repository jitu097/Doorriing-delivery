'use strict';

const { getSupabaseClient } = require('../config/db');
const { initFirebase, getMessaging } = require('../config/firebase');
const { logger } = require('../utils/logger');

/**
 * Send a native FCM push notification to all registered devices of a delivery partner.
 *
 * @param {string} deliveryPartnerId  - UUID of the delivery partner
 * @param {string} orderId            - UUID of the order
 * @param {string} title              - Notification title  (optional override)
 * @param {string} body               - Notification body   (optional override)
 */
const sendPushNotification = async (deliveryPartnerId, orderId, title, body) => {
  logger.info(`[FCM] ======================================================`);
  logger.info(`[FCM] sendPushNotification() called`);
  logger.info(`[FCM]   deliveryPartnerId : ${deliveryPartnerId}`);
  logger.info(`[FCM]   orderId           : ${orderId}`);

  try {
    // -------------------------------------------------------------------------
    // 0. Ensure Firebase Admin SDK is initialised
    // -------------------------------------------------------------------------
    initFirebase();

    const supabase = getSupabaseClient();

    // -------------------------------------------------------------------------
    // 1. Fetch all FCM tokens registered for this delivery partner
    // -------------------------------------------------------------------------
    logger.info(`[FCM] Fetching FCM tokens for partner ${deliveryPartnerId}...`);

    const { data: tokensData, error: tokenError } = await supabase
      .from('delivery_notification_tokens')
      .select('fcm_token, device_id, platform')
      .eq('delivery_partner_id', deliveryPartnerId)
      .eq('role', 'delivery');

    if (tokenError) {
      logger.error(`[FCM] ❌ DB error fetching tokens:`, tokenError);
      // Still save DB notification for in-app fallback
    }

    const tokens = (tokensData || []).map(t => t.fcm_token).filter(Boolean);
    logger.info(`[FCM] Found ${tokens.length} token(s) for partner ${deliveryPartnerId}`);

    if (tokens.length === 0) {
      logger.warn(
        `[FCM] ⚠️  No FCM tokens found for partner ${deliveryPartnerId}. ` +
        `Delivery partner must open the Android app at least once to register a token.`
      );
    } else {
      tokensData.forEach((t, i) => {
        logger.info(`[FCM]   Token[${i}] device=${t.device_id} platform=${t.platform} token=${t.fcm_token?.substring(0, 20)}...`);
      });
    }

    // -------------------------------------------------------------------------
    // 2. Persist notification to DB — in-app polling reads from here
    // -------------------------------------------------------------------------
    const shortId = String(orderId).split('-')[0].toUpperCase();
    const notifTitle = title || 'New Delivery Assigned';
    const notifBody  = body  || `Order #${shortId} assigned to you`;

    logger.info(`[FCM] Saving notification to delivery_notifications table...`);
    const { error: insertError } = await supabase
      .from('delivery_notifications')
      .insert({
        delivery_partner_id: deliveryPartnerId,
        title: notifTitle,
        body:  notifBody,
        data: {
          order_id: String(orderId),
          type: 'NEW_ASSIGNMENT'
        }
      });

    if (insertError) {
      logger.error(`[FCM] ❌ Failed to save in-app notification:`, insertError);
    } else {
      logger.info(`[FCM] ✅ In-app notification saved to DB`);
    }

    // -------------------------------------------------------------------------
    // 3. Skip FCM send if no tokens
    // -------------------------------------------------------------------------
    if (tokens.length === 0) {
      logger.warn(`[FCM] Skipping FCM push — no tokens registered`);
      return;
    }

    // -------------------------------------------------------------------------
    // 4. Build and send FCM message for each token
    // -------------------------------------------------------------------------
    let successCount = 0;
    let failureCount = 0;

    for (const fcmToken of tokens) {
      const message = {
        token: fcmToken,
        notification: {
          title: notifTitle,
          body:  notifBody
        },
        android: {
          priority: 'high',
          notification: {
            channelId:             'doorriing_delivery_channel',
            sound:                 'default',
            priority:              'max',
            defaultSound:          true,
            defaultVibrateTimings: true,
            clickAction:           'OPEN_DELIVERY_APP'
          }
        },
        data: {
          // ⚠️  ALL values in FCM data payload MUST be strings
          // Duplicate title/body in data so onMessageReceived() can read them
          // even when the system handles the notification tray display.
          type:         'NEW_ASSIGNMENT',
          order_id:     String(orderId),
          click_action: 'OPEN_DELIVERY_APP',
          title:        notifTitle,
          body:         notifBody
        }
      };

      logger.info(`[FCM] ➤ Sending push to token: ${fcmToken.substring(0, 20)}...`);
      console.log("FCM TOKEN FOUND:", fcmToken);
      console.log("FCM PAYLOAD:", JSON.stringify(message, null, 2));

      try {
        // Use getMessaging() so we use the same initialised Firebase app instance
        const messaging = getMessaging();
        const response = await messaging.send(message);
        logger.info(`[FCM] ✅ Push sent successfully! Message ID: ${response}`);
        console.log("FCM SEND RESPONSE:", response);
        successCount++;
      } catch (sendError) {
        failureCount++;
        logger.error(`[FCM] ❌ Failed to send push to token ${fcmToken.substring(0, 20)}...`);
        logger.error(`[FCM]   Error code    : ${sendError.code}`);
        logger.error(`[FCM]   Error message : ${sendError.message}`);
        console.error("FCM SEND ERROR:", sendError);

        // Remove stale tokens automatically
        if (
          sendError.code === 'messaging/registration-token-not-registered' ||
          sendError.code === 'messaging/invalid-registration-token'
        ) {
          logger.info(`[FCM] Removing stale/invalid token from DB...`);
          await supabase
            .from('delivery_notification_tokens')
            .delete()
            .eq('fcm_token', fcmToken);
          logger.info(`[FCM] Stale token removed`);
        }
      }
    }

    logger.info(`[FCM] ─────────────────────────────────────────────────────`);
    logger.info(`[FCM] Push summary: ${successCount} sent, ${failureCount} failed out of ${tokens.length} token(s)`);
    logger.info(`[FCM] ======================================================`);

  } catch (error) {
    logger.error(`[FCM] ❌ Unexpected error in sendPushNotification:`, error);
  }
};

module.exports = { sendPushNotification };
