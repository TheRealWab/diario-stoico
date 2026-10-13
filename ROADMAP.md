# Roadmap di Diario Stoico

Il documento completo delle specifiche è [SPEC.md](SPEC.md) (fonte di verità). Qui c'è solo lo stato delle fasi.
Si passa alla fase successiva solo dopo qualche giorno di uso reale sul telefono.

| Fase | Contenuto | Stato |
| --- | --- | --- |
| 1 | Il diario che funziona: pagina «Oggi», editor, salvataggio automatico, tema carta/scuro, PWA offline, export/import JSON | **Costruita** — in attesa della prova sul telefono (tag `fase-1`) |
| 2 | Blocco con impronta (WebAuthn) + PIN, calendario mensile, vai a data, cronologia, modalità lettura, ricerca | Da fare |
| 3 | Obiettivi (giorno, settimana, mese, anno), striscia «Oggi» spuntabile, cascata, chiusura guidata | Da fare |
| 4 | Moduli attivabili (premeditatio, esame serale, virtù, dicotomia del controllo, umore, negative visualization, citazione) e moduli personalizzati | Da fare |
| 5 | Ricorrenze, revisioni settimanali e mensili, menzione degli obiettivi nelle voci, export Markdown | Da fare |
| 6 | Rifiniture secondo l'uso reale (accento, modelli di giornata, trascinamento moduli, filtri, preferiti, cifratura, notifiche) | Da fare |

Fase 1 pubblicata e installata sull'S25 il 13 ottobre 2026. Prima della Fase 2 si aspettano alcuni giorni di uso reale.

### Note dalla prima prova (13 ottobre 2026)

- Corretti: «null» nell'avviso del backup, cursore coperto dalla barra di formattazione, tasto «indietro» con conferma di uscita.
- Pulsante «Aggiorna» dell'avviso di aggiornamento ridisegnato (era poco gradevole).

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
