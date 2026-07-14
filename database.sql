-- CAMMINATA SAN MARTINO - SCHEMA DATABASE
-- Stessa impostazione di FamilyLoop: Supabase + Row Level Security.
-- Eseguire nel SQL Editor del progetto Supabase.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    adults INT NOT NULL DEFAULT 1,
    children INT NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    consent BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in BOOLEAN NOT NULL DEFAULT FALSE,
    voucher_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Iscrizione pubblica (form aperto a tutti)
CREATE POLICY "public_insert" ON public.participants
    FOR INSERT TO anon WITH CHECK (consent = TRUE);

-- Lettura del proprio tagliandino tramite id (il QR è la "chiave")
CREATE POLICY "public_select" ON public.participants
    FOR SELECT TO anon USING (TRUE);

-- Check-in e riscatto: nel prototipo sono aperti; in produzione
-- limitare agli utenti staff autenticati, es.:
--   FOR UPDATE TO authenticated USING (auth.jwt() ->> 'role' = 'staff')
CREATE POLICY "public_update_flags" ON public.participants
    FOR UPDATE TO anon USING (TRUE) WITH CHECK (TRUE);
