# Diario Stoico — Specifiche e roadmap

Oct 13, 2026 · @Alessandro

## Visione e principi

Un diario personale di ispirazione stoica, per uso esclusivamente privato, che si adatta ai giorni: poche righe quando il tempo è poco, pagine intere quando c'è modo di scrivere di più. Le pratiche stoiche (riflessione mattutina, esame serale, obiettivi, distinzione tra ciò che dipende da noi e ciò che no) sono strumenti opzionali intorno a una pagina di testo libero.

- **Semplicità:** pochi elementi, tutti funzionali allo scopo. Meglio un'app piccola usata ogni giorno che una piena di funzioni abbandonata.
- **Flessibilità:** il testo libero è sempre al centro. Nessun campo obbligatorio, nessun indicatore di giornata "incompleta": una riga conta quanto quattro moduli.
- **Privacy:** dati solo sul dispositivo, accesso protetto dall'impronta digitale.
- **Piacere d'uso:** estetica curata "carta e inchiostro". Rileggere deve essere gradevole quanto scrivere.
- **Tono stoico:** sobrietà, nessun punteggio punitivo, nessuna "streak" che genera senso di colpa.
- **Crescita a fasi:** ogni fase produce un'app già usabile; si passa alla successiva solo dopo qualche giorno di uso reale.

## Piattaforma e vincoli tecnici

L'app è una PWA (Progressive Web App) statica, ospitata su GitHub Pages e installata sulla schermata Home di un Samsung S25 (Android, Chrome). Non serve Android Studio, né un server, né un account esterno.

- **Tecnologia:** HTML, CSS e JavaScript, senza backend. Evitare un passaggio di build complesso: si può usare JavaScript moderno con moduli ES, oppure un bundler leggero solo se davvero utile. Qualunque dipendenza esterna va inclusa nel repository (niente CDN a runtime), così l'app funziona offline.
- **Offline:** service worker che mette in cache tutti i file; l'app deve aprirsi e funzionare senza connessione. Deve avere un manifest completo (nome, icone, colore tema, modalità standalone).
- **Dati:** solo locali, in IndexedDB. Richiedere lo storage persistente (`navigator.storage.persist()`) per evitare che il browser li cancelli.
- **Backup:** export e import completi in JSON dalla prima fase; export in Markdown leggibile più avanti. Mostrare nell'app "ultimo backup: N giorni fa" (non è una notifica).
- **Blocco:** all'apertura dell'app viene chiesta l'impronta digitale tramite WebAuthn (platform authenticator), con PIN di riserva. È un blocco di accesso a livello di app, non una cifratura dei dati.
- **Notifiche:** nessuna, per ora.
- **Cifratura dei dati:** non richiesta, per ora.
- **Mobile first:** pensata per uno schermo da telefono, uso con una mano, tastiera Android; deve restare gradevole anche su schermi più grandi.
- **Italiano:** interfaccia e testi interamente in italiano; date e formati italiani (settimana da lunedì).

## Funzioni e schermate

L'app ha cinque aree di navigazione (Oggi, Archivio, Obiettivi, Revisioni, Impostazioni), in una barra in basso semplice e discreta. Editor e moduli sono componenti della pagina Oggi.

### 1. Oggi

La pagina del giorno, dove si passa più tempo.

- Data in grande in alto; opzionalmente una citazione di apertura.
- Una **striscia obiettivi** compatta con gli obiettivi del giorno e della settimana in corso, spuntabili con un tap senza uscire dal diario.
- Un **flusso di voci con orario**: il pulsante "+ Nuova voce" ne aggiunge una a qualsiasi ora. Etichette facoltative "mattina", "giorno", "sera"; nessuna sezione è obbligatoria.
- Ogni voce contiene testo formattato e, se si vuole, uno o più moduli.
- In fondo, "Aggiungi modulo" mostra i moduli non attivi per quel giorno.
- Con le ricorrenze attive: "un mese fa", "un anno fa oggi".

### 2. Editor di testo

Sobrio, senza barra degli strumenti ingombrante: la barra compare solo mentre si scrive.

