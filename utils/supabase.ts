import { createClient } from '@supabase/supabase-js';

// Come FamilyLoop: credenziali iniettate al build da vite.config.ts.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try { return new URL(url).protocol.startsWith('http'); } catch { return false; }
};

const configured = isValidUrl(SUPABASE_URL) && !!SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 20;

if (!configured) {
  console.warn('[Supabase] Non configurato: l\'app funziona in modalità demo (dati salvati solo su questo telefono). Imposta SUPABASE_URL e SUPABASE_ANON_KEY in .env per la modalità completa.');
}

export const supabase = configured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
    })
  : null;

export const isSupabaseConfigured = () => configured;
