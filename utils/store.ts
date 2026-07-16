import { supabase, isSupabaseConfigured } from './supabase';

export interface Participant {
  id: string;
  name: string;
  contact: string;
  adults: number;
  children: number;
  notes: string;           // intolleranze / note colazione
  consent: boolean;        // privacy + liberatoria riprese
  created_at: string;
  checked_in: boolean;     // presenza registrata alla partenza
  voucher_used: boolean;   // tagliandino colazione riscattato
}

const TABLE = 'sm2_participants';
const LS_KEY = 'csm_participants';

// --- Modalità demo (senza Supabase): localStorage ---
const lsRead = (): Participant[] => JSON.parse(localStorage.getItem(LS_KEY) || '[]');
const lsWrite = (list: Participant[]) => localStorage.setItem(LS_KEY, JSON.stringify(list));

export async function register(p: Omit<Participant, 'id' | 'created_at' | 'checked_in' | 'voucher_used'>): Promise<Participant> {
  if (isSupabaseConfigured()) {
    // id generato qui: la tabella non è più leggibile pubblicamente,
    // quindi niente INSERT..RETURNING (richiederebbe una policy SELECT)
    const id = crypto.randomUUID();
    const { error } = await supabase!.from(TABLE)
      .insert({ id, name: p.name, contact: p.contact, adults: p.adults, children: p.children, notes: p.notes, consent: p.consent });
    if (error) throw error;
    return { ...p, id, created_at: new Date().toISOString(), checked_in: false, voucher_used: false };
  }
  const row: Participant = {
    ...p, id: crypto.randomUUID(), created_at: new Date().toISOString(),
    checked_in: false, voucher_used: false,
  };
  lsWrite([...lsRead(), row]);
  return row;
}

export async function listParticipants(pin: string): Promise<Participant[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase!.rpc('sm2_staff_list', { pin });
    if (error) throw new Error(error.message);
    return (data || []) as Participant[];
  }
  return lsRead();
}

export async function getParticipant(id: string): Promise<Participant | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase!.rpc('sm2_get_ticket', { p_id: id });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as Participant) || null;
  }
  return lsRead().find((p) => p.id === id) || null;
}

// Verifica PIN staff (lato server, hash bcrypt in sm2_config)
export async function verifyStaffPin(pin: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return true; // demo: qualsiasi PIN
  const { data, error } = await supabase!.rpc('sm2_verify_pin', { pin });
  if (error) throw error;
  return data === true;
}

// Check-in e riscatto passano SOLO dalle funzioni server con PIN:
// nessun UPDATE diretto è permesso dalle policy RLS.
async function rpcAction(fn: 'sm2_check_in' | 'sm2_redeem', id: string, pin: string): Promise<Participant | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase!.rpc(fn, { p_id: id, pin });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return (row as Participant) || null;
  }
  const list = lsRead();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  if (fn === 'sm2_redeem') {
    if (p.voucher_used) throw new Error('Colazione già ritirata');
    p.voucher_used = true;
  } else p.checked_in = true;
  lsWrite(list);
  return p;
}

export const checkIn = (id: string, pin: string) => rpcAction('sm2_check_in', id, pin);
export const redeemVoucher = (id: string, pin: string) => rpcAction('sm2_redeem', id, pin);

// Recupero tagliandino: dato il contatto usato all'iscrizione, ritrova il QR
export async function findTicket(contact: string): Promise<Participant | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase!.rpc('sm2_find_ticket', { p_contact: contact });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return (row as Participant) || null;
  }
  return lsRead().find((p) => p.contact.trim().toLowerCase() === contact.trim().toLowerCase()) || null;
}

// Staff: annulla un'iscrizione errata (con PIN)
export async function cancelParticipant(id: string, pin: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase!.rpc('sm2_cancel', { p_id: id, pin });
    if (error) throw new Error(error.message);
    return data === true;
  }
  const list = lsRead();
  lsWrite(list.filter((p) => p.id !== id));
  return true;
}

// Messaggi comprensibili per gli errori del database
export function friendlyError(e: any): string {
  const m = String(e?.message || e);
  if (m.includes('duplicate key') || m.includes('sm2_participants_contact_unique'))
    return 'Questo contatto è già iscritto. Vai su "Ticket" e usa "Recupera tagliandino".';
  if (m.includes('Posti esauriti')) return 'Posti esauriti: le iscrizioni sono al completo.';
  if (m.includes('Iscrizioni chiuse')) return 'Le iscrizioni sono chiuse.';
  if (m.includes('Troppi tentativi')) return 'Troppi tentativi: riprova tra 15 minuti.';
  return m;
}

// Statistiche pubbliche (nessun dato personale): posti e scadenza iscrizioni
export interface PublicStats { taken: number; cap: number; deadline: string; colazione_aperta: boolean; }
export async function publicStats(): Promise<PublicStats | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase!.rpc('sm2_public_stats');
  if (error) return null;
  return data as PublicStats;
}

// Staff: apre/chiude la consegna colazioni
export async function setColazioneAperta(aperta: boolean, pin: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase!.rpc('sm2_set_colazione', { p_aperta: aperta, pin });
  if (error) throw new Error(error.message);
}

// Staff: annulla un check-in o una consegna registrati per errore
export async function resetFlag(id: string, flag: 'checkin' | 'colazione', pin: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase!.rpc('sm2_reset_flag', { p_id: id, p_flag: flag, pin });
  if (error) throw new Error(error.message);
}

// Il "mio" tagliandino su questo telefono
export const getMyTicketId = () => localStorage.getItem('csm_my_ticket');
export const setMyTicketId = (id: string) => localStorage.setItem('csm_my_ticket', id);

// ---------- Muro delle foto ----------
export interface EventPhoto {
  id: string;
  path: string;
  author: string;
  created_at: string;
  url: string;
}

export async function listPhotos(): Promise<EventPhoto[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase!
    .from('sm2_photos').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data || []).map((p: any) => ({
    ...p,
    url: supabase!.storage.from('sm2-photos').getPublicUrl(p.path).data.publicUrl,
  }));
}

export async function uploadPhoto(blob: Blob, author: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Le foto sono disponibili solo nella versione online.');
  const path = crypto.randomUUID() + '.jpg';
  const { error: upErr } = await supabase!.storage
    .from('sm2-photos').upload(path, blob, { contentType: 'image/jpeg' });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase!.from('sm2_photos').insert({ path, author });
  if (error) throw new Error(error.message);
}

export async function hidePhoto(id: string, pin: string): Promise<void> {
  const { error } = await supabase!.rpc('sm2_hide_photo', { p_id: id, pin });
  if (error) throw new Error(error.message);
}