- Grassetto, corsivo, elenchi puntati e numerati, titoletti, citazione.
- Font e dimensione sono **impostazioni di lettura globali** (serif o sans, dimensione), non formattazione riga per riga. Eventuale cambio di font su un singolo passaggio solo come funzione avanzata in fase finale.
- Salvataggio automatico continuo: nessun pulsante "salva".

### 3. Moduli

Blocchi opzionali che si aggiungono a una voce o a una giornata. Tutti disponibili da subito; ognuno si attiva o disattiva nelle impostazioni (configurazione di base) e per singolo giorno (a discrezione). Il contenuto di un modulo nascosto non viene mai cancellato.

1. Premeditatio del mattino
2. Esame serale
3. Obiettivi del giorno (collegato alla pagina Obiettivi)
4. Virtù del giorno (saggezza, giustizia, coraggio, temperanza)
5. Dicotomia del controllo ("dipende da me" / "non dipende da me")
6. Umore ed energia (un tap)
7. Negative visualization
8. Citazione di apertura

Oltre a questi, **moduli personalizzati** creati dall'utente: nome, frase-guida facoltativa e tipo (testo libero, elenco spuntabile, valutazione 1-5, scelta tra opzioni). I moduli predefiniti sono solo moduli già pronti. L'ordine dei moduli nella pagina è fisso all'inizio (trascinamento in fase finale).

### 4. Obiettivi

Pagina a sé, con orizzonti: giornaliero, settimanale, mensile, annuale.

- Ogni obiettivo: titolo, orizzonte, periodo, stato (da fare, fatto, non riuscito, rimandato), nota facoltativa.
- **Cascata opzionale:** un obiettivo mensile si scompone in settimanali, che si scompongono in giornalieri. Si possono avere obiettivi senza genitore.
- **Chiusura guidata** a fine periodo: si segna com'è andata e si scrive una riga di riflessione. Nessun punteggio punitivo.
- **Collegamento col diario:** la striscia in "Oggi", più la possibilità di citare un obiettivo nel testo; dall'obiettivo si vedono le voci che lo citano.

### 5. Archivio e rilettura

- **Calendario mensile** con un puntino sui giorni scritti; un tap apre il giorno.
- **Vai a data:** selettore rapido.
- **Cronologia:** lista scorrevole dei giorni con anteprima delle prime righe.
- **Ricerca** per parola nel testo.
- Un giorno passato si apre in **modalità lettura** (pulita, a tutta pagina), con un tap per passare alla modifica.

### 6. Revisioni

Riepilogo settimanale e mensile: obiettivi mantenuti, virtù praticate, umore, con una domanda di sintesi a cui rispondere. Tono descrittivo, mai punitivo.

### 7. Impostazioni

Moduli attivi, tema, font e dimensione, colore d'accento, blocco (impronta e PIN), export e import, indicatore dell'ultimo backup.

## Modello dati

Il modello va pensato fin dalla Fase 1 per reggere moduli e obiettivi futuri, senza riscritture. Tutto è in IndexedDB, con un numero di versione dello schema e funzioni di migrazione.

| Entità | Campi principali | Note |
| --- | --- | --- |
| Voce | id, data (AAAA-MM-GG), ora, etichetta (mattina/giorno/sera/nessuna), contenuto, creata/modificata | Più voci per giorno. Il contenuto è in un formato strutturato semplice (sottoinsieme di Markdown o JSON a blocchi), non HTML grezzo, così l'export Markdown è affidabile. |
| Giorno | data, modelli o moduli aggiunti, moduli nascosti | Opzionale: esiste solo se serve una configurazione specifica per quel giorno. |
| Definizione modulo | id, nome, frase-guida, tipo (testo, elenco spuntabile, valutazione 1-5, scelta), opzioni, predefinito sì/no, attivo di base sì/no, ordine | I moduli predefiniti sono record come gli altri. |
| Istanza modulo | id, voce o giorno, id modulo, dati, nascosta sì/no | Nascondere non cancella mai i dati. |
| Obiettivo | id, titolo, orizzonte (giorno/settimana/mese/anno), inizio, fine, stato, id genitore, nota, chiusura (esito, riflessione, data) | Il genitore è facoltativo: forma la cascata. |
| Collegamento obiettivo-voce | id obiettivo, id voce | Per la storia dell'obiettivo e le menzioni nel testo. |
| Impostazioni | tema, colore d'accento, font, dimensione, blocco attivo, hash del PIN, moduli attivi di base, ultimo backup | Un solo record. |

