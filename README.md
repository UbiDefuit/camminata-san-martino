# Camminata sui Sentieri di San Martino — App evento (prototipo)

PWA per la gestione del ciclo di vita dell'evento: promozione, adesioni,
tagliandino colazione con QR code, mappa del percorso con GPS e avanzamento.
Costruita con lo **stesso stack di FamilyLoop**: React 19 + TypeScript, Vite,
Tailwind CSS, Supabase (con RLS), PWA (manifest + service worker).

## Avvio rapido

```bash
npm install
npm run dev        # http://localhost:3000
```

Senza configurazione l'app parte in **modalità demo**: le iscrizioni vengono
salvate in localStorage, tutto funziona su un solo dispositivo (utile per provare).

## Modalità completa (Supabase)

1. Crea un progetto su supabase.com (piano gratuito)
2. Esegui `database.sql` nel SQL Editor
3. Copia `.env.example` in `.env` e inserisci `SUPABASE_URL` e `SUPABASE_ANON_KEY`
4. `npm run dev`

## Le 5 sezioni

- **Evento** — landing promozionale con countdown e programma
- **Iscriviti** — form adesioni con consenso privacy/riprese
- **Tagliandino** — QR personale: check-in alla partenza + colazione al ristoro
- **Percorso** — mappa OpenStreetMap con tracciato, POI, posizione GPS,
  barra di avanzamento (km fatti/rimanenti, % completata) e avviso fuori sentiero
- **Staff** — contatori iscritti/colazioni, scanner QR (check-in e riscatto), elenco iscritti

## Tracciato reale

Il tracciato attuale in `utils/track.ts` è dimostrativo. Registra il sentiero
con Komoot/Wikiloc/OsmAnd, esporta il GPX e sostituisci i punti `[lat, lon]`
nell'array `TRACK` (e aggiorna i POI).

## Note

- Le tile della mappa vengono messe in cache dal service worker: aprire la
  mappa una volta con connessione per poterla usare offline sul sentiero.
- In produzione, limitare la policy di UPDATE (check-in/riscatto) allo staff
  autenticato — vedi commento in `database.sql`.
