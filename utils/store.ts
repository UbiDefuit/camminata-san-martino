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

const LS_KEY = 'csm_participants';

// --- Modalità demo (senza Supabase): localStorage ---
const lsRead = (): Participant[] => JSON.parse(localStorage.getItem(LS_KEY) || '[]');
const lsWrite = (list: Participant[]) => localStorage.setItem(LS_KEY, JSON.stringify(list));

export async function register(p: Omit<Participant, 'id' | 'created_at' | 'checked_in' | 'voucher_used'>): Promise<Participant> {
  const row: Participant = {
    ...p,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    checked_in: false,
    voucher_used: false,
  };
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase!.from('participants').insert(row).select().single();
    if (error) throw error;
    return data as Participant;
  }
  lsWrite([...lsRead(), row]);
  return row;
}

export async function listParticipants(): Promise<Participant[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase!.from('participants').select('*').order('created_at');
    if (error) throw error;
    return data as Participant[];
  }
  return lsRead();
}

export async function getParticipant(id: string): Promise<Participant | null> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase!.from('participants').select('*').eq('id', id).maybeSingle();
    return (data as Participant) || null;
  }
  return lsRead().find((p) => p.id === id) || null;
}

async function setFlag(id: string, field: 'checked_in' | 'voucher_used'): Promise<Participant | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase!.from('participants').update({ [field]: true }).eq('id', id).select().single();
    if (error) throw error;
    return data as Participant;
  }
  const list = lsRead();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  (p as any)[field] = true;
  lsWrite(list);
  return p;
}

export const checkIn = (id: string) => setFlag(id, 'checked_in');
export const redeemVoucher = (id: string) => setFlag(id, 'voucher_used');

// Il "mio" tagliandino su questo telefono
export const getMyTicketId = () => localStorage.getItem('csm_my_ticket');
export const setMyTicketId = (id: string) => localStorage.setItem('csm_my_ticket', id);
