const { createClient } = require('@supabase/supabase-js');
const { env } = require('./env');
const { logger } = require('../utils/logger');

let supabaseClient;

const initSupabase = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('Supabase credentials missing - skipping client initialization');
    return null;
  }

  supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  logger.info('Supabase client initialized');
  return supabaseClient;
};

const getSupabaseClient = () => supabaseClient || initSupabase();

module.exports = { initSupabase, getSupabaseClient };
