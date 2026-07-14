import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Stessa impostazione di FamilyLoop: le credenziali Supabase vengono
// iniettate al build da .env (vedi .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || ''),
    },
    base: './',
    server: { port: 3000, host: '0.0.0.0' },
    plugins: [react()],
  };
});
