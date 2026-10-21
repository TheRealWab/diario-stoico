// Quanto ci mette ad aprirsi una schermata, dal tocco al disegno. Serve solo a capire se qualcosa è lento
// (si legge in Impostazioni → Informazioni): non viene salvato né mandato da nessuna parte.

const KEEP = 6;
const recent = [];
let tapAt = null;

/** Da chiamare appena si tocca per cambiare schermata. */
export function markTap() {
  tapAt = performance.now();
}

/** Il momento del tocco (una sola volta), oppure adesso se la schermata si apre senza un tocco. */
export function takeTap() {
  const t = tapAt ?? performance.now();
  tapAt = null;
  return t;
}

export function recordTiming(name, ms) {
  recent.unshift({ name, ms: Math.round(ms) });
  recent.length = Math.min(recent.length, KEEP);
}

export const recentTimings = () => recent.slice();
