# Cronologia delle versioni

La versione si vede in *Impostazioni → Informazioni*. Gli aggiornamenti piccoli fanno 1.1, 1.2, 1.3…;
quelli grandi (di solito una nuova fase) fanno il salto: 2.0, 3.0…

## 2.4 — 14 ottobre 2026
- «Spazio tra le righe» ora cambia anche la distanza **tra un paragrafo e il successivo** (prima cambiava solo l'interlinea
  dentro un paragrafo, quindi chi scrive una riga per paragrafo non vedeva differenze). Vale per scrittura, lettura ed elenchi.

## 2.3 — 14 ottobre 2026
- Nuova impostazione **«Spazio tra le righe»** (Impostazioni → Aspetto): compatta, normale, ampia, molto ampia.
  Vale per tutto il diario (scrittura e lettura) e si somma all'interlinea del carattere scelto. Il livello predefinito è «Normale»,
  quindi non cambia nulla finché non lo modifichi.

## 2.2 — 13 ottobre 2026
- Corretta la finestra della password del backup, che con la tastiera aperta veniva tagliata: ora è più compatta,
  scorre se serve e porta da sola il campo scelto nella parte visibile. Il tasto «Succ.» della tastiera passa al secondo campo.
- Tutte le finestre dell'app non superano più lo spazio disponibile quando compare la tastiera.

## 2.1 — 13 ottobre 2026
- **Backup cifrato con password.** Esportando, l'app chiede una password (due volte) oppure permette di esportare senza.
  Il file cifrato si chiama `diario-stoico-AAAA-MM-GG-cifrato.json` e non rivela nulla del diario. Importandolo, l'app chiede la
  password. La password non è salvata da nessuna parte e non si può recuperare.
- Cifratura AES-256 con chiave ricavata dalla password (PBKDF2, 600.000 ripetizioni); un file alterato viene riconosciuto.
- Dopo la cifratura l'app riapre subito il file per essere sicura che la password lo apra davvero.
- Nessuna modifica al database: i dati non sono toccati.

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
