import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import L from 'leaflet';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Participant, register, listParticipants, getParticipant, checkIn, redeemVoucher,
  verifyStaffPin, findTicket, cancelParticipant, friendlyError, getMyTicketId, setMyTicketId,
  EventPhoto, listPhotos, uploadPhoto, hidePhoto, PublicStats, publicStats,
  setColazioneAperta, resetFlag,
} from './utils/store';
import { TRACK, ELES, DISTS, GAINS, POIS, TOTAL_M, ELEVATION_GAIN_M, progressOnTrack, idxAtDistance, slopeAt } from './utils/track';
import { isSupabaseConfigured } from './utils/supabase';

type View = 'home' | 'iscrizione' | 'tagliandino' | 'mappa' | 'foto' | 'admin' | 'privacy';

// Rete di sicurezza: se una vista va in crash, mostra l'errore invece del nero
class Guardia extends (React.Component as any) {
  state: { err: string | null } = { err: null };
  static getDerivedStateFromError(e: any) { return { err: String(e?.message || e) }; }
  componentDidCatch(e: any) { console.error('[crash]', e); }
  render() {
    if (this.state.err) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
          <p className="text-white font-semibold">Qualcosa è andato storto</p>
          <p className="text-neutral-300 text-xs break-all">{this.state.err}</p>
          <button onClick={() => this.setState({ err: null })}
            className="border border-neutral-700 text-white px-6 py-3 text-xs uppercase tracking-[0.15em]">
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const EVENT_DATE = new Date('2026-08-01T07:00:00');
// Link d'invito al gruppo WhatsApp dell'evento (da impostare quando il gruppo è creato)
const WHATSAPP_LINK = 'https://chat.whatsapp.com/Irv0U5KNHroKef4iLJtWua';

// ---------- UI di base (tema dark minimal) ----------
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'bg-neutral-950 border border-neutral-800 rounded-none p-6 ' + className}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-[0.25em] text-neutral-300 mb-3">{children}</div>;
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

// Informativa iscrizioni: scadenza e posti rimasti
function IscrizioniInfo() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => { publicStats().then(setStats); }, []);
  if (!stats) return null;
  const left = Math.max(0, stats.cap - stats.taken);
  const closed = stats.deadline && new Date() > new Date(stats.deadline);
  if (closed) return <p className="text-center text-xs uppercase tracking-[0.2em] text-neutral-300">Iscrizioni chiuse</p>;
  if (left === 0) return <p className="text-center text-xs uppercase tracking-[0.2em] text-neutral-300">Posti esauriti</p>;
  return (
    <div className="text-center space-y-1.5">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-200">
        {stats.taken > 0 && <><span className="text-white font-semibold">{stats.taken}</span> camminatori già iscritti · </>}
        <span className="text-white font-semibold">{left}</span> posti disponibili
      </p>
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">
        Iscrizioni entro le 20:00 di giovedì 30 luglio
      </p>
    </div>
  );
}

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
        <div className="text-xs uppercase tracking-[0.35em] text-neutral-300 mb-3">First Edition</div>
        <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">San Martino 2.0</h1>
        <p className="text-2xl font-light tracking-[0.2em] uppercase text-neutral-300 mt-1">Into the Wild</p>
        <p className="text-neutral-300 mt-5 text-sm tracking-wide">
          Chiesa di San Martino · San Martino Vallata<br />Sabato 1 agosto 2026 — ritrovo ore 6:30
        </p>
        <a href="https://maps.app.goo.gl/rUAuxyJMV4Pdbpb69" target="_blank" rel="noreferrer"
          className="inline-block mt-4 text-xs uppercase tracking-[0.2em] text-neutral-200 underline underline-offset-4 hover:text-white transition">
          📍 Apri il ritrovo in Google Maps
        </a>
      </div>

      <Card>
        <div className="grid grid-cols-4 text-center gap-2">
          {[[d, 'giorni'], [h, 'ore'], [m, 'min'], [s, 'sec']].map(([v, l]) => (
            <div key={l as string}>
              <div className="text-3xl font-light text-white tabular-nums">{String(v).padStart(2, '0')}</div>
              <div className="text-[11px] text-neutral-300 uppercase tracking-[0.2em] mt-1">{l}</div>
            </div>
          ))}
        </div>
      </Card>

      <IscrizioniInfo />

      <Card>
        <Label>Sentieri ritrovati</Label>
        <p className="text-neutral-200 text-[15px] leading-relaxed">
          I volontari della nostra associazione hanno ripulito e riaperto i sentieri storici del
          territorio montano di San Martino. Vieni a percorrerli con noi: {(TOTAL_M / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} km
          tra boschi e punti panoramici, con riprese drone della giornata e, al rientro,{' '}
          <span className="text-white">colazione per tutti</span> a offerta libera.
        </p>
      </Card>

      <Card>
        <Label>Il teaser</Label>
        <video controls playsInline preload="metadata" poster="./teaser-poster.jpg"
          className="w-full border border-neutral-800">
          <source src="./teaser.mp4" type="video/mp4" />
        </video>
        <p className="text-neutral-300 text-xs mt-2 text-center">18 secondi per capire dove stiamo andando.</p>
      </Card>

      <Card>
        <Label>Programma</Label>
        <ul className="text-[15px] space-y-3">
          {[
            ['6:30', 'Ritrovo e check-in alla Chiesa di San Martino'],
            ['7:00', 'Partenza della camminata'],
            ['—', 'Punti panoramici e aree ripulite lungo il percorso'],
            ['9:30', 'Rientro alla chiesa, colazione per tutti (offerta libera, ritiro con tagliandino)'],
          ].map(([t, txt]) => (
            <li key={txt} className="flex gap-4">
              <span className="text-neutral-300 w-10 shrink-0 tabular-nums">{t}</span>
              <span className="text-neutral-300">{txt}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Label>Equipaggiamento</Label>
        <ul className="text-[15px] space-y-2 text-neutral-300">
          <li>— Scarpe da trekking o comunque adatte a sentieri sterrati</li>
          <li>— Borraccia con acqua (lungo il percorso non ci sono fontane)</li>
          <li>— Abbigliamento a strati e giacca antipioggia</li>
          <li>— Cappellino e protezione solare</li>
          <li>— Bastoncini da trekking facoltativi ma consigliati (+422 m di dislivello)</li>
        </ul>
      </Card>

      <Card>
        <Label>Regole e responsabilità</Label>
        <ul className="text-[15px] space-y-2 text-neutral-300">
          <li>— La camminata è un'attività libera e non competitiva: ognuno partecipa a proprio rischio e deve valutare la propria condizione fisica</li>
          <li>— L'associazione declina ogni responsabilità per danni a persone o cose prima, durante e dopo l'evento</li>
          <li>— I minori devono essere accompagnati da un adulto responsabile</li>
          <li>— Cani ammessi solo al guinzaglio</li>
          <li>— Restare sul sentiero segnalato e seguire le indicazioni dei volontari</li>
          <li>— Non abbandonare rifiuti: riportiamo a valle ciò che portiamo su</li>
          <li>— In caso di maltempo l'evento può essere rinviato: aggiornamenti sul gruppo WhatsApp</li>
          <li>— Emergenze: 112</li>
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
        <p className="text-neutral-300 text-xs mt-3">
          Fai inquadrare questo QR per far conoscere l'evento.
        </p>
        <button onClick={share}
          className="mt-3 text-xs uppercase tracking-[0.2em] text-neutral-200 hover:text-white underline underline-offset-4 transition">
          Condividi il link
        </button>
      </Card>

      <div className="text-center pt-4 pb-2">
        <img src="./stemma-polinago.png" alt="Stemma del Comune di Polinago" className="w-16 mx-auto bg-white p-1.5" />
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-300 mt-3 leading-relaxed">
          Con il patrocinio del<br />Comune di Polinago
        </p>
      </div>
    </div>
  );
}

// ---------- Iscrizione ----------
function Iscrizione({ go }: { go: (v: View) => void }) {
  const [form, setForm] = useState({ name: '', contact: '', adults: 1, children: 0, notes: '', consent: false });
  const [liability, setLiability] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.name.trim() || !form.contact.trim() || !form.consent || !liability) {
      setError('Compila nome e contatto e accetta entrambe le dichiarazioni.');
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

  const input = 'w-full bg-black border border-neutral-800 px-4 py-3.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white transition text-sm';

  return (
    <div className="space-y-4 animate-fade-in-up pt-8">
      <h1 className="text-2xl font-bold tracking-tight text-white">Iscrizione</h1>
      <IscrizioniInfo />
      {!isSupabaseConfigured() && (
        <p className="text-neutral-200 text-xs border border-neutral-800 p-3">
          Modalità demo: i dati restano solo su questo dispositivo.
        </p>
      )}
      <input className={input} placeholder="Nome e cognome" value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className={input} placeholder="Email o telefono" value={form.contact}
        onChange={(e) => setForm({ ...form, contact: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs uppercase tracking-[0.15em] text-neutral-300">Adulti
          <input type="number" min={1} className={input + ' mt-2'} value={form.adults}
            onChange={(e) => setForm({ ...form, adults: +e.target.value })} />
        </label>
        <label className="text-xs uppercase tracking-[0.15em] text-neutral-300">Bambini
          <input type="number" min={0} className={input + ' mt-2'} value={form.children}
            onChange={(e) => setForm({ ...form, children: +e.target.value })} />
        </label>
      </div>
      <input className={input} placeholder="Intolleranze o note per la colazione (facoltativo)" value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <label className="flex items-start gap-3 text-sm text-neutral-200">
        <input type="checkbox" className="mt-1 accent-white" checked={form.consent}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
        <span>Accetto l'<button type="button" className="underline text-white" onClick={() => go('privacy')}>informativa privacy</button> e autorizzo le riprese foto/video (drone incluso) della giornata.</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-neutral-200">
        <input type="checkbox" className="mt-1 accent-white" checked={liability}
          onChange={(e) => setLiability(e.target.checked)} />
        <span>Dichiaro di partecipare a mio rischio, di essere in condizione fisica idonea e di sollevare l'associazione da ogni responsabilità per danni a persone o cose. Mi impegno a munirmi dell'equipaggiamento adeguato indicato nella pagina dell'evento.</span>
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
  const [sharing, setSharing] = useState(false);

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
    <div className="pt-12 text-center text-neutral-200 animate-fade-in-up space-y-4 max-w-xs mx-auto">
      <p>Nessun tagliandino su questo dispositivo.</p>
      <p className="text-sm text-neutral-400">Iscriviti, oppure recupera il tuo tagliandino con il contatto usato all'iscrizione.</p>
      <input className="w-full bg-black border border-neutral-800 px-4 py-3.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white transition text-sm"
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
        <p className="text-sm text-neutral-300">{p.adults} adulti · {p.children} bambini</p>
        <div className="mt-4 text-xs uppercase tracking-[0.15em] space-y-2">
          <p className={p.checked_in ? 'text-white' : 'text-neutral-400'}>
            {p.checked_in ? '● Check-in effettuato' : '○ Check-in alla partenza'}
          </p>
          <p className={p.voucher_used ? 'text-white' : 'text-neutral-400'}>
            {p.voucher_used ? '● Colazione ritirata' : '○ Colazione da ritirare al rientro'}
          </p>
          {localStorage.getItem('sm2_finished') && (
            <p className="text-white">★ Finisher · {Math.floor(Number(localStorage.getItem('sm2_finished')) / 60)}h {String(Number(localStorage.getItem('sm2_finished')) % 60).padStart(2, '0')}'</p>
          )}
        </div>
      </Card>
      <Button onClick={async () => {
        if (!p || sharing) return;
        setSharing(true);
        try {
          const W2 = 1080, H2 = 1920;
          const cv = document.createElement('canvas'); cv.width = W2; cv.height = H2;
          const c = cv.getContext('2d')!;
          c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, W2, H2);
          c.strokeStyle = '#ffffff'; c.lineWidth = 12; c.lineJoin = 'round'; c.lineCap = 'round';
          const m = [[315, 760], [495, 550], [593, 662], [683, 572], [840, 760]];
          c.beginPath(); c.moveTo(m[0][0], m[0][1]);
          for (let i = 1; i < m.length; i++) c.lineTo(m[i][0], m[i][1]);
          c.stroke();
          c.beginPath(); c.arc(705, 470, 39, 0, Math.PI * 2); c.stroke();
          c.textAlign = 'center'; c.fillStyle = '#ffffff';
          c.font = '600 44px Helvetica, Arial, sans-serif';
          c.fillText('S A N   M A R T I N O   2 . 0', W2 / 2, 360);
          const tot = p.adults + p.children;
          c.font = 'bold 148px Helvetica, Arial, sans-serif';
          c.fillText(tot > 1 ? 'CI SAREMO' : 'CI SARÒ', W2 / 2, 980);
          c.font = 'bold 54px Helvetica, Arial, sans-serif';
          c.fillText(p.name.toUpperCase(), W2 / 2, 1085);
          if (tot > 1) {
            c.font = '300 40px Helvetica, Arial, sans-serif'; c.fillStyle = '#bbbbbb';
            c.fillText(tot + ' CAMMINATORI', W2 / 2, 1150);
            c.fillStyle = '#ffffff';
          }
          c.fillStyle = '#ffffff'; c.fillRect(240, 1215, 600, 96);
          c.fillStyle = '#0a0a0a'; c.font = 'bold 50px Helvetica, Arial, sans-serif';
          c.fillText('INTO THE WILD', W2 / 2, 1280);
          c.fillStyle = '#ffffff'; c.font = 'bold 42px Helvetica, Arial, sans-serif';
          c.fillText('SABATO 1 AGOSTO · ORE 6:30', W2 / 2, 1405);
          c.fillStyle = '#bbbbbb'; c.font = '300 34px Helvetica, Arial, sans-serif';
          c.fillText('SAN MARTINO DI POLINAGO · 6,2 KM', W2 / 2, 1465);
          const qrData = await QRCode.toDataURL(SITE_URL, { width: 240, margin: 1 });
          const img = new Image(); img.src = qrData; await img.decode();
          c.fillStyle = '#ffffff'; c.fillRect(W2 / 2 - 140, 1560, 280, 280);
          c.drawImage(img, W2 / 2 - 120, 1580, 240, 240);
          const blob: Blob = await new Promise((r) => cv.toBlob((b) => r(b!), 'image/png'));
          const file = new File([blob], 'ci-saro-san-martino.png', { type: 'image/png' });
          const nav: any = navigator;
          if (nav.canShare && nav.canShare({ files: [file] })) {
            try { await nav.share({ files: [file], title: 'San Martino 2.0 — Into the Wild' }); } catch { /* annullato */ }
          } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
          }
        } finally { setSharing(false); }
      }} disabled={sharing}>{sharing ? 'Preparo la card…' : 'Condividi «Ci sarò»'}</Button>
      <p className="text-xs text-neutral-400 px-6">
        Mostra questo QR al volontario alla partenza (check-in) e al rientro alla chiesa (colazione).
        Funziona anche offline.
      </p>
    </div>
  );
}

// ---------- Mappa ----------
function AltimetryProfile({ doneM }: { doneM: number | null }) {
  const W = 600, H = 150, PAD = 8;
  const minE = Math.min(...ELES), maxE = Math.max(...ELES);
  const x = (d: number) => PAD + (d / TOTAL_M) * (W - 2 * PAD);
  const y = (e: number) => H - PAD - ((e - minE) / (maxE - minE)) * (H - 2 * PAD - 18);
  const line = TRACK.map((_, i) => `${x(DISTS[i]).toFixed(1)},${y(ELES[i]).toFixed(1)}`).join(' ');
  let liveX = null as number | null, liveY = null as number | null;
  if (doneM !== null) {
    let i = DISTS.findIndex((d) => d >= doneM); if (i < 0) i = DISTS.length - 1;
    liveX = x(DISTS[i]); liveY = y(ELES[i]);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2">
      <defs>
        <linearGradient id="alt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`} fill="url(#alt)" />
      <polyline points={line} fill="none" stroke="var(--ink)" strokeWidth="2" />
      {liveX !== null && (
        <>
          <line x1={liveX} y1={PAD} x2={liveX} y2={H - PAD} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
          <circle cx={liveX!} cy={liveY!} r="5" fill="var(--ink)" stroke="var(--paper)" strokeWidth="2" />
        </>
      )}
      <text x={PAD} y={12} fill="#737373" fontSize="11">{Math.round(maxE)} m</text>
      <text x={PAD} y={H - PAD - 4} fill="#737373" fontSize="11">{Math.round(minE)} m</text>
      <text x={W - PAD} y={12} textAnchor="end" fill="#737373" fontSize="11">+{ELEVATION_GAIN_M} m</text>
    </svg>
  );
}

const bearingBetween = (a: [number, number], b: [number, number]) => {
  const p = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * p) * Math.cos(b[0] * p);
  const x = Math.cos(a[0] * p) * Math.sin(b[0] * p) - Math.sin(a[0] * p) * Math.cos(b[0] * p) * Math.cos((b[1] - a[1]) * p);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

function Mappa() {
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const map2dRef = useRef<L.Map | null>(null);
  const map3dRef = useRef<maplibregl.Map | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);
  const me3dRef = useRef<maplibregl.Marker | null>(null);
  const flyMarkerRef = useRef<L.CircleMarker | null>(null);
  const flyTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [flying, setFlying] = useState(false);
  const flyingRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [finisherMin, setFinisherMin] = useState<number | null>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('finisher') === 'test') setFinisherMin(148);
  }, []);
  const [prog, setProg] = useState<ReturnType<typeof progressOnTrack> | null>(null);
  const [gpsErr, setGpsErr] = useState('');
  const fixesRef = useRef<{ t: number; d: number }[]>([]);
  const [speedMs, setSpeedMs] = useState<number | null>(null); // m/s media mobile

  // Street View reale della canonica (embed senza chiave) per intro/outro del volo
  // Foto della canonica (scatto dell'associazione) per intro/outro del volo
  const [svMounted, setSvMounted] = useState(false);
  const [svOpaque, setSvOpaque] = useState(false);
  const svTimers = useRef<number[]>([]);
  const svClear = () => { svTimers.current.forEach((t) => clearTimeout(t)); svTimers.current = []; };
  const svHideNow = () => {
    svClear(); setSvOpaque(false);
    svTimers.current.push(window.setTimeout(() => setSvMounted(false), 1100));
  };

  const stopFly = () => {
    if (flyTimer.current) clearInterval(flyTimer.current);
    flyTimer.current = null;
    flyMarkerRef.current?.remove(); flyMarkerRef.current = null;
    setFlying(false);
    flyingRef.current = false;
  };

  // GPS condiviso tra le due modalità
  useEffect(() => {
    const watch = navigator.geolocation?.watchPosition(
      (loc) => {
        const pos: [number, number] = [loc.coords.latitude, loc.coords.longitude];
        const p = progressOnTrack(pos);
        setProg(p);
        setGpsErr('');
        // finisher: partenza registrata vicino al via, arrivo dopo aver superato metà percorso
        if (p.offTrackM <= 250) {
          if (!localStorage.getItem('sm2_walk_start') && p.doneM < 600) {
            localStorage.setItem('sm2_walk_start', String(Date.now()));
          }
          const maxd = Math.max(Number(localStorage.getItem('sm2_max_done') || 0), p.doneM);
          localStorage.setItem('sm2_max_done', String(maxd));
          const start = Number(localStorage.getItem('sm2_walk_start') || 0);
          if (start && !localStorage.getItem('sm2_finished')
            && maxd > TOTAL_M * 0.6 && p.pct >= 95 && Date.now() - start > 30 * 60000) {
            const min = Math.round((Date.now() - start) / 60000);
            localStorage.setItem('sm2_finished', String(min));
            setFinisherMin(min);
          }
        }
        // telemetria: media mobile della velocità lungo il sentiero (finestra ~3 min)
        if (p.offTrackM <= 250) {
          const now = Date.now();
          const fixes = fixesRef.current.filter((f) => now - f.t < 180000);
          fixes.push({ t: now, d: p.doneM });
          fixesRef.current = fixes;
          if (fixes.length >= 3 && now - fixes[0].t > 30000) {
            const v = (fixes[fixes.length - 1].d - fixes[0].d) / ((now - fixes[0].t) / 1000);
            setSpeedMs(v > 0.1 ? v : 0);
          }
        }
        if (map2dRef.current) {
          if (!meRef.current) meRef.current = L.circleMarker(pos, { radius: 9, color: '#000', fillColor: '#fff', fillOpacity: 1 }).addTo(map2dRef.current);
          else meRef.current.setLatLng(pos);
        }
        if (map3dRef.current) {
          if (!me3dRef.current) {
            const el = document.createElement('div');
            el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #000;';
            me3dRef.current = new maplibregl.Marker({ element: el }).setLngLat([pos[1], pos[0]]).addTo(map3dRef.current);
          } else me3dRef.current.setLngLat([pos[1], pos[0]]);
        }
      },
      (err) => setGpsErr(err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => { if (watch !== undefined) navigator.geolocation.clearWatch(watch); };
  }, [mode]);

  // Mappa 2D (Leaflet)
  useEffect(() => {
    if (mode !== '2d') return;
    const map = L.map('map', { zoomControl: false }).setView(TRACK[0], 14);
    map2dRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    // doppia linea ad alto contrasto: bordo bianco + anima nera, leggibile su qualsiasi sfondo
    const casing = L.polyline(TRACK, { color: '#ffffff', weight: 10, opacity: 0.95 }).addTo(map);
    const line = L.polyline(TRACK, { color: '#111111', weight: 4.5, opacity: 1 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [30, 30] });

    // il percorso si disegna da solo dalla partenza all'arrivo
    [casing, line].forEach((pl) => {
      const p = (pl as any)._path as SVGPathElement | undefined;
      if (!p || !p.getTotalLength) return;
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      p.getBoundingClientRect(); // forza il reflow
      p.style.transition = 'stroke-dashoffset 3s ease-in-out 0.3s';
      requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; });
      setTimeout(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; p.style.transition = ''; }, 3600);
    });

    // a disegno finito: POI e corrente che scorre in direzione di marcia
    const late = setTimeout(() => {
      L.polyline(TRACK, { color: '#ffffff', weight: 2.5, opacity: 0.9, dashArray: '2 14', className: 'trail-flow' }).addTo(map);
      POIS.forEach((poi) =>
        L.marker(poi.pos, {
          icon: L.divIcon({ html: '<div style="font-size:22px" class="animate-fade-in-up">' + poi.icon + '</div>', className: '', iconSize: [24, 24] }),
        }).addTo(map).bindPopup(poi.label)
      );
    }, 3300);
    const clearLate = () => clearTimeout(late);
    return () => { clearLate(); stopFly(); meRef.current = null; map2dRef.current = null; map.remove(); };
  }, [mode]);

  // Mappa 3D (MapLibre GL: satellite + terreno DEM)
  useEffect(() => {
    if (mode !== '3d') return;
    const map = new maplibregl.Map({
      container: 'map3d',
      style: {
        version: 8,
        sources: {
          sat: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Esri, Maxar, Earthstar Geographics',
            maxzoom: 18,
          },
          dem: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 14,
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#181a17' } },
          { id: 'sat', type: 'raster', source: 'sat' },
        ],
      } as any,
      center: [TRACK[0][1], TRACK[0][0]],
      zoom: 13.8,
      pitch: 65,
      bearing: 160,
      maxPitch: 78,
      canvasContextAttributes: { preserveDrawingBuffer: true } as any,
      attributionControl: { compact: true } as any,
    });
    map.on('error', (e: any) => { console.error('[map3d]', e?.error?.message || e); (window as any).__map3dErr = ((window as any).__map3dErr || []).concat(String(e?.error?.message || e)); });
    (window as any).__map3d = map;
    map.on('style.load', () => {
      map.setTerrain({ source: 'dem', exaggeration: 1.4 } as any);
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: TRACK.map((p) => [p[1], p[0]]) } },
      });
      map.addLayer({
        id: 'route-glow', type: 'line', source: 'route',
        paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 4 },
      });
      map.addLayer({
        id: 'route', type: 'line', source: 'route',
        paint: { 'line-color': '#ffffff', 'line-width': 3.5 },
      });
    });
    map3dRef.current = map;
    return () => { stopFly(); me3dRef.current = null; map3dRef.current = null; map.remove(); };
  }, [mode]);

  // Sorvolo: 2D (pan) o 3D (cinematico con rotta)
  const flyover = () => {
    if (flying) {
      stopFly();
      svHideNow();
      if (mode === '2d' && map2dRef.current) map2dRef.current.fitBounds(L.latLngBounds(TRACK), { padding: [30, 30] });
      return;
    }
    setFlying(true);
    flyingRef.current = true;
    if (mode === '2d' && map2dRef.current) {
      const map = map2dRef.current;
      map.setView(TRACK[0], 16, { animate: true });
      flyMarkerRef.current = L.circleMarker(TRACK[0], { radius: 8, color: '#0a0a0a', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }).addTo(map);
      let i = 0;
      flyTimer.current = setInterval(() => {
        i += 3;
        if (i >= TRACK.length) {
          stopFly(); map.fitBounds(L.latLngBounds(TRACK), { padding: [30, 30] }); return;
        }
        flyMarkerRef.current?.setLatLng(TRACK[i]);
        map.panTo(TRACK[i], { animate: true });
      }, 60);
    } else if (mode === '3d' && map3dRef.current) {
      // pre-carica le tile della zona di decollo dietro la foto
      try {
        map3dRef.current.jumpTo(map3dRef.current.calculateCameraOptionsFromTo(
          { lng: TRACK[0][1], lat: TRACK[0][0] }, Math.max(...ELES.slice(0, 15)) + 220,
          { lng: TRACK[14][1], lat: TRACK[14][0] }, ELES[14]));
      } catch { /* ignora */ }
      // 1) foto della canonica → dissolvenza → volo
      setSvMounted(true);
      svTimers.current.push(window.setTimeout(() => setSvOpaque(true), 60));
      svTimers.current.push(window.setTimeout(() => setSvOpaque(false), 4200));
      svTimers.current.push(window.setTimeout(() => { setSvMounted(false); start3dFlight(); }, 5300));
    }
  };

  const start3dFlight = () => {
    {
      const map = map3dRef.current!;
      const len = TRACK.length;
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const avgPoint = (idx: number, r: number): [number, number] => {
        const a = Math.max(0, idx - r), b = Math.min(len - 1, idx + r);
        let la = 0, lo = 0, n = 0;
        for (let k = a; k <= b; k++) { la += TRACK[k][0]; lo += TRACK[k][1]; n++; }
        return [la / n, lo / n];
      };
      // Camera "a terra" davanti alla canonica: 55 m arretrata rispetto
      // alla direzione di partenza del sentiero, a 2,5 m dal suolo.
      const rad = Math.PI / 180;
      const off = (p: [number, number], b: number, d: number): [number, number] => [
        p[0] + (d * Math.cos(b * rad)) / 111320,
        p[1] + (d * Math.sin(b * rad)) / (111320 * Math.cos(p[0] * rad)),
      ];
      const backB = bearingBetween(TRACK[6], TRACK[0]);
      const groundCam = off(TRACK[0], backB, 55);
      const groundAlt = ELES[0] + 2.5;
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const lerpP = (a: [number, number], b: [number, number], t: number): [number, number] =>
        [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

      const cruiseStartPos = avgPoint(0, 10);
      const cruiseStartAlt = Math.max(...ELES.slice(0, 15)) + 220;

      let phase: 'decollo' | 'volo' | 'atterraggio' = 'decollo';
      let f = 0; const F = 34; // ~2,4 s per decollo e atterraggio
      let i = 0;
      let smPos: [number, number] = groundCam;
      let smLook: [number, number] = TRACK[0];
      let smAlt = groundAlt;

      // vista iniziale: a terra, davanti alla canonica
      try {
        map.jumpTo(map.calculateCameraOptionsFromTo(
          { lng: groundCam[1], lat: groundCam[0] }, groundAlt,
          { lng: TRACK[0][1], lat: TRACK[0][0] }, ELES[0] + 6));
      } catch { /* ignora */ }

      flyTimer.current = setInterval(() => {
        try {
          let lookEle = ELES[0] + 6;
          if (phase === 'decollo') {
            f++;
            const t = ease(f / F);
            smPos = lerpP(groundCam, cruiseStartPos, t);
            smAlt = lerp(groundAlt, cruiseStartAlt, t);
            smLook = lerpP(TRACK[0], avgPoint(14, 6), t);
            if (f >= F) { phase = 'volo'; i = 0; }
          } else if (phase === 'volo') {
            i += 4;
            if (i >= len - 6) { phase = 'atterraggio'; f = 0; }
            else {
              const camIdx = Math.max(0, i - 22);
              const lookIdx = Math.min(i + 14, len - 1);
              const pos = avgPoint(camIdx, 10);
              const look = avgPoint(lookIdx, 6);
              const alt = Math.max(...ELES.slice(camIdx, lookIdx + 1)) + 220;
              smPos = [smPos[0] + (pos[0] - smPos[0]) * 0.15, smPos[1] + (pos[1] - smPos[1]) * 0.15];
              smLook = [smLook[0] + (look[0] - smLook[0]) * 0.2, smLook[1] + (look[1] - smLook[1]) * 0.2];
              smAlt += (alt - smAlt) * 0.1;
              lookEle = ELES[lookIdx];
            }
          } else {
            f++;
            const t = ease(f / F) * 0.35; // avvicinamento progressivo
            smPos = lerpP(smPos, groundCam, t);
            smAlt = lerp(smAlt, groundAlt, t);
            smLook = lerpP(smLook, TRACK[0], t);
            if (f >= F) {
              map.jumpTo(map.calculateCameraOptionsFromTo(
                { lng: groundCam[1], lat: groundCam[0] }, groundAlt,
                { lng: TRACK[0][1], lat: TRACK[0][0] }, ELES[0] + 6));
              // outro: si riapre la Street View della canonica
              setSvMounted(true);
              svTimers.current.push(window.setTimeout(() => setSvOpaque(true), 60));
              stopFly();
              return;
            }
          }
          map.jumpTo(map.calculateCameraOptionsFromTo(
            { lng: smPos[1], lat: smPos[0] }, smAlt,
            { lng: smLook[1], lat: smLook[0] }, lookEle));
        } catch (e) {
          console.error('[volo]', e);
          stopFly();
        }
      }, 70);
    }
  };

  // ---------- Video ricordo: volo 3D registrato con overlay personalizzato ----------
  const formatMin = (m: number) => (m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + "'" : m + "'");

  const recordVideo = async () => {
    const map = map3dRef.current;
    if (mode !== '3d' || !map || recording || flying) return;
    setRecording(true);
    try {
      const myId = getMyTicketId();
      const me = myId ? await getParticipant(myId) : null;
      const nome = (me?.name || '').toUpperCase();
      const finMin = Number(localStorage.getItem('sm2_finished') || 0);

      const W = 720, H = 1280;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;
      const photo = new Image(); photo.src = './canonica.jpg';
      await photo.decode().catch(() => { /* offline: intro nera */ });

      const stream = (cv as any).captureStream(30);
      const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
        .find((m) => (window as any).MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
      if (!mime) throw new Error('Registrazione video non supportata da questo browser');
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const finito = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm' })); });
      rec.start(500);

      const drawCover = (src: CanvasImageSource, sw: number, sh: number, zoom = 1) => {
        const sc = Math.max(W / sw, H / sh) * zoom;
        const dw = sw * sc, dh = sh * sc;
        ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
      };
      const hud = () => {
        const g = ctx.createLinearGradient(0, H - 460, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.88)');
        ctx.fillStyle = g; ctx.fillRect(0, H - 460, W, 460);
        ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
        ctx.font = '600 24px Helvetica, Arial, sans-serif';
        ctx.fillText('F I R S T   E D I T I O N', W / 2, 88);
        if (nome) { ctx.font = 'bold 52px Helvetica, Arial, sans-serif'; ctx.fillText(nome, W / 2, H - 240); }
        ctx.font = '300 30px Helvetica, Arial, sans-serif';
        ctx.fillText('SAN MARTINO 2.0 — INTO THE WILD', W / 2, H - 185);
        ctx.font = '300 27px Helvetica, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('6,2 KM · +383 M' + (finMin ? ' · ' + formatMin(finMin) : ''), W / 2, H - 135);
        ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 40, H - 108, 80, 3);
        ctx.font = '300 21px Helvetica, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('1 AGOSTO 2026 · SAN MARTINO VALLATA', W / 2, H - 70);
      };

      const mapCanvas = map.getCanvas();
      const INTRO = 3000, OUTRO = 2600;
      let t0 = 0; let flightStarted = false; let outroT = 0; let stopped = false;
      const loop = (t: number) => {
        if (stopped) return;
        if (!t0) t0 = t;
        const el = t - t0;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        if (el < INTRO) {
          if (photo.width) drawCover(photo, photo.width, photo.height, 1 + 0.07 * (el / INTRO));
        } else {
          if (!flightStarted) {
            flightStarted = true;
            setFlying(true); flyingRef.current = true;
            start3dFlight();
          }
          if (flyingRef.current) {
            drawCover(mapCanvas, mapCanvas.width, mapCanvas.height);
          } else {
            if (!outroT) outroT = t;
            if (photo.width) drawCover(photo, photo.width, photo.height, 1.07 - 0.05 * Math.min(1, (t - outroT) / OUTRO));
            if (t - outroT > OUTRO) {
              stopped = true; rec.stop(); return;
            }
          }
        }
        hud();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      const blob = await finito;
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], 'san-martino-into-the-wild.' + ext, { type: blob.type });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try { await nav.share({ files: [file], title: 'San Martino 2.0 — Into the Wild' }); }
        catch { /* annullato: scarica */ downloadBlob(blob, file.name); }
      } else downloadBlob(blob, file.name);
    } catch (e: any) {
      alert('Video non riuscito: ' + (e.message || e));
    } finally {
      setRecording(false);
      svHideNow();
    }
  };
  const downloadBlob = (b: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const tabBtn = (active: boolean) =>
    (active ? 'bg-white text-black' : 'bg-black text-neutral-200 border border-neutral-800') +
    ' flex-1 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition';

  return (
    <div className="animate-fade-in-up">
      <div className="flex gap-2 mt-8">
        <button onClick={() => { stopFly(); svHideNow(); setMode('2d'); }} className={tabBtn(mode === '2d')}>Mappa</button>
        <button onClick={() => { stopFly(); svHideNow(); setMode('3d'); }} className={tabBtn(mode === '3d')}>Vista 3D</button>
      </div>
      {mode === '2d'
        ? <div id="map" className="h-[50vh] overflow-hidden border border-neutral-800 mt-3 grayscale-[0.85] contrast-105" />
        : <div id="map3d" className="h-[55vh] overflow-hidden border border-neutral-800 mt-3" />}
      {svMounted && (
        <div className={'fixed inset-0 z-50 bg-black transition-opacity duration-1000 ' + (svOpaque ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
          <img src="./canonica.jpg" alt="Chiesa di San Martino"
            className="w-full h-full object-cover kenburns" />
          <div className="absolute bottom-10 inset-x-0 text-center pointer-events-none px-14">
            <span className="bg-black/70 text-white text-xs uppercase tracking-[0.25em] px-4 py-2">
              Chiesa di San Martino — partenza e arrivo
            </span>
          </div>
          <button onClick={svHideNow}
            className="absolute top-4 right-4 bg-black/70 border border-neutral-700 text-white w-9 h-9 text-lg">✕</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button onClick={flyover} disabled={recording}
          className="border border-neutral-700 text-white hover:border-white px-3 py-3 font-semibold uppercase tracking-[0.15em] text-xs transition disabled:opacity-40">
          {flying ? 'Ferma il volo' : mode === '3d' ? 'Volo cinematico' : 'Sorvola il percorso'}
        </button>
        <a href="./percorso.gpx" download="san-martino-into-the-wild.gpx"
          className="border border-neutral-700 text-white hover:border-white px-3 py-3 font-semibold uppercase tracking-[0.15em] text-xs transition text-center">
          Scarica GPX
        </a>
      </div>
      {mode === '3d' && (
        <button onClick={recordVideo} disabled={recording || flying}
          className="w-full mt-3 bg-white text-black px-3 py-3.5 font-semibold uppercase tracking-[0.15em] text-xs transition disabled:opacity-50">
          {recording ? 'Registrazione in corso… (~25s)' : 'Crea il tuo video ricordo'}
        </button>
      )}
      {finisherMin !== null && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-6 text-center">
          <div className="medal-pop">
            <div className="medal-ring w-44 h-44 rounded-full border-4 border-white flex flex-col items-center justify-center mx-auto">
              <span className="text-[11px] uppercase tracking-[0.3em] text-neutral-200">San Martino 2.0</span>
              <span className="text-2xl font-bold tracking-tight text-white mt-1">FINISHER</span>
              <span className="text-[11px] uppercase tracking-[0.3em] text-neutral-200 mt-1">First Edition</span>
            </div>
            <p className="text-white text-3xl font-light mt-8 tabular-nums">{formatMin(finisherMin)}</p>
            <p className="text-neutral-300 text-xs uppercase tracking-[0.25em] mt-2">Into the Wild · 6,2 km · +383 m</p>
            <div className="mt-8 space-y-3 w-64 mx-auto">
              <button onClick={() => { setFinisherMin(null); setMode('3d'); }}
                className="w-full bg-white text-black py-3.5 font-semibold uppercase tracking-[0.15em] text-xs">
                Crea il tuo video ricordo
              </button>
              <button onClick={() => setFinisherMin(null)}
                className="w-full border border-neutral-700 text-white py-3.5 font-semibold uppercase tracking-[0.15em] text-xs">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
      <Card className="mt-4">
        <Label>Altimetria</Label>
        <AltimetryProfile doneM={prog && prog.offTrackM <= 250 ? prog.doneM : null} />
      </Card>
      <Card className="mt-4">
        <Label>Il tuo avanzamento</Label>
        {prog ? (
          prog.offTrackM > 250 ? (
            <p className="text-neutral-200 text-sm">
              Sei a {prog.offTrackM >= 1000 ? (prog.offTrackM / 1000).toFixed(1) + ' km' : Math.round(prog.offTrackM) + ' m'} dal sentiero.
              L'avanzamento apparirà quando sarai sul percorso.
            </p>
          ) : (
          <>
            <div className="h-1 bg-neutral-800 overflow-hidden">
              <div className="h-full bg-white transition-all" style={{ width: prog.pct + '%' }} />
            </div>
            <div className="flex justify-between text-sm text-neutral-200 mt-3">
              <span>{(prog.doneM / 1000).toFixed(1)} km fatti</span>
              <span className="font-semibold text-white">{prog.pct}%</span>
              <span>{(prog.remainingM / 1000).toFixed(1)} km rimasti</span>
            </div>
            {prog.offTrackM > 100 && (
              <p className="text-red-400 text-sm mt-3">Attenzione: sei a {Math.round(prog.offTrackM)} m dal sentiero.</p>
            )}
          </>
          )
        ) : (
          <p className="text-neutral-300 text-sm">
            {gpsErr ? 'GPS non disponibile: ' + gpsErr : 'In attesa della posizione GPS…'}
            {' '}Percorso totale: {(TOTAL_M / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} km, dislivello +{ELEVATION_GAIN_M} m.
          </p>
        )}
      </Card>
      {prog && prog.offTrackM <= 250 && (() => {
        const idx = idxAtDistance(prog.doneM);
        const slope = slopeAt(idx);
        const kmh = speedMs !== null ? speedMs * 3.6 : null;
        const pace = speedMs && speedMs > 0.2 ? 1000 / speedMs / 60 : null;
        const etaMin = speedMs && speedMs > 0.2 ? prog.remainingM / speedMs / 60 : null;
        const eta = etaMin !== null ? new Date(Date.now() + etaMin * 60000) : null;
        const stat = (label: string, value: string) => (
          <div key={label}>
            <div className="text-xl font-light text-white tabular-nums">{value}</div>
            <div className="text-[11px] text-neutral-300 uppercase tracking-[0.2em] mt-1">{label}</div>
          </div>
        );
        return (
          <Card className="mt-4">
            <Label>Telemetria</Label>
            <div className="grid grid-cols-3 gap-y-5 text-center">
              {stat('Quota', Math.round(ELES[idx]) + ' m')}
              {stat('Pendenza', (slope > 0 ? '+' : '') + slope.toFixed(0) + '%')}
              {stat('Velocità', kmh !== null ? kmh.toFixed(1) + ' km/h' : '—')}
              {stat('Passo', pace !== null ? Math.floor(pace) + "'" + String(Math.round((pace % 1) * 60)).padStart(2, '0') + '"' : '—')}
              {stat('Salita fatta', '+' + Math.round(GAINS[idx]) + ' m')}
              {stat('Arrivo', eta ? eta.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—')}
            </div>
            <p className="text-[11px] text-neutral-400 mt-4 text-center uppercase tracking-[0.15em]">
              Salita rimanente +{Math.round(GAINS[GAINS.length - 1] - GAINS[idx])} m · stima arrivo sulla tua andatura
            </p>
          </Card>
        );
      })()}
    </div>
  );
}

// ---------- Muro delle foto ----------
async function resizeImage(file: File, maxSide = 1600): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.82));
}

function Foto() {
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [full, setFull] = useState<EventPhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const staffPin = sessionStorage.getItem('sm2_staff_pin') || '';

  const refresh = () => listPhotos().then(setPhotos).catch(() => {});
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000); // il muro si aggiorna da solo
    return () => clearInterval(t);
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg('');
    try {
      const blob = await resizeImage(file);
      const me = getMyTicketId() ? await getParticipant(getMyTicketId()!) : null;
      await uploadPhoto(blob, me?.name || 'Anonimo');
      setMsg('Foto pubblicata!');
      refresh();
    } catch (err: any) { setMsg(friendlyError(err)); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const hide = async (p: EventPhoto) => {
    if (!window.confirm('Nascondere questa foto?')) return;
    try { await hidePhoto(p.id, staffPin); setFull(null); refresh(); }
    catch (e: any) { setMsg(friendlyError(e)); }
  };

  return (
    <div className="space-y-4 animate-fade-in-up pt-8">
      <h1 className="text-2xl font-bold tracking-tight text-white">Il muro delle foto</h1>
      <p className="text-neutral-300 text-sm">
        Scatta lungo il sentiero e pubblica: il muro si aggiorna in diretta per tutti.
      </p>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <Button onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? 'Caricamento…' : 'Scatta o carica una foto'}
      </Button>
      {msg && <p className="text-center text-sm text-neutral-300">{msg}</p>}
      {photos.length === 0 && (
        <p className="text-neutral-400 text-sm text-center pt-6">
          Ancora nessuna foto: sii il primo a pubblicare.
        </p>
      )}
      <div className="grid grid-cols-3 gap-1">
        {photos.map((p) => (
          <button key={p.id} onClick={() => setFull(p)} className="aspect-square overflow-hidden bg-neutral-900">
            <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover hover:opacity-80 transition" />
          </button>
        ))}
      </div>
      {full && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setFull(null)}>
          <img src={full.url} alt="" className="max-h-[75vh] max-w-full object-contain" />
          <p className="text-neutral-200 text-sm mt-3">
            {full.author || 'Anonimo'} · {new Date(full.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {staffPin && (
            <button onClick={(e) => { e.stopPropagation(); hide(full); }}
              className="mt-3 text-xs uppercase tracking-[0.2em] text-red-400 border border-red-900 px-4 py-2">
              Nascondi (staff)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Admin (organizzatori) ----------
function Admin() {
  const [list, setList] = useState<Participant[]>([]);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState('');
  const [pendingCol, setPendingCol] = useState<Participant | null>(null);
  const [colAperta, setColAperta] = useState(false);
  const [query, setQuery] = useState('');
  const lastSeen = useRef<Record<string, number>>({});
  const [pin, setPin] = useState(sessionStorage.getItem('sm2_staff_pin') || '');
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('sm2_staff_pin'));
  const [pinErr, setPinErr] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  useEffect(() => { if (authed) publicStats().then((s) => s && setColAperta(!!s.colazione_aperta)); }, [authed]);
  const toggleColazione = async () => {
    const target = !colAperta;
    if (!window.confirm(target ? 'Aprire la consegna colazioni?' : 'Chiudere la consegna colazioni?')) return;
    try { await setColazioneAperta(target, pin); setColAperta(target); setMsg(target ? 'Colazione APERTA' : 'Colazione chiusa'); }
    catch (e: any) { setMsg(friendlyError(e)); }
  };


  const refresh = () => listParticipants(pin).then(setList).catch(() => {});
  useEffect(() => { if (authed) refresh(); }, [authed]);

  const [logging, setLogging] = useState(false);
  const login = async () => {
    if (logging) return;
    setPinErr(''); setLogging(true);
    try {
      const ok = await Promise.race([
        verifyStaffPin(pin),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Il server non risponde: controlla la connessione e riprova')), 12000)),
      ]);
      if (ok) {
        sessionStorage.setItem('sm2_staff_pin', pin);
        setAuthed(true);
      } else setPinErr('PIN non valido.');
    } catch (e: any) { setPinErr(friendlyError(e)); }
    finally { setLogging(false); }
  };

  // Scanner smart: decide da solo in base allo stato del tagliandino.
  // Check-in: automatico. Colazione: chiede UNA conferma (contro doppie letture).
  const onScan = async (id: string) => {
    if (pendingCol) return; // in attesa di conferma: ignora nuove letture
    const now = Date.now();
    if (lastSeen.current[id] && now - lastSeen.current[id] < 8000) return; // anti doppia lettura
    lastSeen.current[id] = now;
    try {
      const p = await getParticipant(id);
      if (!p) { setMsg('QR non riconosciuto'); return; }
      if (!p.checked_in) {
        await checkIn(id, pin);
        setMsg('✓ Check-in: ' + p.name + ' (' + p.adults + 'A · ' + p.children + 'B)');
      } else if (!p.voucher_used) {
        if (colAperta) { setPendingCol(p); setMsg(''); }
        else setMsg(p.name + ': già in check-in (la colazione non è ancora aperta)');
      } else {
        setMsg(p.name + ': check-in e colazione già registrati');
      }
    } catch (e: any) {
      setMsg((e.message || e).includes('già ritirata') ? 'ATTENZIONE: colazione GIÀ RITIRATA' : 'Errore: ' + (e.message || e));
    }
    refresh();
  };

  const confirmCol = async () => {
    if (!pendingCol) return;
    try {
      await redeemVoucher(pendingCol.id, pin);
      setMsg('🥐 ' + (pendingCol.adults + pendingCol.children) + ' colazioni consegnate a ' + pendingCol.name);
    } catch (e: any) {
      setMsg((e.message || e).includes('già ritirata') ? 'ATTENZIONE: colazione GIÀ RITIRATA' : friendlyError(e));
    }
    setPendingCol(null);
    refresh();
  };

  if (!authed) {
    return (
      <div className="space-y-4 animate-fade-in-up pt-8 max-w-xs mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-white">Staff</h1>
        <p className="text-neutral-300 text-sm">Area riservata ai volontari. Inserisci il PIN staff.</p>
        <input type="password" inputMode="numeric" placeholder="PIN"
          className="w-full bg-black border border-neutral-800 px-4 py-3.5 text-white text-center tracking-[0.5em] focus:outline-none focus:border-white transition"
          value={pin} onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()} />
        {pinErr && <p className="text-red-400 text-sm text-center">{pinErr}</p>}
        <Button onClick={login} disabled={logging}>{logging ? 'Verifica in corso…' : 'Entra'}</Button>
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

  // Piano B: check-in e colazione MANUALI dalla lista (per chi arriva senza QR)
  const manual = async (what: 'in' | 'col', p: Participant) => {
    const domanda = what === 'in'
      ? 'Registrare il check-in di ' + p.name + ' (' + p.adults + 'A · ' + p.children + 'B)?'
      : 'Consegnare la colazione a ' + p.name + ' (' + p.adults + 'A · ' + p.children + 'B)?';
    if (!window.confirm(domanda)) return;
    try {
      if (what === 'in') await checkIn(p.id, pin);
      else await redeemVoucher(p.id, pin);
      setMsg((what === 'in' ? 'Check-in manuale: ' : 'Colazione consegnata (manuale) a ') + p.name);
    } catch (e: any) {
      setMsg((e.message || String(e)).includes('già ritirata') ? 'ATTENZIONE: colazione GIÀ RITIRATA' : friendlyError(e));
    }
    refresh();
  };

  const undo = async (p: Participant) => {
    const flag = p.voucher_used ? 'colazione' : 'checkin';
    const domanda = flag === 'colazione'
      ? 'Annullare la CONSEGNA COLAZIONE di ' + p.name + '? (registrata per errore)'
      : 'Annullare il CHECK-IN di ' + p.name + '?';
    if (!window.confirm(domanda)) return;
    try { await resetFlag(p.id, flag, pin); setMsg('Annullato (' + flag + '): ' + p.name); }
    catch (e: any) { setMsg(friendlyError(e)); }
    refresh();
  };

  const cancel = async (p: Participant) => {
    if (!window.confirm('Annullare l\'iscrizione di ' + p.name + '?')) return;
    try { await cancelParticipant(p.id, pin); setMsg('Iscrizione annullata: ' + p.name); }
    catch (e: any) { setMsg(friendlyError(e)); }
    refresh();
  };

  const totAdulti = list.reduce((s, p) => s + p.adults, 0);
  const totBimbi = list.reduce((s, p) => s + p.children, 0);

  // Export CSV per chi prepara la colazione (separatore ; e BOM per Excel italiano)
  const exportCsv = () => {
    const righe = [
      ['Nome', 'Contatto', 'Adulti', 'Bambini', 'Note/intolleranze', 'Check-in', 'Colazione', 'Iscritto il'],
      ...list.map((p) => [
        p.name, p.contact, p.adults, p.children, p.notes || '',
        p.checked_in ? 'SI' : 'no', p.voucher_used ? 'SI' : 'no',
        new Date(p.created_at).toLocaleString('it-IT'),
      ]),
      [],
      ['Totale iscrizioni', list.length],
      ['Totale persone', totAdulti + totBimbi],
      ['di cui adulti', totAdulti],
      ['di cui bambini', totBimbi],
    ];
    const csv = '\uFEFF' + righe.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'iscritti-san-martino-2.0.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const tabBtn = (active: boolean) =>
    (active ? 'bg-white text-black' : 'bg-black text-neutral-200 border border-neutral-800') +
    ' flex-1 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition';

  return (
    <div className="space-y-5 animate-fade-in-up pt-8">
      <h1 className="text-2xl font-bold tracking-tight text-white">Staff</h1>
      <Card>
        <div className="grid grid-cols-3 text-center">
          <div><div className="text-2xl font-light text-white">{list.length}</div><div className="text-[11px] text-neutral-300 uppercase tracking-[0.2em] mt-1">iscrizioni</div></div>
          <div><div className="text-2xl font-light text-white">{totAdulti + totBimbi}</div><div className="text-[11px] text-neutral-300 uppercase tracking-[0.2em] mt-1">partecipanti</div></div>
          <div><div className="text-2xl font-light text-white">{list.filter((p) => p.voucher_used).length}</div><div className="text-[11px] text-neutral-300 uppercase tracking-[0.2em] mt-1">colazioni</div></div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-neutral-300 text-xs pr-3">
            Scanner automatico: primo passaggio = check-in{colAperta ? ', secondo = colazione (con conferma)' : ''}.
          </p>
          <button onClick={toggleColazione}
            className={(colAperta ? 'bg-white text-black' : 'bg-black text-neutral-200 border border-neutral-700') + ' shrink-0 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition'}>
            {colAperta ? 'Colazione aperta' : 'Colazione chiusa'}
          </button>
        </div>
        <div id="scanner" className="overflow-hidden" />
        {pendingCol && (
          <div className="border border-neutral-700 p-4 my-3 text-center space-y-3">
            <p className="text-white font-semibold">{pendingCol.name}</p>
            <p className="text-neutral-200 text-sm">
              Check-in già fatto · consegnare <span className="text-white">{pendingCol.adults + pendingCol.children} colazioni</span>
              {pendingCol.notes ? <> · <span className="text-white">{pendingCol.notes}</span></> : null}?
            </p>
            <div className="flex gap-2">
              <button onClick={confirmCol}
                className="flex-1 bg-white text-black py-3 font-semibold uppercase tracking-[0.15em] text-xs">Consegna</button>
              <button onClick={() => setPendingCol(null)}
                className="flex-1 border border-neutral-700 text-white py-3 font-semibold uppercase tracking-[0.15em] text-xs">Annulla</button>
            </div>
          </div>
        )}
        {msg && <p className="text-center text-white font-semibold my-3 text-sm">{msg}</p>}
        <Button onClick={scanning ? stopScan : startScan}>
          {scanning ? 'Spegni fotocamera' : 'Accendi scanner'}
        </Button>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <Label>Iscritti</Label>
          <button onClick={exportCsv} disabled={list.length === 0}
            className="text-xs uppercase tracking-[0.15em] border border-neutral-700 text-white hover:border-white px-3 py-1.5 transition disabled:opacity-30">
            Esporta CSV
          </button>
        </div>
        {list.length === 0 && <p className="text-neutral-400 text-sm">Nessuna iscrizione ancora.</p>}
        {list.length > 0 && (
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca nome o contatto…"
            className="w-full bg-black border border-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white transition mb-2" />
        )}
        <ul className="divide-y divide-neutral-800 text-sm">
          {list.filter((p) => (p.name + ' ' + p.contact).toLowerCase().includes(query.toLowerCase())).map((p) => (
            <li key={p.id} className="py-3 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="text-white truncate">{p.name}</div>
                <div className="text-neutral-300 text-xs truncate">{p.adults}A · {p.children}B{p.notes ? ' · ' + p.notes : ''}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => manual('in', p)} disabled={p.checked_in} title="Check-in manuale"
                  className={(p.checked_in ? 'text-white border-neutral-800' : 'text-neutral-200 border-neutral-700 hover:text-white hover:border-white') + ' border px-2 py-1 text-[11px] uppercase tracking-[0.1em] transition disabled:cursor-default'}>
                  {p.checked_in ? '● in' : 'in'}
                </button>
                <button onClick={() => manual('col', p)} disabled={p.voucher_used} title="Colazione manuale"
                  className={(p.voucher_used ? 'text-white border-neutral-800' : 'text-neutral-200 border-neutral-700 hover:text-white hover:border-white') + ' border px-2 py-1 text-[11px] uppercase tracking-[0.1em] transition disabled:cursor-default'}>
                  {p.voucher_used ? '● col' : 'col'}
                </button>
                {(p.checked_in || p.voucher_used) && (
                  <button onClick={() => undo(p)} title="Annulla ultimo stato (errore)"
                    className="text-neutral-400 hover:text-white border border-neutral-800 px-2 py-1 text-xs transition">↺</button>
                )}
                <button onClick={() => cancel(p)} title="Annulla iscrizione"
                  className="text-neutral-400 hover:text-red-400 border border-neutral-800 px-2 py-1 text-xs transition">✕</button>
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
    <div className="space-y-5 animate-fade-in-up pt-8 text-sm text-neutral-300 leading-relaxed">
      <h1 className="text-2xl font-bold tracking-tight text-white">Informativa privacy</h1>
      <p className="text-neutral-300 text-xs uppercase tracking-[0.2em]">Ai sensi del Reg. UE 2016/679 (GDPR)</p>
      <Card><Label>Titolare del trattamento</Label>
        <p>APS San Martino 2.0 — The Valley, San Martino Vallata, Polinago (MO). Per esercitare i tuoi diritti contatta l'associazione tramite i canali dell'evento.</p></Card>
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
  const [light, setLight] = useState(localStorage.getItem('sm2_theme') === 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
    localStorage.setItem('sm2_theme', light ? 'light' : 'dark');
  }, [light]);
  const nav: { v: View; label: string }[] = [
    { v: 'home', label: 'Evento' },
    { v: 'iscrizione', label: 'Iscriviti' },
    { v: 'tagliandino', label: 'Ticket' },
    { v: 'mappa', label: 'Percorso' },
    { v: 'foto', label: 'Foto' },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <button onClick={() => setLight(!light)} title={light ? 'Tema scuro' : 'Tema chiaro'}
        className="fixed top-3 right-3 z-40 w-10 h-10 border border-neutral-700 bg-black text-white text-lg leading-none">
        {light ? '🌙' : '☀️'}
      </button>
      <main className="max-w-lg mx-auto px-5 pb-28">
        <Guardia>
        {view === 'home' && <Landing go={setView} />}
        {view === 'iscrizione' && <Iscrizione go={setView} />}
        {view === 'tagliandino' && <Tagliandino />}
        {view === 'mappa' && <Mappa />}
        {view === 'foto' && <Foto />}
        {view === 'admin' && <Admin />}
        {view === 'privacy' && <Privacy go={setView} />}
        </Guardia>
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-black/95 backdrop-blur border-t border-neutral-800">
        <div className="max-w-lg mx-auto flex items-stretch">
          {nav.map((n) => (
            <button key={n.v} onClick={() => setView(n.v)}
              className={'flex-1 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.15em] transition ' +
                (view === n.v ? 'text-white border-t-2 border-white -mt-px' : 'text-neutral-400')}>
              {n.label}
            </button>
          ))}
          <button onClick={() => setView('admin')} title="Area staff" aria-label="Area staff"
            className={'w-12 shrink-0 py-4 flex items-center justify-center transition ' +
              (view === 'admin' ? 'text-white border-t-2 border-white -mt-px' : 'text-neutral-400')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="9" rx="1" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </button>
        </div>
      </nav>
    </div>
  );
}
