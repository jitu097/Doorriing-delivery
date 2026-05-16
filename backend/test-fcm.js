require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { initFirebase, getMessaging } = require('./src/config/firebase');

async function testPush() {
    console.log("Initializing Firebase...");
    initFirebase();
    const messaging = getMessaging();

    // Query DB to get a token, or we can just see if messaging initializes correctly.
    const { getSupabaseClient } = require('./src/config/db');
    const supabase = getSupabaseClient();
    
    console.log("Fetching tokens...");
    const { data: tokens, error } = await supabase
        .from('delivery_notification_tokens')
        .select('*');
        
    if (error) {
        console.error("DB Error:", error);
        return;
    }
    
    if (!tokens || tokens.length === 0) {
        console.log("No tokens found in DB. Cannot send push.");
        return;
    }
    
    console.log(`Found ${tokens.length} tokens. Sending to the most recent one...`);
    const target = tokens.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    
    console.log("Target token:", target.fcm_token);
    console.log("Partner ID:", target.delivery_partner_id);

    const message = {
        token: target.fcm_token,
        notification: {
            title: "Test Notification",
            body: "If you see this, FCM Admin SDK works perfectly."
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'doorriing_delivery_channel'
            }
        },
        data: {
            type: 'TEST'
        }
    };

    try {
        const response = await messaging.send(message);
        console.log("SUCCESS! Message ID:", response);
    } catch (err) {
        console.error("FAILED! Error code:", err.code);
        console.error("Error message:", err.message);
    }
}

testPush().catch(console.error);
