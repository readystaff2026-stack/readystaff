import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

export const supabase = createClient(
  'https://wsutvfonuualpckowzpv.supabase.co',
  'sb_publishable_g9DWS8l0nuhGbe4wvNZTjA_EXydGO_R',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
