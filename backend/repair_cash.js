const { initSupabase, getSupabaseClient } = require('./src/config/db');
require('dotenv').config();

initSupabase();
const supabase = getSupabaseClient();

async function syncMissedCash() {
  console.log('🔄 Starting retroactive cash collection sync...');

  // 1. Fetch all delivered COD orders that are NOT in cash_collections
  const { data: deliveredOrders, error: orderError } = await supabase
    .from('orders')
    .select('id, total_amount, payment_method, delivery_partner_id')
    .eq('status', 'delivered');

  if (orderError) {
    console.error('❌ Error fetching orders:', orderError);
    return;
  }

  console.log(`📋 Found ${deliveredOrders.length} delivered orders. Filtering for COD...`);

  const codOrders = deliveredOrders.filter(o => o.payment_method?.toUpperCase() === 'COD');
  console.log(`💰 Found ${codOrders.length} total COD orders.`);

  let syncedCount = 0;

  for (const order of codOrders) {
    // Check if already in collections
    const { data: existing } = await supabase
      .from('cash_collections')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();

    if (existing) continue;

    console.log(`⚡ Syncing Order #${order.id.slice(-8)} (₹${order.total_amount})...`);

    // Insert collection
    const { error: insError } = await supabase
      .from('cash_collections')
      .insert({
        order_id: order.id,
        delivery_partner_id: order.delivery_partner_id,
        amount: order.total_amount,
        status: 'pending'
      });

    if (insError) {
      console.error(`❌ Failed to sync order ${order.id}:`, insError);
      continue;
    }

    // Update wallet
    const { error: rpcError } = await supabase.rpc('increment_wallet_cash', {
      partner_id: order.delivery_partner_id,
      amount: order.total_amount
    });

    if (rpcError) {
      console.error(`❌ Failed to update wallet for partner ${order.delivery_partner_id}:`, rpcError);
    }

    syncedCount++;
  }

  console.log(`✅ Sync complete! ${syncedCount} entries added.`);
  process.exit(0);
}

syncMissedCash();
