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
    // 4. Build FCM multicast message
    //
    // IMPORTANT Android specifics:
    //   - android.priority = 'high'  → wakes device from Doze mode (critical!)
    //   - data payload is included alongside notification so onMessageReceived
    //     can read order_id and type even when app is killed.
    //   - notification block ensures FCM generates a system tray notification
    //     automatically when the app is in background/killed state.
    // -----------------------------------------------------------------------
    const shortOrderId = orderId.split('-')[0].toUpperCase(); // e.g. "A1B2C3D4"

    const message = {
      tokens,
      notification: {
        title,
        body
      },
      data: {
        order_id: String(orderId),
        type: 'NEW_ASSIGNMENT',
        role: 'delivery',
        // Echo title/body in data so onMessageReceived can always read them
        title,
        body
      },
      android: {
        priority: 'high',                        // Wake device from Doze
        notification: {
          channelId: 'doorriing_delivery_channel', // Must match MyFirebaseMessagingService.CHANNEL_ID
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          clickAction: 'FLUTTER_NOTIFICATION_CLICK' // optional, harmless if unused
        }
      }
    };

    // -----------------------------------------------------------------------
    // 5. Send multicast and process results
    // -----------------------------------------------------------------------
    logger.info(`[FCM] Sending multicast to ${tokens.length} token(s) for order ${shortOrderId}...`);
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`[FCM] Result → success: ${response.successCount}, failure: ${response.failureCount}`);

    // -----------------------------------------------------------------------
    // 6. Clean up stale / invalid tokens
    // -----------------------------------------------------------------------
    if (response.failureCount > 0) {
      const tokensToDelete = [];

      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errorCode = res.error?.code || 'unknown';
          logger.warn(`[FCM] Token[${idx}] failed: ${errorCode}`);

          // These error codes mean the token is permanently invalid
          const permanentErrors = [
            'messaging/registration-token-not-registered',
            'messaging/invalid-registration-token',
            'messaging/invalid-argument'
          ];

          if (permanentErrors.includes(errorCode)) {
            tokensToDelete.push(tokens[idx]);
          }
        }
      });

      if (tokensToDelete.length > 0) {
        logger.info(`[FCM] Removing ${tokensToDelete.length} stale token(s)...`);
        const { error: deleteError } = await supabase
          .from('delivery_notification_tokens')
          .delete()
          .in('fcm_token', tokensToDelete);

        if (deleteError) {
          logger.error(`[FCM] Error deleting stale tokens:`, deleteError);
        } else {
          logger.info(`[FCM] Stale tokens removed successfully`);
        }
      }
    }

  } catch (error) {
    // Never throw — push notification failure must not break the order assignment flow
    logger.error(`[FCM] Unexpected error in sendPushNotification:`, error);
  }
};

module.exports = { sendPushNotification };
