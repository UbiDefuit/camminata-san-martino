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
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || 'https://cezdmuhoyhbfieizpifj.supabase.co'),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlemRtdWhveWhiZmllaXpwaWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODI2OTYsImV4cCI6MjA3ODk1ODY5Nn0.nPi8wYNfMrGgycNsvU9rFOsa0jxfU7lxy_y36MvaZ3w'),
    },
    base: './',
    server: { port: 3000, host: '0.0.0.0' },
    plugins: [react()],
  };
});
