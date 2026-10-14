# Roadmap di Diario Stoico

Il documento completo delle specifiche è [SPEC.md](SPEC.md) (fonte di verità). Qui c'è solo lo stato delle fasi.
Si passa alla fase successiva solo dopo qualche giorno di uso reale sul telefono.

| Fase | Contenuto | Stato |
| --- | --- | --- |
| 1 | Il diario che funziona: pagina «Oggi», editor, salvataggio automatico, tema carta/scuro, PWA offline, export/import JSON | **Costruita** — in attesa della prova sul telefono (tag `fase-1`) |
| 2 | Blocco con impronta (WebAuthn) + PIN, calendario mensile, vai a data, cronologia, modalità lettura, ricerca | **Costruita** (versione 2.0) — in attesa della prova sul telefono (tag `fase-2`) |
| 3 | Obiettivi (giorno, settimana, mese, anno), striscia «Oggi» spuntabile, cascata, chiusura guidata | **Costruita** (versione 3.0) — in attesa della prova sul telefono (tag `fase-3`) |
| 4 | Moduli attivabili (premeditatio, esame serale, virtù, dicotomia del controllo, umore, negative visualization, citazione) e moduli personalizzati | Da fare |
| 5 | Ricorrenze, revisioni settimanali e mensili, menzione degli obiettivi nelle voci, export Markdown | Da fare |
| 6 | Rifiniture secondo l'uso reale (accento, modelli di giornata, trascinamento moduli, filtri, preferiti, cifratura, notifiche) | Da fare |

Fase 1 pubblicata e installata sull'S25 il 13 ottobre 2026. Prima della Fase 2 si aspettano alcuni giorni di uso reale.

### Note dalla prima prova (13 ottobre 2026)

- Corretti: «null» nell'avviso del backup, cursore coperto dalla barra di formattazione, tasto «indietro» con conferma di uscita.
- Pulsante «Aggiorna» dell'avviso di aggiornamento ridisegnato (era poco gradevole).

## Scelte concordate (Fase 3)

- Un periodo si sceglie («questa settimana», «ottobre»), non si scrivono le date. Settimana da lunedì.
- Cascata: il genitore ha un orizzonte più lungo e il suo periodo contiene la data di **inizio** del figlio (una settimana appartiene al mese in cui
  comincia); si può saltare un livello.
- Chiusura guidata proposta solo per **settimane, mesi e anni** (mai per i giorni) e solo per periodi finiti da **non più di 60 giorni**.
  (I due valori stanno in `js/goals-policy.js`.)
- «Rimandato»: si può riportare l'obiettivo al periodo successivo (copia nuova, l'originale resta). La riflessione è facoltativa.
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
