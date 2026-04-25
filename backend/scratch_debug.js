const { initSupabase, getSupabaseClient } = require('./src/config/db');
require('dotenv').config();

initSupabase();
const supabase = getSupabaseClient();

async function test() {
  console.log('Fetching delivered orders...');
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, payment_method, total_amount')
    .eq('status', 'delivered')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error detail:', error);
  } else {
    console.log('Delivered orders:', data);
  }

  console.log('Fetching cash collections...');
  const { data: cashData, error: cashError } = await supabase
    .from('cash_collections')
    .select('*');
  
  if (cashError) {
    console.error('Cash error:', cashError);
  } else {
    console.log('Cash collections count:', cashData.length);
  }
  process.exit(error ? 1 : 0);
}

test();
