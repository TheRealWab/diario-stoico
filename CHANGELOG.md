# Cronologia delle versioni

La versione si vede in *Impostazioni → Informazioni*. Gli aggiornamenti piccoli fanno 1.1, 1.2, 1.3…;
quelli grandi (di solito una nuova fase) fanno il salto: 2.0, 3.0…

## 4.2 — 21 ottobre 2026
- **Frase del giorno:** 366 frasi, una per ogni giorno, **tutte alla lettera**: nessuna è riscritta da me. Vengono da testi antichi in traduzioni italiane
  libere da diritti (Marco Aurelio, Epitteto, Seneca, Platone, Cicerone, Epicuro e i detti di Socrate, Zenone, Cleante, Diogene, Aristotele, Talete,
  Pitagora e altri, riportati da Diogene Laerzio). Ogni frase è stata controllata parola per parola sul testo originale. Si legge **autore, opera e traduttore**.
- **In cima a «Oggi», accesa di base** (anche per chi aveva già scelto i moduli); si spegne in *Impostazioni → Moduli*. La stessa per tutto il giorno,
  mai ripetuta in 366 giorni, e due giorni di fila non hanno mai lo stesso autore. Anche la schermata di blocco mostra una frase breve, con l'autore.
- Le frasi che prima scrivevo io (parafrasi) non ci sono più: ora è tutto alla lettera.
- **Solo la forma è ritoccata:** gli accenti acuti antichi diventano gravi (cosí → così), apostrofi e virgolette tipografici. Nessuna parola è cambiata,
  nemmeno l'ortografia dell'epoca (*poichè, nè, perocchè*). L'elenco completo, con la pagina di Wikisource dove verificare ogni frase, è in `CITAZIONI.md`.
- Il riquadro si chiama ora «Frase del giorno» (prima «Citazione di apertura»). Nessuna migrazione del database.

## 4.1 — 21 ottobre 2026
- **Ordine dei moduli a scelta:** in *Impostazioni → Moduli* ogni modulo ha le frecce ▲ ▼ per decidere in che ordine compare nella pagina del giorno
  (obiettivi prima o dopo la negative visualization, e così via). Anche **«Le tue voci»**, il posto dove scrivi, è un blocco della lista e si sposta
  come gli altri: i moduli sopra stanno prima delle voci, quelli sotto dopo. L'ordine vale per tutti i giorni, anche in modalità lettura, e entra nei backup.
  Se non si cambia nulla, l'ordine resta quello di prima.
- **Ritorno a «Oggi» più veloce:** la pagina si disegna subito, senza aspettare che il browser torni indietro nella cronologia (era il passaggio lento).
  La barra in basso si accende al tocco; la dissolvenza tra le schermate non parte più da trasparente; «Oggi» legge voci e moduli insieme.
- *Impostazioni → Informazioni* mostra i tempi delle ultime schermate aperte, per capire se qualcosa resta lento. Non viene salvato né inviato da nessuna parte.
- Nessuna migrazione del database: i dati restano come sono.

## 4.0 — 19 ottobre 2026 (Fase 4)
- **Moduli** facoltativi nella pagina del giorno. Già pronti: **citazione di apertura**, **obiettivi** (la striscia di prima), **premeditatio**,
  **negative visualization** (sopra le voci), **dicotomia del controllo**, **virtù del giorno**, **umore ed energia**, **esame serale** (sotto le voci).
  L'esame serale ha due versioni (Seneca ed Epitteto, tre domande ciascuna); l'umore si sceglie con parole sobrie, senza numeri.
