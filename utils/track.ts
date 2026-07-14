// Tracciato dimostrativo del sentiero di San Martino (Vallata di Polinago).
// Da sostituire con il GPX reale registrato durante il sopralluogo:
// basta esportare i punti [lat, lon] nello stesso formato.
export const TRACK: [number, number][] = [
  [44.3437, 10.7245], [44.3448, 10.7261], [44.3461, 10.7278], [44.3476, 10.7290],
  [44.3492, 10.7297], [44.3508, 10.7308], [44.3520, 10.7325], [44.3529, 10.7346],
  [44.3541, 10.7362], [44.3556, 10.7371], [44.3571, 10.7366], [44.3583, 10.7349],
  [44.3590, 10.7327], [44.3594, 10.7303], [44.3590, 10.7278], [44.3579, 10.7258],
  [44.3565, 10.7243], [44.3549, 10.7231], [44.3532, 10.7222], [44.3514, 10.7215],
  [44.3496, 10.7212], [44.3478, 10.7215], [44.3462, 10.7222], [44.3449, 10.7232],
  [44.3437, 10.7245],
];

export interface POI { pos: [number, number]; label: string; icon: string; }
export const POIS: POI[] = [
  { pos: TRACK[0], label: 'Chiesa di San Martino — ritrovo 6:30 e partenza 7:00', icon: '🚩' },
  { pos: TRACK[6], label: 'Area ripulita dai volontari', icon: '🌲' },
  { pos: TRACK[11], label: 'Punto panoramico', icon: '📷' },
  
  { pos: TRACK[TRACK.length - 1], label: 'Rientro alla chiesa — colazione per tutti (offerta libera)', icon: '🥐' },
];

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Distanze cumulative lungo il tracciato
const cum: number[] = [0];
for (let i = 1; i < TRACK.length; i++) cum.push(cum[i - 1] + haversine(TRACK[i - 1], TRACK[i]));
export const TOTAL_M = cum[cum.length - 1];

// Proietta la posizione GPS sul tracciato e restituisce l'avanzamento.
export function progressOnTrack(pos: [number, number]) {
  let best = { dist: Infinity, along: 0 };
  for (let i = 1; i < TRACK.length; i++) {
    const a = TRACK[i - 1], b = TRACK[i];
    // proiezione approssimata sul segmento in coordinate piane locali
    const ax = a[1], ay = a[0], bx = b[1], by = b[0], px = pos[1], py = pos[0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const proj: [number, number] = [ay + t * dy, ax + t * dx];
    const d = haversine(pos, proj);
    if (d < best.dist) best = { dist: d, along: cum[i - 1] + t * haversine(a, b) };
  }
  return {
    offTrackM: best.dist,               // distanza dal sentiero
    doneM: best.along,                  // metri percorsi
    remainingM: TOTAL_M - best.along,   // metri rimanenti
    pct: Math.round((best.along / TOTAL_M) * 100),
  };
}
