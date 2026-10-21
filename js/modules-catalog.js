// Catalogo dei moduli già pronti. Vive nel codice (non nel database): così i testi si possono migliorare con un
// aggiornamento senza toccare i dati. Nel database restano solo i dati scritti dall'utente e i moduli creati da lui.
//
// `slot`: dove sta nella pagina del giorno, rispetto alle voci: 'top' sopra, 'bottom' sotto. L'ordine qui sotto è quello della pagina.
// `type`: come si disegna e come sono fatti i dati (vedi views/modulebody.js e modules.js).
// Tutti i testi sono scritti per questa app, con tono descrittivo: niente punteggi, niente colpe.

export const BUILTIN_MODULES = Object.freeze([
  {
    id: 'quote',
    name: 'Frase del giorno',
    blurb: 'Una frase al giorno, di un filosofo antico, per cominciare: con autore e fonte.',
    type: 'quote',
    slot: 'top',
  },
  {
    id: 'goals',
    name: 'Obiettivi',
    blurb: 'Gli obiettivi del giorno e della settimana, da spuntare senza uscire dal diario.',
    type: 'goals',
    slot: 'top',
  },
  {
    id: 'premeditatio',
    name: 'Premeditatio',
    blurb: 'Prepararti a ciò che potrebbe andare storto, con una risposta già pensata.',
    prompt: 'Che cosa potrebbe andare storto oggi? E come voglio rispondere?',
    type: 'premeditatio',
    slot: 'top',
  },
  {
    id: 'negvis',
    name: 'Negative visualization',
    blurb: 'Immaginare di perdere ciò che dai per scontato, per accorgerti di quanto vale.',
    prompt: 'Immagina di perdere qualcosa che oggi dai per scontato, anche una cosa piccola.',
    type: 'negvis',
    slot: 'top',
  },
  {
    id: 'control',
    name: 'Dicotomia del controllo',
    blurb: 'Separare ciò che dipende da te da ciò che non dipende da te.',
    prompt: 'Pensa a un momento della giornata: che cosa dipendeva da te, e che cosa no?',
    type: 'control',
    slot: 'bottom',
  },
  {
    id: 'virtues',
    name: 'Virtù del giorno',
    blurb: 'Saggezza, giustizia, coraggio, temperanza: quale hai esercitato, quale vuoi curare.',
    prompt: 'Quale virtù hai avuto modo di esercitare oggi? E quale vuoi curare domani?',
    type: 'virtues',
    slot: 'bottom',
  },
  {
    id: 'mood',
    name: 'Umore ed energia',
    blurb: 'Come stai, con un tocco. Serve solo a ritrovarlo più avanti, non a giudicarti.',
    prompt: 'Com’è la giornata, adesso?',
    type: 'mood',
    slot: 'bottom',
  },
  {
    id: 'evening',
    name: 'Esame serale',
    blurb: 'Tre domande per ripensare alla giornata prima di chiuderla.',
    prompt: 'Ripensa alla giornata con calma, come faresti con un amico.',
    type: 'evening',
    slot: 'bottom',
  },
]);

export const BUILTIN_IDS = Object.freeze(BUILTIN_MODULES.map((m) => m.id));
export const isBuiltinId = (id) => BUILTIN_IDS.includes(id);

// Dati senza campi da compilare: non hanno istanze nel database.
export const NO_DATA_TYPES = Object.freeze(['quote', 'goals']);

export const VIRTUES = Object.freeze([
  { id: 'saggezza', name: 'Saggezza', hint: 'vedere le cose per quello che sono' },
  { id: 'giustizia', name: 'Giustizia', hint: 'dare agli altri ciò che spetta' },
  { id: 'coraggio', name: 'Coraggio', hint: 'fare ciò che è giusto anche quando costa' },
  { id: 'temperanza', name: 'Temperanza', hint: 'misura nei desideri e nelle reazioni' },
]);

// Cinque parole sobrie, dal più basso al più alto: nessun numero e nessun giudizio.
export const MOOD_WORDS = Object.freeze(['Pesante', 'Giù', 'Così così', 'Bene', 'Sereno']);
export const ENERGY_WORDS = Object.freeze(['Scarica', 'Bassa', 'Media', 'Buona', 'Piena']);

// L'esame serale ha due versioni: sono le due formule che gli antichi usavano davvero.
export const EVENING_VARIANTS = Object.freeze([
  {
    id: 'seneca',
    name: 'Versione Seneca',
    questions: ['Quale mia debolezza ho curato oggi?', 'A quale cattiva abitudine ho resistito?', 'In che cosa sono migliorato?'],
  },
  {
    id: 'epitteto',
    name: 'Versione Epitteto',
    questions: ['Dove non sono stato all’altezza?', 'Che cosa ho fatto di giusto?', 'Che cosa mi resta da fare?'],
  },
]);
export const EVENING_FOOTNOTE = 'Il passato non dipende da te: guardalo per imparare, non per punirti.';

export const CUSTOM_TYPES = Object.freeze(['text', 'checklist', 'rating', 'choice']);
export const CUSTOM_TYPE_LABEL = Object.freeze({
  text: 'Testo libero',
  checklist: 'Elenco spuntabile',
  rating: 'Valutazione da 1 a 5',
  choice: 'Scelta tra opzioni',
});

// Modelli pronti: nascono come moduli personalizzati normali (si possono modificare e archiviare) e spenti di base.
export const TEMPLATES = Object.freeze([
  {
    key: 'impressione',
    name: 'Prima impressione',
    prompt: 'Che cosa ho sentito per primo? È un mio giudizio? Dipende da me?',
    type: 'text',
    options: [],
    blurb: 'Fermarti un attimo tra ciò che ti succede e ciò che ne pensi.',
  },
  {
    key: 'persone',
    name: 'Persone difficili',
    prompt: 'Chi potrei incontrare oggi che mi metterà alla prova? Come voglio comportarmi?',
    type: 'text',
    options: [],
    blurb: 'Prepararti agli incontri della giornata con calma.',
  },
  {
    key: 'principio',
    name: 'Principio a portata di mano',
    prompt: 'Una frase breve da tenere con me oggi.',
    type: 'text',
    options: [],
    blurb: 'Una regola tua, da rileggere quando serve.',
  },
]);

export const LIMITS = Object.freeze({
  name: 60,
  prompt: 200,
  option: 40,
  optionsMax: 8,
  text: 4000,
  line: 300,
  itemsMax: 30,
  casesMax: 3,
  dataBytes: 200_000,
});
