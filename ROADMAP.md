# Roadmap di Diario Stoico

Il documento completo delle specifiche è [SPEC.md](SPEC.md) (fonte di verità). Qui c'è solo lo stato delle fasi.
Si passa alla fase successiva solo dopo qualche giorno di uso reale sul telefono.

| Fase | Contenuto | Stato |
| --- | --- | --- |
| 1 | Il diario che funziona: pagina «Oggi», editor, salvataggio automatico, tema carta/scuro, PWA offline, export/import JSON | **Costruita** — in attesa della prova sul telefono (tag `fase-1`) |
| 2 | Blocco con impronta (WebAuthn) + PIN, calendario mensile, vai a data, cronologia, modalità lettura, ricerca | **Costruita** (versione 2.0) — in attesa della prova sul telefono (tag `fase-2`) |
| 3 | Obiettivi (giorno, settimana, mese, anno), striscia «Oggi» spuntabile, cascata, chiusura guidata | **Costruita** (versione 3.0) — in attesa della prova sul telefono (tag `fase-3`) |
| 4 | Moduli attivabili (premeditatio, esame serale, virtù, dicotomia del controllo, umore, negative visualization, citazione) e moduli personalizzati | **Costruita** (versione 4.0) — in attesa della prova sul telefono (tag `fase-4`) |
| 5 | Ricorrenze, revisioni settimanali e mensili, menzione degli obiettivi nelle voci, export Markdown | Da fare |
| 6 | Rifiniture secondo l'uso reale (accento, modelli di giornata, trascinamento moduli, filtri, preferiti, cifratura, notifiche) | Da fare |

Fase 1 pubblicata e installata sull'S25 il 13 ottobre 2026. Prima della Fase 2 si aspettano alcuni giorni di uso reale.

### Note dalla prima prova (13 ottobre 2026)

- Corretti: «null» nell'avviso del backup, cursore coperto dalla barra di formattazione, tasto «indietro» con conferma di uscita.
- Pulsante «Aggiorna» dell'avviso di aggiornamento ridisegnato (era poco gradevole).

## Scelte concordate (Fase 4)

- I moduli appartengono alla **giornata intera**, non alla singola voce (un solo esame serale per giorno).
- All'inizio è attiva solo la striscia degli **obiettivi** (come prima dei moduli); gli altri si accendono dalle Impostazioni o con «+ Aggiungi modulo».
- Un modulo tuo si **archivia**, non si elimina: i dati restano (e si leggono nei giorni passati).
- Frase del giorno (ex «citazione di apertura»): dalla 4.2, 366 frasi alla lettera da testi liberi da diritti (vedi `CITAZIONI.md`), accesa di base in cima a «Oggi».
- Tre **modelli pronti** di moduli tuoi (Prima impressione, Persone difficili, Principio a portata di mano), spenti di base.
- Tono: niente punteggi né serie di giorni; umore ed energia con cinque parole sobrie; l'esame serale ricorda che il passato serve a imparare.
- L'ordine dei moduli, in 4.0 fisso, si sceglie dalla 4.1 con le frecce (il trascinamento resta alla Fase 6). Nessuna migrazione: lo schema del database resta alla versione 1.

## Scelte concordate (Fase 3)

- Un periodo si sceglie («questa settimana», «ottobre»), non si scrivono le date. Settimana da lunedì.
- Cascata: il genitore ha un orizzonte più lungo e il suo periodo contiene la data di **inizio** del figlio (una settimana appartiene al mese in cui
  comincia); si può saltare un livello.
- Chiusura guidata proposta solo per **settimane, mesi e anni** (mai per i giorni) e solo per periodi finiti da **non più di 60 giorni**.
  (I due valori stanno in `js/goals-policy.js`.)
- «Rimandato»: l'obiettivo **si sposta** al periodo successivo e torna «da fare» (dalla 3.3; prima nasceva una copia). La riflessione è facoltativa.
- Eliminando un obiettivo, i sotto-obiettivi restano senza genitore.
- La striscia in Oggi non compare nella modalità lettura dei giorni passati.
- La menzione degli obiettivi nelle voci del diario resta alla Fase 5.
- Nessuna migrazione: lo schema del database resta alla versione 1.

## Scelte concordate (Fase 2)

- Con l'impronta attiva, quella è lo sblocco normale; il PIN è solo la riserva (se l'impronta non viene riconosciuta o non c'è).
- Il diario si richiude dopo più di un minuto in background; il contenuto è coperto appena si esce dall'app.
- PIN e impronta non finiscono nei backup e l'importazione non li tocca.
- «Esci» dal tasto indietro non può chiudere una PWA: si mostra «Premi ancora indietro per uscire».
- Nessuna migrazione: lo schema del database resta alla versione 1.

## Scelte concordate (Fase 1)

- JavaScript puro con moduli ES, senza passaggio di build.
- Editor fatto a mano (`contenteditable`); il testo si salva come sottoinsieme di Markdown, non come HTML.
- Blocco con impronta rimandato alla Fase 2.
- Repository pubblico: i file di backup (`diario-stoico-*.json`) sono esclusi da `.gitignore`.

## Già pronto nel database per le fasi future

Il database ha già gli archivi `days`, `moduleDefs`, `moduleInstances`, `goals` e `goalLinks` (vuoti), e il record
delle impostazioni ha già i campi per blocco, PIN, moduli e colore d'accento. Aggiungere una funzione di una fase
successiva non richiede di riscrivere ciò che c'è: se serve cambiare la struttura si aggiunge una migrazione in
`js/migrations.js`.
