import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import L from 'leaflet';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Participant, register, listParticipants, getParticipant, checkIn, redeemVoucher,
  verifyStaffPin, findTicket, cancelParticipant, friendlyError, getMyTicketId, setMyTicketId,
} from './utils/store';
import { TRACK, POIS, TOTAL_M, OFFICIAL_KM, progressOnTrack } from './utils/track';
import { isSupabaseConfigured } from './utils/supabase';

type View = 'home' | 'iscrizione' | 'tagliandino' | 'mappa' | 'admin' | 'privacy';

const EVENT_DATE = new Date('2026-08-01T07:00:00');
// Link d'invito al gruppo WhatsApp dell'evento (da impostare quando il gruppo è creato)
const WHATSAPP_LINK = 'https://chat.whatsapp.com/Irv0U5KNHroKef4iLJtWua';

// ---------- UI di base (tema dark minimal) ----------
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'bg-neutral-950 border border-neutral-800 rounded-none p-6 ' + className}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-3">{children}</div>;
}

function Button({ children, onClick, disabled = false, variant = 'primary' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost';
}) {
  const cls = variant === 'primary'
    ? 'bg-white text-black hover:bg-neutral-200'
    : 'bg-transparent border border-neutral-700 text-white hover:border-white';
  return (
    <button onClick={onClick} disabled={disabled}
      className={cls + ' px-5 py-3.5 font-semibold uppercase tracking-[0.15em] text-sm transition disabled:opacity-40 w-full'}>
      {children}
    </button>
  );
}

const SITE_URL = 'https://ubidefuit.github.io/camminata-san-martino/';

