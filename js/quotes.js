// Frasi brevi. Due elenchi:
//  - QUOTES: parafrasi mie di idee stoiche, per la schermata di blocco (nessuna citazione di testi protetti);
//  - EPITTETO: frasi dal «Manuale» di Epitteto nella traduzione di Giacomo Leopardi (1825), libera da diritti,
//    riportate alla lettera (solo la tipografia è ritoccata) e sempre con l'attribuzione.

import { daysBetween } from './dates.js';

export const QUOTES = [
  'Occupati di ciò che dipende da te. Il resto, lascialo andare.',
  'Non sono le cose a turbarti, ma il giudizio che ne dai.',
  'Fai bene ciò che hai davanti, adesso.',
  'Ogni giorno è una piccola vita: spendila con attenzione.',
  'Un ostacolo può diventare la strada.',
  'Calma nelle parole, fermezza nei gesti.',
  'Comincia da un passo, poi dal successivo.',
  'Scegli la tua risposta: è l’unica cosa interamente tua.',
];

export const randomQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];

export const EPITTETO_SOURCE = 'Epitteto, Manuale (trad. di G. Leopardi)';

export const EPITTETO = [
  'Tu non déi cercare che le cose procedano a modo tuo, ma voler che elle vadano così come fanno, e bene starà.',
  'Gli uomini sono agitati e turbati, non dalle cose, ma dalle opinioni ch’eglino hanno delle cose.',
  'Non dire mai di cosa veruna: io l’ho perduta; ma bene: io l’ho restituita.',
  'Ogni cosa ha, per maniera di dire, due manichi: a pigliarla dall’uno, ella si sopporta, dall’altro no.',
  'A ciascuna apparenza che ti occorrerà nella vita, innanzi ad ogni altra cosa avvézzati a dire: questa è un’apparenza, e non è punto quello che mostra di essere.',
  'Siccome, andando per le vie, tu hai l’occhio a non calpestare un chiodo e a non ti storcere un piede, così abbi cura di non fare pregiudizio alla parte principale di te medesimo.',
  'Misura dello avere si è a ciascheduno il proprio corpo, siccome della scarpa il piede.',
  'Stabilisci a te stesso, come a dire, un carattere e una figura la quale tu abbi a mantenere da quindi innanzi sì praticando teco stesso e sì comunicando colle persone.',
  'Tu puoi essere invitto, e ciò è se tu non ti metterai a nessun arringo dal quale tu non abbia in tua facoltà di riuscire colla vittoria.',
  'Ciascun proponimento che tu farai vuolsi osservare e mantenere come fosse una legge e un punto di religione.',
  'Incomincia adunque insino da ora a studiare di vivere da uomo perfetto e che cresce in virtù; e tutto quello che ti parrà essere il migliore, siati in luogo di legge inviolabile.',
  'Se tu vuoi non desiderare cosa che poi non ti venga ottenuta, questo sì che lo puoi.',
  'Sovvengati che tu non sei qui altro che attore di un dramma, il quale sarà o breve o lungo, secondo la volontà del poeta.',
  'Qualora tu pigli a far che che sia, rècati a mente la qualità di quella cotale operazione.',
];

/** Le citazioni di apertura: { text, source } (source è null per le frasi mie). */
export const OPENING_QUOTES = Object.freeze([
  ...QUOTES.map((text) => ({ text, source: null })),
  ...EPITTETO.map((text) => ({ text, source: EPITTETO_SOURCE })),
]);

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
// un passo coprimo con il numero di frasi: si passano tutte, mai la stessa due giorni di fila, senza l'ordine dell'elenco
const STEP = [7, 5, 3, 1].find((s) => gcd(s, OPENING_QUOTES.length) === 1);

/** La citazione del giorno: la stessa per tutto il giorno, diversa dal giorno prima e dal giorno dopo (senza usare il caso). */
export function quoteForDate(date) {
  const n = daysBetween('2026-01-01', date);
  return OPENING_QUOTES[(((n * STEP) % OPENING_QUOTES.length) + OPENING_QUOTES.length) % OPENING_QUOTES.length];
}
