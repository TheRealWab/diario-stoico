// Quando serve sbloccare di nuovo: solo se l'app è rimasta in background più di un minuto.
// (Appena si esce dall'app il contenuto viene comunque coperto: vedi lockscreen.js.)

export const GRACE_MS = 60_000;

export function shouldRelock({ lockEnabled, hiddenAt, now, graceMs = GRACE_MS }) {
  if (!lockEnabled || hiddenAt === null || hiddenAt === undefined) return false;
  const away = now - hiddenAt;
  return away > graceMs || away < 0; // un orologio che torna indietro è sospetto: si blocca
}
