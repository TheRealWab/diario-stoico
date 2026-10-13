// Frasi brevi per la schermata di blocco: parafrasi mie di idee stoiche, senza citazioni di testi protetti.

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
