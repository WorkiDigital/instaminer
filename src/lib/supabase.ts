import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Proxy para imagens do Instagram (evita bloqueio de CORS)
export function proxyImgUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes('cdninstagram') && !url.includes('fbcdn') && !url.includes('scontent')) return url;
  return `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
}
