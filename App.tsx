import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import L from 'leaflet';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Participant, register, listParticipants, getParticipant,
  checkIn, redeemVoucher, getMyTicketId, setMyTicketId,
} from './utils/store';
import { TRACK, POIS, TOTAL_M, progressOnTrack } from './utils/track';
import { isSupabaseConfigured } from './utils/supabase';

type View = 'home' | 'iscrizione' | 'tagliandino' | 'mappa' | 'admin';

const EVENT_DATE = new Date('2026-09-20T09:00:00');

// ---------- UI di base ----------
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'bg-pine-900/70 border border-pine-700/50 rounded-2xl p-5 ' + className}>{children}</div>;
}

function Button({ children, onClick, disabled = false, variant = 'primary' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost';
}) {
  const cls = variant === 'primary'
    ? 'bg-pine-500 hover:bg-pine-400 text-white'
    : 'bg-transparent border border-pine-500 text-pine-200 hover:bg-pine-800';
  return (
    <button onClick={onClick} disabled={disabled}
      className={cls + ' rounded-xl px-5 py-3 font-semibold transition disabled:opacity-40 w-full'}>
      {children}
    </button>
  );
}

// ---------- Landing ----------
function Landing({ go }: { go: (v: View) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, EVENT_DATE.getTime() - now);
  const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24,
    m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="text-center pt-8 pb-2">
        <div className="text-5xl mb-3">🥾🌄</div>
        <h1 className="text-3xl font-bold text-pine-100">Camminata sui Sentieri di San Martino</h1>
        <p className="text-pine-300 mt-2">Vallata di Polinago — domenica 20 settembre 2026, ore 9:00</p>
      </div>

      <Card>
        <div className="grid grid-cols-4 text-center gap-2">
          {[[d, 'giorni'], [h, 'ore'], [m, 'min'], [s, 'sec']].map(([v, l]) => (
            <div key={l as string}>
              <div className="text-3xl font-bold text-pine-200">{v}</div>
              <div className="text-xs text-pine-400 uppercase">{l}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-lg text-pine-100 mb-2">🌲 Sentieri ritrovati</h2>
        <p className="text-pine-300 text-sm leading-relaxed">
          I volontari della nostra associazione hanno ripulito e riaperto i sentieri storici del
          territorio montano di San Martino. Vieni a percorrerli con noi: {(TOTAL_M / 1000).toFixed(1)} km
          tra boschi e punti panoramici, con riprese drone della giornata e <b>colazione finale</b> offerta
          a tutti gli iscritti.
        </p>
      </Card>

      <Card>
        <h2 className="font-bold text-lg text-pine-100 mb-2">📋 Programma</h2>
        <ul className="text-pine-300 text-sm space-y-1">
          <li>• 8:30 — Ritrovo e check-in alla partenza</li>
          <li>• 9:00 — Partenza della camminata</li>
          <li>• lungo il percorso — punti panoramici e aree ripulite</li>
          <li>• al ristoro — colazione con il tagliandino digitale</li>
        </ul>
      </Card>

      <Button onClick={() => go('iscrizione')}>Iscriviti ora — è gratis</Button>
      <Button variant="ghost" onClick={() => go('mappa')}>Guarda il percorso</Button>
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
      setError('Errore durante l\'iscrizione: ' + (e.message || e));
    } finally { setBusy(false); }
  };

  const input = 'w-full bg-pine-950 border border-pine-700 rounded-xl px-4 py-3 text-white placeholder-pine-500 focus:outline-none focus:border-pine-400';

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="text-2xl font-bold text-pine-100 pt-4">Iscrizione</h1>
      {!isSupabaseConfigured() && (
        <p className="text-amber-300/90 text-xs bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
          Modalità demo: i dati restano solo su questo dispositivo. Collega Supabase per le iscrizioni reali.
        </p>
      )}
      <input className={input} placeholder="Nome e cognome" value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className={input} placeholder="Email o telefono" value={form.contact}
        onChange={(e) => setForm({ ...form, contact: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-pine-300">Adulti
          <input type="number" min={1} className={input + ' mt-1'} value={form.adults}
            onChange={(e) => setForm({ ...form, adults: +e.target.value })} />
        </label>
        <label className="text-sm text-pine-300">Bambini
          <input type="number" min={0} className={input + ' mt-1'} value={form.children}
            onChange={(e) => setForm({ ...form, children: +e.target.value })} />
        </label>
      </div>
      <input className={input} placeholder="Intolleranze o note per la colazione (facoltativo)" value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <label className="flex items-start gap-3 text-sm text-pine-300">
        <input type="checkbox" className="mt-1 accent-pine-400" checked={form.consent}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
        <span>Accetto l'informativa privacy e autorizzo le riprese foto/video (drone incluso) della giornata.</span>
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

  if (!p) return (
    <div className="pt-10 text-center text-pine-300 animate-fade-in-up">
      <p>Nessun tagliandino su questo dispositivo.</p>
      <p className="text-sm mt-2">Iscriviti per ricevere il tuo QR code personale.</p>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in-up text-center pt-4">
      <h1 className="text-2xl font-bold text-pine-100">Il tuo tagliandino</h1>
      <Card className="mx-auto max-w-xs">
        {qr && <img src={qr} alt="QR tagliandino" className="mx-auto rounded-xl bg-white p-2" />}
        <p className="mt-3 font-semibold text-pine-100">{p.name}</p>
        <p className="text-sm text-pine-300">{p.adults} adulti · {p.children} bambini</p>
        <div className="mt-3 text-sm space-y-1">
          <p className={p.checked_in ? 'text-pine-300' : 'text-pine-500'}>
            {p.checked_in ? '✅ Check-in effettuato' : '⬜ Check-in alla partenza'}
          </p>
          <p className={p.voucher_used ? 'text-amber-300' : 'text-pine-500'}>
            {p.voucher_used ? '🥐 Colazione ritirata' : '⬜ Colazione da ritirare al ristoro'}
          </p>
        </div>
      </Card>
      <p className="text-xs text-pine-400 px-6">
        Mostra questo QR al volontario alla partenza (check-in) e al punto ristoro (colazione).
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
    const line = L.polyline(TRACK, { color: '#68a27a', weight: 5, opacity: 0.9 }).addTo(map);
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
          meRef.current = L.circleMarker(pos, { radius: 9, color: '#fff', fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map);
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
      <div id="map" className="h-[55vh] rounded-2xl overflow-hidden border border-pine-700/50 mt-4" />
      <Card className="mt-4">
        <h2 className="font-bold text-pine-100 mb-2">Il tuo avanzamento</h2>
        {prog ? (
          <>
            <div className="h-3 bg-pine-950 rounded-full overflow-hidden">
              <div className="h-full bg-pine-400 transition-all" style={{ width: prog.pct + '%' }} />
            </div>
            <div className="flex justify-between text-sm text-pine-300 mt-2">
              <span>{(prog.doneM / 1000).toFixed(1)} km fatti</span>
              <span className="font-bold text-pine-100">{prog.pct}%</span>
              <span>{(prog.remainingM / 1000).toFixed(1)} km rimasti</span>
            </div>
            {prog.offTrackM > 150 && (
              <p className="text-amber-300 text-sm mt-2">⚠️ Sei a {Math.round(prog.offTrackM)} m dal sentiero.</p>
            )}
          </>
        ) : (
          <p className="text-pine-400 text-sm">
            {gpsErr ? 'GPS non disponibile: ' + gpsErr : 'In attesa della posizione GPS…'}
            {' '}Percorso totale: {(TOTAL_M / 1000).toFixed(1)} km.
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
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const refresh = () => listParticipants().then(setList);
  useEffect(() => { refresh(); }, []);

  const onScan = async (id: string) => {
    const p = await getParticipant(id);
    if (!p) { setMsg('❌ QR non riconosciuto'); return; }
    if (mode === 'checkin') {
      if (p.checked_in) setMsg('⚠️ ' + p.name + ': check-in già fatto');
      else { await checkIn(id); setMsg('✅ Check-in: ' + p.name); }
    } else {
      if (p.voucher_used) setMsg('⚠️ ' + p.name + ': colazione GIÀ RITIRATA');
      else { await redeemVoucher(id); setMsg('🥐 Colazione consegnata a ' + p.name); }
    }
    refresh();
  };

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

  const totAdulti = list.reduce((s, p) => s + p.adults, 0);
  const totBimbi = list.reduce((s, p) => s + p.children, 0);

  return (
    <div className="space-y-4 animate-fade-in-up pt-4">
      <h1 className="text-2xl font-bold text-pine-100">Organizzatori</h1>
      <Card>
        <div className="grid grid-cols-3 text-center">
          <div><div className="text-2xl font-bold text-pine-200">{list.length}</div><div className="text-xs text-pine-400">iscrizioni</div></div>
          <div><div className="text-2xl font-bold text-pine-200">{totAdulti + totBimbi}</div><div className="text-xs text-pine-400">partecipanti</div></div>
          <div><div className="text-2xl font-bold text-pine-200">{list.filter((p) => p.voucher_used).length}</div><div className="text-xs text-pine-400">colazioni</div></div>
        </div>
      </Card>

      <Card>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setMode('checkin')}
            className={(mode === 'checkin' ? 'bg-pine-500 text-white' : 'bg-pine-950 text-pine-300') + ' flex-1 rounded-xl py-2 text-sm font-semibold'}>
            Check-in partenza
          </button>
          <button onClick={() => setMode('colazione')}
            className={(mode === 'colazione' ? 'bg-pine-500 text-white' : 'bg-pine-950 text-pine-300') + ' flex-1 rounded-xl py-2 text-sm font-semibold'}>
            Riscatto colazione
          </button>
        </div>
        <div id="scanner" className="rounded-xl overflow-hidden" />
        {msg && <p className="text-center text-pine-100 font-semibold my-2">{msg}</p>}
        <Button onClick={scanning ? stopScan : startScan}>
          {scanning ? 'Ferma scansione' : 'Scansiona QR'}
        </Button>
      </Card>

      <Card>
        <h2 className="font-bold text-pine-100 mb-2">Iscritti</h2>
        {list.length === 0 && <p className="text-pine-400 text-sm">Nessuna iscrizione ancora.</p>}
        <ul className="divide-y divide-pine-800 text-sm">
          {list.map((p) => (
            <li key={p.id} className="py-2 flex justify-between items-center">
              <div>
                <div className="text-pine-100">{p.name}</div>
                <div className="text-pine-400 text-xs">{p.adults}A · {p.children}B{p.notes ? ' · ' + p.notes : ''}</div>
              </div>
              <div className="text-right text-xs">
                <span>{p.checked_in ? '✅' : '⬜'}</span> <span>{p.voucher_used ? '🥐' : '⬜'}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const [view, setView] = useState<View>('home');
  const nav: { v: View; icon: string; label: string }[] = [
    { v: 'home', icon: '🏠', label: 'Evento' },
    { v: 'iscrizione', icon: '✍️', label: 'Iscriviti' },
    { v: 'tagliandino', icon: '🎟️', label: 'Tagliandino' },
    { v: 'mappa', icon: '🗺️', label: 'Percorso' },
    { v: 'admin', icon: '🛠️', label: 'Staff' },
  ];

  return (
    <div className="min-h-screen bg-pine-950 text-white font-sans">
      <main className="max-w-lg mx-auto px-4 pb-28">
        {view === 'home' && <Landing go={setView} />}
        {view === 'iscrizione' && <Iscrizione go={setView} />}
        {view === 'tagliandino' && <Tagliandino />}
        {view === 'mappa' && <Mappa />}
        {view === 'admin' && <Admin />}
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-pine-900/90 backdrop-blur border-t border-pine-700/50">
        <div className="max-w-lg mx-auto flex">
          {nav.map((n) => (
            <button key={n.v} onClick={() => setView(n.v)}
              className={'flex-1 py-3 text-center ' + (view === n.v ? 'text-pine-200' : 'text-pine-500')}>
              <div className="text-xl">{n.icon}</div>
              <div className="text-[10px] font-semibold">{n.label}</div>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
