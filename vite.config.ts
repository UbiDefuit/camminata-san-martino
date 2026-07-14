import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Stessa impostazione di FamilyLoop: le credenziali Supabase vengono
// iniettate al build da .env (vedi .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      // Default: progetto Supabase dell'evento. La anon key è pubblica per
      // design (finisce comunque nel bundle): i dati sono protetti dalle
      // policy RLS lato server. Sovrascrivibile via .env o secrets CI.
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || 'https://vkhbajdzouyewflcfyqz.supabase.co'),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZraGJhamR6b3V5ZXdmbGNmeXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMzQ3MTgsImV4cCI6MjA5OTYxMDcxOH0.9N5s4VT7_f8K8nPig_bkBd806WN1gnToA5RrNDkvmtE'),
    },
    base: './',
    server: { port: 3000, host: '0.0.0.0' },
    plugins: [react()],
  };
});