- **Quali compaiono:** *Impostazioni → Moduli* sceglie gli attivi ogni giorno (all'inizio solo gli obiettivi, come prima).
  In ogni giorno: «Nascondi» su un riquadro e «+ Aggiungi modulo» in fondo alla pagina.
- **Nascondere non cancella mai:** riattivando un modulo si ritrova quello che si era scritto. I moduli appartengono alla giornata.
- **Moduli tuoi:** nome, frase-guida facoltativa e tipo (testo libero, elenco spuntabile, valutazione 1-5, scelta tra opzioni).
  Si modificano (nome e frase) e si **archiviano** (non si eliminano): i dati restano e nei giorni passati si leggono ancora.
  Tre **modelli pronti**, spenti di base: Prima impressione, Persone difficili, Principio a portata di mano.
- **Modalità lettura:** i moduli con qualcosa di scritto compaiono anche nei giorni passati, in sola lettura.
- **Citazione di apertura:** una frase al giorno; alcune sono frasi di Epitteto (*Manuale*, traduzione di G. Leopardi, libera da diritti), con attribuzione.
- I dati dei moduli entrano nei backup (anche cifrati) e vengono controllati all'importazione.
- Nessuna migrazione del database: i dati restano come sono.

## 3.4 — 16 ottobre 2026
- **Finestra del backup rifatta come in Wallet:** una sola schermata con «Con password / Senza password» e, subito sotto, **«Dove salvarlo»**:
  «Scegli dove salvare» e, se c'è già un file salvato la volta prima, **«Sostituisci il backup precedente»** (con il nome del file).
  Prima la scelta stava in una finestra a parte che compariva solo dopo il primo salvataggio, quindi non si vedeva. L'ultima scelta si ricorda.

## 3.3 — 16 ottobre 2026
- **Backup: scegli dove salvarlo e sostituisci quello vecchio.** Dove il telefono lo permette, «Esporta backup» apre la finestra «salva con nome»
  e ricorda il file scelto. La volta dopo propone «Sostituisci il backup precedente»: resta un solo file, senza doppioni
  (`… (1).json`). Il file ricordato non finisce mai nei backup. Il backup con password e quello senza si ricordano separatamente,
  così un file «cifrato» non viene mai sostituito per sbaglio con un contenuto in chiaro. Dove la scelta non c'è, si salva in Download come prima.
- **Rimandare un obiettivo lo sposta davvero:** «Rimanda a domani» (o alla prossima settimana, al prossimo mese…) nella scheda dell'obiettivo
  lo sposta al periodo successivo: sparisce dal giorno di prima e torna «da fare». Non nasce più una copia. Lo stesso vale per «Rimandato»
  nella chiusura guidata. Se l'obiettivo aveva sotto-obiettivi, restano dov'erano, senza genitore.
- **Voci senza l'ora:** resta solo la divisione Mattina / Giorno / Sera. Una nuova voce parte con la parte del giorno giusta (fino alle 12 mattina,
  fino alle 18 giorno, poi sera), che si cambia con un tocco. Le voci sono in ordine mattina → giorno → sera. L'ora resta salvata nei dati ma non si vede più.
- Nessuna migrazione del database.

## 3.2 — 14 ottobre 2026
- **Gli obiettivi di un giorno non sembrano più spariti:** la striscia «Obiettivi» compare anche nella modalità lettura di un giorno
  (prima solo in modifica, quindi senza voci scritte non si vedeva niente).
- Nella scheda Obiettivi, la vista **Settimana** mostra anche, sotto, gli obiettivi dei singoli giorni di quella settimana
  («Nei singoli giorni»), raggruppati per giorno e spuntabili.

## 3.1 — 14 ottobre 2026
- **Aggiunta veloce di un obiettivo (striscia in Oggi):** con la tastiera aperta la barra in basso (Oggi, Archivio…) finiva sopra
  il campo e lo copriva. Ora la barra si toglie mentre scrivi in qualunque campo di testo, e il campo viene portato nella parte visibile.
- Il campo è ora un vero modulo: il tasto «Fatto» della tastiera lo invia in modo affidabile (prima l'obiettivo poteva non salvarsi).

## 3.0 — 14 ottobre 2026 (Fase 3)
- **Obiettivi** (nuova scheda nella barra in basso, ora di quattro voci): quattro orizzonti (giorno, settimana, mese, anno), un periodo
  alla volta con le frecce per sfogliare. Ogni obiettivo ha titolo, nota, stato (da fare, fatto, non riuscito, rimandato) e una scheda di dettaglio.
- **Cascata opzionale:** un obiettivo può contenere sotto-obiettivi (mese → settimane → giorni, anche saltando un livello). Un obiettivo
  appartiene al periodo in cui comincia.
- **Striscia «Obiettivi» in Oggi:** gli obiettivi del giorno e della settimana, spuntabili con un tocco (con una piccola animazione morbida),
  e un campo veloce per aggiungere un obiettivo per oggi.
- **Chiusura guidata:** per settimane, mesi e anni finiti da non più di 60 giorni e ancora «da fare» compare un riquadro discreto con «Rivedi»:
  si dice com'è andata e, se si vuole, si scrive una riga di riflessione. Si può saltare o fermarsi quando si vuole. Con «Rimandato» si può
  riportare l'obiettivo al periodo successivo. Nessun punteggio, nessuna serie, nessuna notifica.
- Eliminare un obiettivo chiede conferma e non cancella i suoi sotto-obiettivi (restano senza genitore).
- Gli obiettivi sono inclusi nei backup (anche cifrati) e controllati all'importazione (periodi, stati e genitori coerenti).
- Corretto un difetto che poteva far comparire la scritta «null» in alcuni punti (ora c'è un controllo automatico che lo impedisce).
- Nessuna migrazione del database: i dati restano come sono.

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