**Regole**

- Gli identificativi sono UUID; ogni record ha data di creazione e di modifica.
- Le date sono stringhe locali AAAA-MM-GG (fuso Europe/Rome), mai timestamp UTC per "il giorno", per evitare giorni sbagliati a cavallo della mezzanotte.
- Nessuna cancellazione definitiva senza conferma esplicita; l'eliminazione di una voce chiede conferma.
- Export JSON: un unico file con app, versione dello schema, data di export e tutte le entità. L'import valida il file, mostra un riepilogo e chiede se unire o sostituire prima di toccare i dati esistenti.
- Export Markdown (Fase 5): un file leggibile per giorno o unico, con data, ora, testo e moduli; font e dimensioni non vengono esportati.

## Estetica e gratificazione visiva

Lo stile scelto è **carta e inchiostro**: caldo, sobrio, da diario vero. La pagina deve invitare a scrivere, non sembrare un gestionale.

- **Temi:** "carta" (sfondo crema, inchiostro scuro) come predefinito; tema scuro con nero vero (lo schermo AMOLED dell'S25 lo valorizza); chiaro neutro opzionale. È disponibile anche l'opzione "segui il sistema".
- **Colore d'accento unico**, sobrio e cambiabile (ad esempio terracotta, verde salvia, blu notte). Pochi colori, usati con coerenza.
- **Tipografia:** un carattere serif elegante per il testo del diario (tono da libro) e un sans pulito per interfaccia; scelta serif/sans modificabile nelle impostazioni. Font incorporati nel repository (niente CDN). Interlinea generosa, molto spazio bianco, larghezza di lettura contenuta.
- **Piccole gratificazioni, non giochini:** spunta con animazione morbida al completamento di un obiettivo, calendario con i giorni scritti, riepilogo settimanale visivo delle virtù praticate. Nessuna streak, nessun senso di colpa, nessun coriandolo.
- **Animazioni discrete:** transizioni brevi e fluide tra le schermate; rispettare `prefers-reduced-motion`.
- **Schermata di blocco** pulita, con il nome dell'app, una citazione breve e il prompt dell'impronta.
- **Rilettura:** la modalità lettura usa gli stessi stili, a tutta pagina, con data in evidenza.
- **Accessibilità:** contrasto adeguato in tutti i temi, bersagli di tocco di almeno 44 px, testo scalabile.

Per le citazioni stoiche usare solo testi di pubblico dominio (traduzioni antiche) o parafrasi proprie, per evitare problemi di copyright.

## Roadmap a fasi

Sei fasi, ciascuna con un'app già usabile. Prima di passare alla successiva: qualche giorno di uso reale sull'S25 e criteri di completamento soddisfatti. Su GitHub, un tag per ogni fase (`fase-1`, `fase-2`, ...) per poter tornare indietro.

### Fase 1: il diario che funziona

- Pagina "Oggi" con data in grande, frecce per passare al giorno precedente e successivo e flusso di voci con orario ("+ Nuova voce").
- Editor semplice: grassetto, corsivo, elenchi puntati e numerati, titoletti.
- Salvataggio automatico in IndexedDB con storage persistente.
- Estetica carta e inchiostro più tema scuro, con scelta del carattere (serif o sans) e della dimensione del testo.
- PWA installabile, funzionante offline, pubblicata su GitHub Pages.
- Export e import JSON, con l'indicatore "ultimo backup: N giorni fa".

**Fatta quando:** si installa sul telefono, si scrivono più voci in un giorno, si chiude e riapre l'app senza perdere nulla, anche in modalità aereo, e l'export JSON si reimporta correttamente.

### Fase 2: blocco e rilettura

- Blocco con impronta (WebAuthn) più PIN di riserva.
- Calendario mensile con i giorni scritti, vai a data, cronologia scorrevole.
- Modalità lettura per i giorni passati.
- Ricerca per parola.

**Fatta quando:** l'app non si apre senza impronta o PIN, e si ritrova un giorno specifico di due mesi prima in meno di dieci secondi.

### Fase 3: obiettivi

- Pagina Obiettivi con orizzonti (giorno, settimana, mese, anno) e stati.
- Striscia "Oggi" spuntabile nella pagina del giorno.
- Cascata opzionale mensile, settimanale, giornaliero.
- Chiusura guidata a fine periodo con riga di riflessione.

**Fatta quando:** si crea un obiettivo mensile con sotto-obiettivi settimanali e giornalieri, si spunta dalla pagina del giorno e si chiude un periodo con una riflessione.

### Fase 4: moduli

- Sistema di moduli attivabili e disattivabili, nelle impostazioni e per singolo giorno.
- Moduli predefiniti: premeditatio, esame serale, virtù del giorno, dicotomia del controllo, umore ed energia, negative visualization, citazione di apertura.
- Moduli personalizzati (testo, elenco spuntabile, valutazione 1-5, scelta).
- I dati dei moduli nascosti non vengono mai cancellati.

**Fatta quando:** si compone una giornata con solo uno o due moduli, se ne nasconde uno e lo si riattiva ritrovando il contenuto, e si crea un modulo personalizzato.

### Fase 5: revisioni e ricorrenze

- Ricorrenze ("un mese fa", "un anno fa oggi") nella pagina Oggi.
- Revisione settimanale e mensile.
- Menzione degli obiettivi nelle voci e storia dell'obiettivo.
- Export Markdown.

**Fatta quando:** la revisione settimanale riassume correttamente obiettivi, virtù e umore, e l'export Markdown è leggibile in un normale editor di testo.

### Fase 6: rifinitura ed extra (se servono)

- Scelta del colore d'accento.
- Modelli di giornata ("normale", "difficile").
- Riordino dei moduli con trascinamento.
- Filtri per tag, modulo, umore; preferiti.
- Cifratura con passphrase; notifiche.

Questa fase si decide sulla base dell'uso reale: si costruisce solo ciò che manca davvero.

**Nota sull'ordine:** il diario contiene cose personali fin dal primo giorno. Se si preferisce, il blocco con impronta si può anticipare alla Fase 1.

## Fuori ambito per ora e decisioni aperte

**Esplicitamente rimandato** (da non costruire finché non lo si chiede): filtri e preferiti, cifratura dei dati, notifiche, sincronizzazione tra dispositivi, riordino dei moduli con trascinamento, modelli di giornata.

**Decisioni aperte:**

- [ ] Blocco con impronta già in Fase 1 o in Fase 2?
- [ ] Formato di salvataggio del testo formattato (sottoinsieme di Markdown o JSON a blocchi), da scegliere con Claude Code in base all'editor adottato.
- [ ] Editor di testo: realizzarlo a mano (contenteditable) o usare una libreria leggera inclusa nel repository.
- [ ] Repository GitHub: pubblico (deciso). I dati restano solo sul telefono e i file di backup non vanno mai caricati nel repository.
- [ ] Sincronizzazione tra dispositivi: nessuna per ora; l'export/import è il meccanismo di backup e trasferimento.

## Prompt per Claude Code

Da incollare così com'è come primo messaggio in Claude Code dall'app desktop di Claude, lavorando in una cartella vuota sul computer. Subito dopo, nello stesso messaggio o nel successivo, incolla questo documento esportato in Markdown: Claude Code lo salverà come SPEC.md, così le fasi successive avranno tutti i dettagli e non solo quelli della Fase 1.

```markdown
# Contesto e obiettivo

Costruiamo insieme «Diario Stoico»: un'app personale di diario giornaliero di ispirazione stoica, per uso strettamente privato (solo mio). È una PWA (Progressive Web App) statica, pubblicata su GitHub Pages e installata sul mio Samsung S25 (Android, Chrome). Non uso Android Studio e non ho un server. Lavoriamo in una cartella locale sul mio computer, dall'app desktop di Claude; a lavoro finito la caricherò su un repository GitHub pubblico e la pubblicherò con GitHub Pages.

Non sono uno sviluppatore esperto: parlami in italiano, in modo semplice, e quando devo fare qualcosa io (creare il repository, attivare GitHub Pages, installare l'app sul telefono) guidami passo per passo.

# Come lavoriamo

1. Costruisci SOLO la Fase 1 (descritta sotto). Non anticipare funzioni delle fasi successive, ma progetta codice e modello dati in modo che le reggano senza riscritture.
2. Prima di scrivere codice: guarda la cartella di lavoro, poi proponimi in massimo una schermata l'architettura, la struttura delle cartelle e le tue raccomandazioni sulle scelte aperte (elencate in fondo). Aspetta il mio ok.
3. Poi procedi a piccoli passi, con commit piccoli e descrittivi.
4. Dopo questo messaggio ti incollo il documento completo di specifiche e roadmap: salvalo integralmente come SPEC.md (è la fonte di verità per tutte le fasi; se qualcosa qui sotto è in conflitto, chiedimi). Crea anche ROADMAP.md (le fasi, con lo stato di ciascuna) e README.md in italiano (come pubblicare su GitHub Pages, come installare l'app su Android, come fare e ripristinare un backup).
5. Scrivi test automatici leggeri per la logica dei dati (date, salvataggio, export e import, migrazioni).
6. A fine fase: tag git (fase-1), istruzioni per provarla sul telefono e un elenco di cosa è fatto e cosa no.
7. Se qualcosa è ambiguo, chiedimi. Non inventare funzioni che non ho chiesto.

# Principi

- Semplicità: pochi elementi, tutti utili. Meglio un'app piccola che uso ogni giorno.
- Flessibilità: il testo libero è sempre al centro. Nessun campo obbligatorio, nessun indicatore di «giornata incompleta». Una riga vale quanto quattro moduli.
- Privacy: tutti i dati restano sul dispositivo. Nessun analytics, nessuna chiamata di rete a runtime.
- Tono stoico: sobrio, mai punitivo. Niente punteggi, niente «streak» che danno senso di colpa.

# Vincoli tecnici

- PWA statica (HTML, CSS, JavaScript), senza backend né account. Scegli tu e motiva: JavaScript puro con moduli ES oppure una libreria leggera. Evita framework pesanti e passaggi di build complicati; se serve una build, deve essere pubblicabile su GitHub Pages (con GitHub Actions o committando la cartella già pronta).
- Nessuna CDN: font e librerie vanno inclusi nel repository (verifica che le licenze lo permettano).
- Offline-first: service worker che mette in cache tutti i file; l'app deve aprirsi e funzionare in modalità aereo. Gestisci gli aggiornamenti senza perdere dati. Manifest completo (nome, icone 192 e 512, icona maskable, display standalone, theme color, lang it).
- GitHub Pages serve l'app da una sottocartella (/nome-repo/): usa percorsi relativi ovunque.
- Dati in IndexedDB, con schemaVersion e funzioni di migrazione. Richiedi lo storage persistente (navigator.storage.persist()).
- Date come stringhe locali AAAA-MM-GG (fuso Europe/Rome); mai timestamp UTC per identificare «il giorno». Identificativi UUID. Ogni record ha createdAt e updatedAt.
- Salvataggio automatico con debounce; forza il salvataggio anche su visibilitychange e pagehide, per non perdere testo se chiudo l'app mentre scrivo.
- Mobile first per l'S25: uso con una mano, bersagli di tocco di almeno 44 px, layout che non si rompe quando compare la tastiera.
- Tutto in italiano (interfaccia e testi). Settimana da lunedì.
- Sicurezza: il testo dell'utente non va mai inserito nella pagina come HTML non sanificato.
- Accessibilità di base: contrasto adeguato, testo scalabile, rispetta prefers-reduced-motion e prefers-color-scheme.

# Modello dati (da progettare ora per tutte le fasi)

- Voce: id, data, ora, etichetta (mattina, giorno, sera o nessuna), contenuto, createdAt, updatedAt. Più voci per giorno.
- Giorno (opzionale): data, moduli aggiunti, moduli nascosti.
- Definizione modulo: id, nome, frase-guida, tipo (testo, elenco spuntabile, valutazione 1-5, scelta), opzioni, predefinito sì/no, attivo di base sì/no, ordine.
- Istanza modulo: id, voce o giorno, id modulo, dati, nascosta sì/no. Nascondere non cancella mai i dati.
- Obiettivo: id, titolo, orizzonte (giorno, settimana, mese, anno), inizio, fine, stato (da fare, fatto, non riuscito, rimandato), id genitore opzionale, nota, chiusura (esito, riflessione, data).
- Collegamento obiettivo-voce.
- Impostazioni: record unico (tema, colore d'accento, font, dimensione, blocco attivo, hash del PIN, moduli attivi di base, data ultimo backup).

Nella Fase 1 implementa davvero solo Voce e Impostazioni, ma lascia il database pronto (con migrazioni) ad accogliere il resto.

Il contenuto formattato va salvato in un formato strutturato semplice (sottoinsieme di Markdown oppure JSON a blocchi), non in HTML grezzo, perché in seguito dovrà essere esportato in Markdown. Raccomandami tu quale, in base all'editor.

# Fase 1: cosa costruire

1. Pagina «Oggi»: data in grande (es. «martedì 13 ottobre 2026»), elenco cronologico delle voci del giorno, pulsante «+ Nuova voce» che crea una voce con l'ora attuale. Etichetta facoltativa mattina/giorno/sera (nessuna di default). Eliminazione di una voce con conferma. Frecce per passare al giorno precedente e successivo (navigazione minima: il calendario arriva in Fase 2).
2. Editor semplice: grassetto, corsivo, elenchi puntati e numerati, titoletti. Barra degli strumenti compatta che compare solo mentre si scrive. Niente scelta di font per singola riga.
3. Impostazioni minime: tema (carta, scuro, segui il sistema), carattere del diario (serif o sans), dimensione del testo (almeno tre livelli), export JSON, import JSON e la scritta «ultimo backup: N giorni fa» (oppure «mai») accanto all'export. Carattere e dimensione valgono per tutto il diario.
4. Export JSON: un unico file (diario-stoico-AAAA-MM-GG.json) con app, schemaVersion, data di export e tutti i dati. Import: valida il file, mostra un riepilogo, chiede se unire o sostituire e non tocca i dati esistenti prima della conferma.
5. Navigazione in basso con le sole schermate esistenti (Oggi, Impostazioni); le altre arriveranno nelle fasi successive.
6. PWA installabile e funzionante offline, con istruzioni per GitHub Pages.

# Estetica (importante: la gratificazione visiva conta)

Stile «carta e inchiostro»: caldo, sobrio, da diario vero. La pagina deve invitare a scrivere, non sembrare un gestionale.

- Tema carta (predefinito): sfondo crema (indicativamente #F6F1E7), inchiostro scuro (#2B2A28), un solo colore d'accento terracotta (indicativamente #B5573A).
- Tema scuro: nero vero (AMOLED), testo caldo e non bianco puro; stesso accento ammorbidito.
- Tipografia: un serif elegante per il testo del diario (ad esempio Lora o Source Serif, licenza OFL, inclusi nel repository) e un sans pulito per l'interfaccia. Interlinea generosa, molto spazio bianco, larghezza di lettura contenuta.
- Animazioni brevi e discrete; niente effetti vistosi.
- Usa variabili CSS per colori, font e spaziature, così in seguito cambiare tema, accento e font sarà semplice.
- Icona dell'app e schermata di avvio coerenti con lo stile (creane una semplice tu).

# Criteri di accettazione della Fase 1

- Installo l'app sull'S25 da GitHub Pages e compare nella schermata Home come app a sé.
- Scrivo più voci nello stesso giorno, con formattazione, e le ritrovo dopo aver chiuso e riaperto l'app, anche in modalità aereo.
- Cambio giorno con le frecce e ritrovo le voci.
- Esporto il JSON, cancello i dati, reimporto il file e tutto torna identico.
- Tema carta e tema scuro funzionano e sono gradevoli; cambiando carattere e dimensione cambia tutto il diario.
- Dopo un export, l'indicatore mostra «ultimo backup: oggi».
- Nessuna richiesta di rete a runtime dopo il primo caricamento.

# Cosa NON fare

- Non costruire funzioni delle fasi successive: blocco con impronta, calendario, ricerca, obiettivi, moduli, revisioni, ricorrenze, filtri, preferiti, cifratura, notifiche, sincronizzazione.
- Non usare CDN, tracker o servizi esterni.
- Non cancellare dati senza conferma esplicita.
- Non cambiare scelte già concordate senza chiedermelo.

# Roadmap generale (solo contesto)

- Fase 2: blocco con impronta (WebAuthn, senza server: l'impronta fa da cancello locale con userVerification «required»; PIN di riserva salvato solo come hash); calendario mensile, vai a data, cronologia, modalità lettura, ricerca.
- Fase 3: pagina Obiettivi (giorno, settimana, mese, anno), striscia «Oggi» spuntabile, cascata opzionale, chiusura guidata.
- Fase 4: moduli attivabili per impostazioni e per giorno (premeditatio, esame serale, virtù del giorno, dicotomia del controllo, umore ed energia, negative visualization, citazione di apertura) e moduli personalizzati.
- Fase 5: ricorrenze («un anno fa oggi»), revisioni settimanali e mensili, menzione degli obiettivi nelle voci, export Markdown.
- Fase 6: rifiniture secondo l'uso reale (colore d'accento, modelli di giornata, trascinamento moduli, filtri, preferiti, cifratura, notifiche).

# Scelte aperte (raccomanda e attendi il mio ok)

1. Libreria o editor a mano per il testo formattato, e relativo formato di salvataggio.
2. JavaScript puro o libreria leggera; con o senza passaggio di build.
3. Blocco con impronta già nella Fase 1 o nella Fase 2 (il diario contiene cose personali fin dal primo giorno).
4. Già deciso, non è una scelta aperta: il repository GitHub sarà pubblico. Nessun dato personale o file di backup deve finire nel codice: aggiungi un .gitignore che escluda i file di export (diario-stoico-*.json).

# Guidami su GitHub

Alla fine spiegami passo passo: inizializzare git nella cartella, creare il repository pubblico su GitHub, caricare i file, attivare GitHub Pages (Settings, Pages), trovare l'indirizzo dell'app, installarla da Chrome su Android («Aggiungi a schermata Home») e come aggiornarla quando faremo modifiche.
```

### Prompt per le fasi successive

Da usare all'inizio di ogni nuova fase, sostituendo N con il numero della fase.

```markdown
Passiamo alla Fase N del Diario Stoico.

1. Rileggi SPEC.md e ROADMAP.md e dimmi in poche righe cosa prevede la Fase N e quali criteri di completamento ha.
2. Controlla che la fase precedente sia completa e che non ci siano problemi aperti; se ce ne sono, dimmelo prima di iniziare.
3. Proponimi come intendi costruirla (componenti, modifiche al modello dati, migrazioni necessarie) e aspetta il mio ok.
4. Le migrazioni non devono mai perdere i dati esistenti: prima di applicarle, ricordami di fare un export JSON.
5. Costruisci solo la Fase N, a piccoli passi, con commit descrittivi e test sulla logica dei dati.
6. A fine fase: aggiorna ROADMAP.md, crea il tag fase-N, dammi le istruzioni per provarla sul telefono e un elenco di cosa è fatto e cosa no.

Note dall'uso reale della fase precedente: [scrivi qui cosa ti è piaciuto, cosa ti è mancato, cosa cambieresti]
```