// ---------- Landing ----------
function Landing({ go }: { go: (v: View) => void }) {
  const [now, setNow] = useState(Date.now());
  const [siteQr, setSiteQr] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { QRCode.toDataURL(SITE_URL, { width: 240, margin: 1 }).then(setSiteQr); }, []);
  const share = () => {
    if (navigator.share) navigator.share({ title: 'San Martino 2.0 — Into the Wild', url: SITE_URL });
    else navigator.clipboard?.writeText(SITE_URL);
  };
  const diff = Math.max(0, EVENT_DATE.getTime() - now);
  const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24,
    m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="text-center pt-10 pb-2">
        <img src="./logo.svg" alt="San Martino 2.0 — The Valley" className="w-44 h-44 mx-auto mb-8 border border-neutral-800" />
        <div className="text-[11px] uppercase tracking-[0.35em] text-neutral-500 mb-3">First Edition</div>
        <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">San Martino 2.0</h1>
        <p className="text-2xl font-light tracking-[0.2em] uppercase text-neutral-300 mt-1">Into the Wild</p>
        <p className="text-neutral-500 mt-5 text-sm tracking-wide">
          Chiesa di San Martino, Polinago<br />Sabato 1 agosto 2026 — ritrovo ore 6:30
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-4 text-center gap-2">
          {[[d, 'giorni'], [h, 'ore'], [m, 'min'], [s, 'sec']].map(([v, l]) => (
            <div key={l as string}>
              <div className="text-3xl font-light text-white tabular-nums">{String(v).padStart(2, '0')}</div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mt-1">{l}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Sentieri ritrovati</Label>
        <p className="text-neutral-400 text-sm leading-relaxed font-light">
          I volontari della nostra associazione hanno ripulito e riaperto i sentieri storici del
          territorio montano di San Martino. Vieni a percorrerli con noi: {OFFICIAL_KM.toLocaleString('it-IT')} km
          tra boschi e punti panoramici, con riprese drone della giornata e, al rientro,{' '}
          <span className="text-white">colazione per tutti</span> a offerta libera.
        </p>
      </Card>

      <Card>
        <Label>Programma</Label>
        <ul className="text-sm space-y-3 font-light">
          {[
            ['6:30', 'Ritrovo e check-in alla Chiesa di San Martino'],
            ['7:00', 'Partenza della camminata'],
            ['—', 'Punti panoramici e aree ripulite lungo il percorso'],
            ['9:30', 'Rientro alla chiesa, colazione per tutti (offerta libera, ritiro con tagliandino)'],
          ].map(([t, txt]) => (
            <li key={txt} className="flex gap-4">
              <span className="text-neutral-500 w-10 shrink-0 tabular-nums">{t}</span>
              <span className="text-neutral-300">{txt}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Button onClick={() => go('iscrizione')}>Iscriviti</Button>
      <Button variant="ghost" onClick={() => go('mappa')}>Guarda il percorso</Button>
      {WHATSAPP_LINK && (
        <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer"
          className="block text-center border border-neutral-700 text-white hover:border-white px-5 py-3.5 font-semibold uppercase tracking-[0.15em] text-sm transition">
          Gruppo WhatsApp
        </a>
      )}

      <Card className="text-center">
        <Label>Passaparola</Label>
        {siteQr && <img src={siteQr} alt="QR del sito" className="mx-auto bg-white p-2 w-40" />}
        <p className="text-neutral-500 text-xs font-light mt-3">
          Fai inquadrare questo QR per far conoscere l'evento.
        </p>
        <button onClick={share}
          className="mt-3 text-xs uppercase tracking-[0.2em] text-neutral-400 hover:text-white underline underline-offset-4 transition">
          Condividi il link
        </button>
      </Card>
    </div>
  );
}

// ---------- Iscrizione ----------
function Iscrizione({ go }: { go: (v: View) => void }) {
  const [form, setForm] = useState({ name: '', contact: '', adults: 1, children: 0, notes: '', consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.name.trim() || !form.contact.trim() || !form.consent) {
      setError('Compila nome, contatto e accetta l\'informativa.');
      return;
    }
    setBusy(true); setError('');
    try {
      const p = await register(form);
      setMyTicketId(p.id);
      go('tagliandino');
    } catch (e: any) {
      setError(friendlyError(e));
    } finally { setBusy(false); }
  };

  const input = 'w-full bg-black border border-neutral-800 px-4 py-3.5 text-white placeholder-neutral-600 focus:outline-none focus:border-white transition text-sm';

  return (
    <div className="space-y-4 animate-fade-in-up pt-8">
      <h1 className="text-2xl font-bold tracking-tight text-white">Iscrizione</h1>
      {!isSupabaseConfigured() && (
        <p className="text-neutral-400 text-xs border border-neutral-800 p-3 font-light">
          Modalità demo: i dati restano solo su questo dispositivo.
        </p>
      )}
      <input className={input} placeholder="Nome e cognome" value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className={input} placeholder="Email o telefono" value={form.contact}
        onChange={(e) => setForm({ ...form, contact: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs uppercase tracking-[0.15em] text-neutral-500">Adulti
          <input type="number" min={1} className={input + ' mt-2'} value={form.adults}
            onChange={(e) => setForm({ ...form, adults: +e.target.value })} />
        </label>
        <label className="text-xs uppercase tracking-[0.15em] text-neutral-500">Bambini
          <input type="number" min={0} className={input + ' mt-2'} value={form.children}
            onChange={(e) => setForm({ ...form, children: +e.target.value })} />
        </label>
      </div>
      <input className={input} placeholder="Intolleranze o note per la colazione (facoltativo)" value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <label className="flex items-start gap-3 text-sm text-neutral-400 font-light">
        <input type="checkbox" className="mt-1 accent-white" checked={form.consent}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
        <span>Accetto l'<button type="button" className="underline text-white" onClick={() => go('privacy')}>informativa privacy</button> e autorizzo le riprese foto/video (drone incluso) della giornata.</span>
      </label>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button onClick={submit} disabled={busy}>{busy ? 'Invio…' : 'Conferma iscrizione'}</Button>
    </div>
  );
}

// ---------- Tagliandino ----------
function Tagliandino() {
  const [p, setP] = useState<Participant | null>(null);
  const [qr, setQr] = useState('');

  useEffect(() => {
    const id = getMyTicketId();
    if (!id) return;
    getParticipant(id).then((part) => {
      setP(part);
      if (part) QRCode.toDataURL(part.id, { width: 280, margin: 1 }).then(setQr);
    });
  }, []);

  const [recContact, setRecContact] = useState('');
  const [recMsg, setRecMsg] = useState('');
  const recover = async () => {
    setRecMsg('');
    try {
      const found = await findTicket(recContact);
      if (!found) { setRecMsg('Nessuna iscrizione trovata con questo contatto.'); return; }
      setMyTicketId(found.id);
      setP(found);
      QRCode.toDataURL(found.id, { width: 280, margin: 1 }).then(setQr);
    } catch (e: any) { setRecMsg(friendlyError(e)); }
  };

  if (!p) return (
    <div className="pt-12 text-center text-neutral-400 animate-fade-in-up font-light space-y-4 max-w-xs mx-auto">
      <p>Nessun tagliandino su questo dispositivo.</p>
      <p className="text-sm text-neutral-600">Iscriviti, oppure recupera il tuo tagliandino con il contatto usato all'iscrizione.</p>
      <input className="w-full bg-black border border-neutral-800 px-4 py-3.5 text-white placeholder-neutral-600 focus:outline-none focus:border-white transition text-sm"
        placeholder="Email o telefono dell'iscrizione" value={recContact}
        onChange={(e) => setRecContact(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && recover()} />
      {recMsg && <p className="text-sm text-red-400">{recMsg}</p>}
      <Button onClick={recover}>Recupera tagliandino</Button>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in-up text-center pt-8">
      <h1 className="text-2xl font-bold tracking-tight text-white">Il tuo tagliandino</h1>
      <Card className="mx-auto max-w-xs">
        {qr && <img src={qr} alt="QR tagliandino" className="mx-auto bg-white p-2" />}
        <p className="mt-4 font-semibold text-white">{p.name}</p>
        <p className="text-sm text-neutral-500 font-light">{p.adults} adulti · {p.children} bambini</p>
        <div className="mt-4 text-xs uppercase tracking-[0.15em] space-y-2">
          <p className={p.checked_in ? 'text-white' : 'text-neutral-600'}>
            {p.checked_in ? '● Check-in effettuato' : '○ Check-in alla partenza'}
          </p>
          <p className={p.voucher_used ? 'text-white' : 'text-neutral-600'}>
            {p.voucher_used ? '● Colazione ritirata' : '○ Colazione da ritirare al rientro'}
          </p>
        </div>
      </Card>
      <p className="text-xs text-neutral-600 px-6 font-light">
        Mostra questo QR al volontario alla partenza (check-in) e al rientro alla chiesa (colazione).
        Funziona anche offline.
      </p>
    </div>
  );
}

// ---------- Mappa ----------
function Mappa() {
  const mapRef = useRef<L.Map | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);
  const [prog, setProg] = useState<ReturnType<typeof progressOnTrack> | null>(null);
  const [gpsErr, setGpsErr] = useState('');

  useEffect(() => {
    const map = L.map('map', { zoomControl: false }).setView(TRACK[0], 14);
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    const line = L.polyline(TRACK, { color: '#ffffff', weight: 4, opacity: 0.9 }).addTo(map);
    POIS.forEach((poi) =>
      L.marker(poi.pos, {
        icon: L.divIcon({ html: '<div style="font-size:22px">' + poi.icon + '</div>', className: '', iconSize: [24, 24] }),
      }).addTo(map).bindPopup(poi.label)
    );
    map.fitBounds(line.getBounds(), { padding: [30, 30] });

    const watch = navigator.geolocation?.watchPosition(
      (loc) => {
        const pos: [number, number] = [loc.coords.latitude, loc.coords.longitude];
        if (!meRef.current) {
          meRef.current = L.circleMarker(pos, { radius: 9, color: '#000', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
        } else meRef.current.setLatLng(pos);
        setProg(progressOnTrack(pos));
        setGpsErr('');
      },
      (err) => setGpsErr(err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      map.remove();
    };
  }, []);

  return (
    <div className="animate-fade-in-up">
      <div id="map" className="h-[55vh] overflow-hidden border border-neutral-800 mt-8 grayscale contrast-110" />
      <Card className="mt-5">
        <Label>Il tuo avanzamento</Label>
        {prog ? (
          <>
            <div className="h-1 bg-neutral-800 overflow-hidden">
              <div className="h-full bg-white transition-all" style={{ width: prog.pct + '%' }} />
            </div>
            <div className="flex justify-between text-sm text-neutral-400 mt-3 font-light">
              <span>{(prog.doneM / 1000).toFixed(1)} km fatti</span>
              <span className="font-semibold text-white">{prog.pct}%</span>
              <span>{(prog.remainingM / 1000).toFixed(1)} km rimasti</span>
            </div>
            {prog.offTrackM > 150 && (
              <p className="text-red-400 text-sm mt-3">Attenzione: sei a {Math.round(prog.offTrackM)} m dal sentiero.</p>
            )}
          </>
        ) : (
          <p className="text-neutral-500 text-sm font-light">
            {gpsErr ? 'GPS non disponibile: ' + gpsErr : 'In attesa della posizione GPS…'}
            {' '}Percorso totale: {OFFICIAL_KM.toLocaleString('it-IT')} km.
          </p>
        )}
      </Card>
    </div>
  );
}

// ---------- Admin (organizzatori) ----------
function Admin() {
  const [list, setList] = useState<Participant[]>([]);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState<'checkin' | 'colazione'>('checkin');
  const [pin, setPin] = useState(sessionStorage.getItem('sm2_staff_pin') || '');
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('sm2_staff_pin'));
  const [pinErr, setPinErr] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const refresh = () => listParticipants().then(setList);
  useEffect(() => { if (authed) refresh(); }, [authed]);

  const login = async () => {
    setPinErr('');
    try {
      if (await verifyStaffPin(pin)) {
        sessionStorage.setItem('sm2_staff_pin', pin);
        setAuthed(true);
      } else setPinErr('PIN non valido.');
    } catch (e: any) { setPinErr('Errore: ' + (e.message || e)); }
  };

  const onScan = async (id: string) => {
    try {
      const p = await getParticipant(id);
      if (!p) { setMsg('QR non riconosciuto'); return; }
      if (mode === 'checkin') {
        if (p.checked_in) setMsg(p.name + ': check-in già fatto');
        else { await checkIn(id, pin); setMsg('Check-in: ' + p.name); }
      } else {
        await redeemVoucher(id, pin);
        setMsg('Colazione consegnata a ' + p.name);
      }
    } catch (e: any) {
      setMsg((e.message || e).includes('già ritirata') ? 'ATTENZIONE: colazione GIÀ RITIRATA' : 'Errore: ' + (e.message || e));
    }
    refresh();
  };

  if (!authed) {
    return (
      <div className="space-y-4 animate-fade-in-up pt-8 max-w-xs mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-white">Staff</h1>
        <p className="text-neutral-500 text-sm font-light">Area riservata ai volontari. Inserisci il PIN staff.</p>
        <input type="password" inputMode="numeric" placeholder="PIN"
          className="w-full bg-black border border-neutral-800 px-4 py-3.5 text-white text-center tracking-[0.5em] focus:outline-none focus:border-white transition"
          value={pin} onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()} />
        {pinErr && <p className="text-red-400 text-sm text-center">{pinErr}</p>}
        <Button onClick={login}>Entra</Button>
      </div>
    );
  }

  const startScan = async () => {
    setScanning(true); setMsg('');
    const scanner = new Html5Qrcode('scanner');
    scannerRef.current = scanner;
    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 8, qrbox: 220 },
        (text) => { onScan(text); }, () => {});
    } catch (e: any) {
      setMsg('Fotocamera non disponibile: ' + (e.message || e));
      setScanning(false);
    }
  };
  const stopScan = async () => {
    await scannerRef.current?.stop().catch(() => {});
    scannerRef.current = null;
    setScanning(false);
  };

  const cancel = async (p: Participant) => {
    if (!window.confirm('Annullare l\'iscrizione di ' + p.name + '?')) return;
    try { await cancelParticipant(p.id, pin); setMsg('Iscrizione annullata: ' + p.name); }
    catch (e: any) { setMsg(friendlyError(e)); }
    refresh();
  };

  const totAdulti = list.reduce((s, p) => s + p.adults, 0);
  const totBimbi = list.reduce((s, p) => s + p.children, 0);
  const tabBtn = (active: boolean) =>
    (active ? 'bg-white text-black' : 'bg-black text-neutral-400 border border-neutral-800') +
    ' flex-1 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition';

  return (
    <div className="space-y-5 animate-fade-in-up pt-8">
      <h1 className="text-2xl font-bold tracking-tight text-white">Staff</h1>
      <Card>
        <div className="grid grid-cols-3 text-center">
          <div><div className="text-2xl font-light text-white">{list.length}</div><div className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mt-1">iscrizioni</div></div>
          <div><div className="text-2xl font-light text-white">{totAdulti + totBimbi}</div><div className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mt-1">partecipanti</div></div>
          <div><div className="text-2xl font-light text-white">{list.filter((p) => p.voucher_used).length}</div><div className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mt-1">colazioni</div></div>
        </div>
      </Card>

      <Card>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setMode('checkin')} className={tabBtn(mode === 'checkin')}>Check-in</button>
          <button onClick={() => setMode('colazione')} className={tabBtn(mode === 'colazione')}>Colazione</button>
        </div>
        <div id="scanner" className="overflow-hidden" />
        {msg && <p className="text-center text-white font-semibold my-3 text-sm">{msg}</p>}
        <Button onClick={scanning ? stopScan : startScan}>
          {scanning ? 'Ferma scansione' : 'Scansiona QR'}
        </Button>
      </Card>

      <Card>
        <Label>Iscritti</Label>
        {list.length === 0 && <p className="text-neutral-600 text-sm font-light">Nessuna iscrizione ancora.</p>}
        <ul className="divide-y divide-neutral-800 text-sm">
          {list.map((p) => (
            <li key={p.id} className="py-3 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="text-white truncate">{p.name}</div>
                <div className="text-neutral-500 text-xs font-light truncate">{p.adults}A · {p.children}B{p.notes ? ' · ' + p.notes : ''}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                  <div className={p.checked_in ? 'text-white' : ''}>{p.checked_in ? '● in' : '○ in'}</div>
                  <div className={p.voucher_used ? 'text-white' : ''}>{p.voucher_used ? '● col' : '○ col'}</div>
                </div>
                <button onClick={() => cancel(p)} title="Annulla iscrizione"
                  className="text-neutral-600 hover:text-red-400 border border-neutral-800 px-2 py-1 text-xs transition">✕</button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------- Privacy ----------
function Privacy({ go }: { go: (v: View) => void }) {
  return (
    <div className="space-y-5 animate-fade-in-up pt-8 text-sm font-light text-neutral-300 leading-relaxed">
      <h1 className="text-2xl font-bold tracking-tight text-white">Informativa privacy</h1>
      <p className="text-neutral-500 text-xs uppercase tracking-[0.2em]">Ai sensi del Reg. UE 2016/679 (GDPR)</p>
      <Card><Label>Titolare del trattamento</Label>
        <p>APS San Martino 2.0 — The Valley, Vallata di Polinago (MO). Per esercitare i tuoi diritti contatta l'associazione tramite i canali dell'evento.</p></Card>
      <Card><Label>Dati raccolti e finalità</Label>
        <p>Nome, contatto (email o telefono), numero di partecipanti ed eventuali note alimentari, raccolti al solo fine di gestire l'iscrizione all'evento "San Martino 2.0 — Into the Wild" del 1° agosto 2026, il check-in e la distribuzione della colazione.</p></Card>
      <Card><Label>Riprese foto e video</Label>
        <p>Durante l'evento verranno effettuate riprese foto/video, anche con drone, per la documentazione e la promozione delle attività dell'associazione. Con l'iscrizione autorizzi l'uso di tali riprese; puoi revocare il consenso in qualsiasi momento contattando l'associazione.</p></Card>
      <Card><Label>Posizione GPS</Label>
        <p>La posizione GPS mostrata sulla mappa del percorso è elaborata esclusivamente sul tuo dispositivo e non viene mai inviata ai nostri server.</p></Card>
      <Card><Label>Conservazione e cancellazione</Label>
        <p>I dati sono conservati su infrastruttura Supabase (UE, Francoforte) e verranno cancellati entro 30 giorni dalla conclusione dell'evento. Puoi chiederne la cancellazione anticipata in qualsiasi momento.</p></Card>
      <Button variant="ghost" onClick={() => go('iscrizione')}>Torna all'iscrizione</Button>
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const [view, setView] = useState<View>('home');
  const nav: { v: View; label: string }[] = [
    { v: 'home', label: 'Evento' },
    { v: 'iscrizione', label: 'Iscriviti' },
    { v: 'tagliandino', label: 'Ticket' },
    { v: 'mappa', label: 'Percorso' },
    { v: 'admin', label: 'Staff' },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <main className="max-w-lg mx-auto px-5 pb-28">
        {view === 'home' && <Landing go={setView} />}
        {view === 'iscrizione' && <Iscrizione go={setView} />}
        {view === 'tagliandino' && <Tagliandino />}
        {view === 'mappa' && <Mappa />}
        {view === 'admin' && <Admin />}
        {view === 'privacy' && <Privacy go={setView} />}
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-black/95 backdrop-blur border-t border-neutral-800">
        <div className="max-w-lg mx-auto flex">
          {nav.map((n) => (
            <button key={n.v} onClick={() => setView(n.v)}
              className={'flex-1 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] transition ' +
                (view === n.v ? 'text-white border-t-2 border-white -mt-px' : 'text-neutral-600')}>
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
