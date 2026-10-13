# Cronologia delle versioni

La versione si vede in *Impostazioni → Informazioni*. Gli aggiornamenti piccoli fanno 1.1, 1.2, 1.3…;
quelli grandi (di solito una nuova fase) fanno il salto: 2.0, 3.0…

## 2.0 — 13 ottobre 2026 (Fase 2)
- **Archivio** (nuova scheda nella barra in basso):
  - calendario mensile, settimana da lunedì, con un puntino sui giorni scritti, frecce tra i mesi e «Vai a data»;
  - cronologia dei giorni, con anteprima delle prime righe;
  - ricerca per parola (ignora maiuscole e accenti, evidenzia le parole trovate).
- **Modalità lettura:** i giorni passati si aprono in sola lettura; «Modifica» per scrivere, «Vista lettura» per tornare.
- **Blocco** con impronta (WebAuthn) e PIN di riserva: l'impronta è lo sblocco normale, il PIN serve se l'impronta non
  viene riconosciuta o non è attiva. Si richiude dopo più di un minuto in background; il contenuto è coperto appena si esce.
  PIN e impronta non finiscono nei backup e un'importazione non li cambia.
- **Tasto «indietro»:** da Oggi compare «Premi ancora indietro per uscire» (con «Resta»), senza il pulsante «Esci» che non poteva funzionare.
- La barra in basso ha tre voci: Oggi, Archivio, Impostazioni.
- Nessuna migrazione del database: i dati restano come sono.

## 1.2 — 13 ottobre 2026
- L'avviso di aggiornamento ha un pulsante «Aggiorna» più curato e occupa la larghezza giusta.

## 1.1 — 13 ottobre 2026
- Corretto «null» accanto a «Backup salvato nella cartella Download».
- Mentre scrivi, la pagina scorre da sola e il cursore resta visibile sopra la barra di formattazione.
- Tasto «indietro»: da Impostazioni torna a Oggi; da Oggi chiede se uscire dall'app.
- Il grassetto dentro un titoletto non viene più salvato (il titoletto è già in grassetto).
- Etichette del carattere: «Serif (da libro)» e «Sans (pulito)».

## 1.0 — 13 ottobre 2026 (Fase 1)
- Prima versione: pagina Oggi con più voci per giorno, editor (grassetto, corsivo, titoletti, elenchi),
  salvataggio automatico, tema carta/scuro, carattere e dimensione, backup JSON, app installabile e offline.
