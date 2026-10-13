# Diario Stoico

Un diario personale di ispirazione stoica, solo per te. È un'app web installabile (PWA): si usa dal telefono come
un'app normale, funziona anche senza connessione e **tutti i dati restano sul dispositivo**. Nessun account, nessun
server, nessun tracciamento.

- Specifiche complete: [SPEC.md](SPEC.md) · Stato delle fasi: [ROADMAP.md](ROADMAP.md)

## Cosa fa (Fasi 1 e 2)

- Pagina **Oggi** con la data in grande, più voci per giorno con l'ora, etichetta facoltativa (mattina, giorno, sera).
- Frecce per andare al giorno precedente e successivo. I giorni passati si aprono in **lettura** (pulita, a tutta pagina) con un tocco su «Modifica» per scrivere.
- Editor semplice: grassetto, corsivo, titoletti, elenchi puntati e numerati. La barra degli strumenti compare solo mentre scrivi.
- Salvataggio automatico: non c'è un pulsante «salva».
- **Archivio:** calendario mensile con un puntino sui giorni scritti, «Vai a data», cronologia dei giorni e **ricerca** per parola (ignora maiuscole e accenti).
- **Blocco** con impronta (o PIN): vedi il paragrafo «Il blocco» più sotto.
- Tema carta o scuro (o quello del sistema), carattere serif o sans, quattro dimensioni del testo.
- Backup e ripristino in un file JSON.
- Tasto «indietro» di Android: da Impostazioni/Archivio torna a Oggi; da Oggi chiede di premerlo ancora per uscire.

---

## 1. Pubblicare su GitHub Pages (una volta sola)

Ti serve un account GitHub (gratuito) e Git installato sul computer (già fatto).

### 1.1 Creare il repository

1. Vai su <https://github.com/new> (accedi se richiesto).
2. **Repository name**: per esempio `diario-stoico`.
3. Scegli **Public**.
4. **Non** spuntare «Add a README», «.gitignore» né «license»: il repository deve nascere vuoto.
5. Premi **Create repository**. Nella pagina successiva copia l'indirizzo che finisce con `.git`
   (per esempio `https://github.com/TUONOME/diario-stoico.git`).

> Il repository è pubblico, quindi chiunque può vedere il *codice*. I tuoi *scritti* no: non sono mai nel repository,
> restano nel telefono. Il file `.gitignore` impedisce comunque di caricare per sbaglio i backup `diario-stoico-*.json`.

### 1.2 Caricare i file

Nella cartella del progetto il repository Git esiste già (con i commit e il tag `fase-1`). Apri un terminale in quella
cartella e scrivi (sostituendo l'indirizzo con il tuo):

```bash
git remote add origin https://github.com/TUONOME/diario-stoico.git
git push -u origin main --tags
```

La prima volta si apre una finestra del browser per accedere a GitHub: accetta. Il comando `--tags` carica anche
l'etichetta `fase-1`.

> **Privacy dell'email:** ogni commit riporta un indirizzo email e in un repository pubblico si vede. Quelli fatti finora
> usano un indirizzo segnaposto. Per i prossimi, su GitHub vai in *Settings → Emails*, attiva «Keep my email private» e
> copia l'indirizzo `…@users.noreply.github.com`; poi chiedimi di impostarlo.

### 1.3 Attivare GitHub Pages

1. Nel repository su GitHub: **Settings** (Impostazioni) → **Pages** (nel menu a sinistra).
2. In **Build and deployment** → **Source** scegli **Deploy from a branch**.
3. In **Branch** scegli `main` e la cartella `/ (root)`, poi **Save**.
4. Aspetta uno o due minuti e ricarica la pagina: in alto compare «Your site is live at…».

### 1.4 L'indirizzo dell'app

Sarà `https://TUONOME.github.io/diario-stoico/`. Aprilo dal computer per controllare che funzioni.

---

## 2. Installare l'app su Android (Samsung S25)

1. Sul telefono apri **Chrome** e vai all'indirizzo dell'app.
2. Aspetta qualche secondo (al primo caricamento l'app scarica tutto ciò che serve per lavorare offline).
3. Tocca i **tre puntini ⋮** in alto a destra → **Aggiungi a schermata Home** (o **Installa app**) → **Installa**.
4. L'icona «Diario» compare nella schermata Home e nel cassetto delle app. Aprila da lì: si apre a schermo intero, come un'app.

**Prova offline:** attiva la modalità aereo e riapri l'app. Deve aprirsi e permetterti di scrivere come sempre.

> Per proteggere l'accesso al diario attiva il blocco dell'app (vedi «Il blocco» più sotto).

## 3. Aggiornare l'app

Quando facciamo modifiche insieme, io preparo tutto e faccio il commit. Poi tu, nel terminale nella cartella del progetto:

```bash
git push
```

GitHub Pages ripubblica da solo in un minuto o due. Sul telefono, alla prossima apertura dell'app (con rete) compare
l'avviso **«È pronto un aggiornamento dell'app»** con il pulsante **Aggiorna**. Gli aggiornamenti non toccano mai i
tuoi dati. Se non premi, l'aggiornamento si attiva da solo la volta dopo che chiudi e riapri l'app.

## 4. Backup e ripristino

I dati vivono solo nel telefono: se lo perdi, lo resetti o disinstalli Chrome/l'app, senza backup sono persi.
**Fai un backup ogni tanto** (ad esempio una volta a settimana), e conservalo fuori dal telefono (computer, cloud personale…).

**Fare un backup:** *Impostazioni → Esporta backup (JSON)*. L'app chiede se proteggerlo con una **password**:
- **Con password (consigliato):** scegli una password (almeno 10 caratteri, meglio una frase di più parole) e la ripeti. Il file
  `diario-stoico-AAAA-MM-GG-cifrato.json` finisce nella cartella Download e **non rivela nulla del diario**: chi lo trova non può
  leggerlo senza la password. L'app lo riapre subito per verificare che la password funzioni.
- **Senza password:** il file `diario-stoico-AAAA-MM-GG.json` è testo semplice, leggibile da chiunque lo trovi.

**La password non è salvata da nessuna parte e non si può recuperare.** Se la perdi, quel backup è perso per sempre. Tienila in
un gestore di password o scritta in un posto sicuro, separata dal file. Un file cifrato non «chiede» la password da solo:
è semplicemente illeggibile; per aprirlo serve l'app (o un programma che conosca il formato) e la password giusta.

Accanto al pulsante leggi «ultimo backup: …» (è solo un'informazione, non un promemoria).

**Ripristinare:** *Impostazioni → Importa da file…*, scegli il file. L'app lo controlla e ti mostra un riepilogo
(quante voci, da quando a quando). Finché non scegli, **non cambia nulla**. Poi decidi:

- **Unisci ai dati attuali**: aggiunge le voci che mancano; se una voce esiste in entrambi, vince la più recente.
  Le impostazioni attuali restano quelle che hai.
- **Sostituisci tutto**: cancella il diario presente e mette quello del file (chiede una seconda conferma).
  È la scelta giusta quando ripristini su un telefono nuovo.

Se il file non è valido, l'app te lo dice e non tocca niente.

Il file di backup **non contiene** PIN né impronta (sono legati al telefono): su un telefono nuovo, dopo il ripristino,
riattivi il blocco da *Impostazioni → Blocco*.

## 5. Il blocco (impronta e PIN)

*Impostazioni → Blocco → Attiva il blocco.*

- **Prima di attivarlo fai un backup** (l'app te lo ricorda e lo puoi fare lì).
- Scegli un **PIN di 4-8 cifre**. Se il telefono lo permette, puoi registrare anche l'**impronta**.
- **Con l'impronta attiva** si apre con quella; il PIN compare solo come alternativa («Usa il PIN») se l'impronta non viene
  riconosciuta. **Senza impronta registrata** si entra direttamente con il PIN.
- Android può proporre, al posto dell'impronta, il blocco schermo del telefono: è normale, fa parte del sistema.
- Il diario si richiude se resti fuori dall'app **più di un minuto**. Appena esci, il contenuto viene comunque coperto
  (anche nell'anteprima delle app recenti).
- Dopo 5 PIN sbagliati bisogna aspettare (30 secondi, poi sempre di più).
- Cambiare il PIN, togliere l'impronta o disattivare il blocco richiede prima impronta o PIN.
- Il PIN non è salvato: l'app conserva solo un'«impronta digitale» (hash) non invertibile. PIN e impronta sono legati a
  **questo telefono** e **non finiscono nei backup**. Importare un backup non cambia il blocco.

**Se dimentichi il PIN (e l'impronta non va):** non c'è modo di recuperarlo, perché non esiste un server. Si ricomincia così:
1. Chrome → Impostazioni → Impostazioni sito (o tieni premuta l'icona dell'app → Info app) → **cancella i dati** del sito
   `…github.io`. Il diario sul telefono sparisce.
2. Riapri l'app e importa il tuo ultimo backup (*Sostituisci tutto*). Il blocco sarà spento: puoi riattivarlo.

Per questo il backup prima di attivare il blocco è importante.

> Il blocco è un cancello, non una cifratura: tiene lontano chi prende in mano il telefono, ma i dati restano leggibili da
> chi ha accesso ai file del dispositivo con strumenti da esperto.

## 6. Privacy: cosa è protetto e cosa no (promemoria)

**Dove stanno i tuoi scritti.** Solo nel database di Chrome sul tuo telefono. L'app non invia nulla da nessuna parte: nel
codice non ci sono richieste di rete e una regola di sicurezza della pagina le bloccherebbe comunque verso altri siti.
GitHub ospita solo i file dell'app (il codice), mai i tuoi scritti. Chi apre l'indirizzo pubblico dell'app vede un diario vuoto
e suo, non il tuo.

**Cosa NON è protetto, per ora:**

- **Il telefono sbloccato, se non attivi il blocco dell'app.** Chiunque lo abbia in mano può aprire l'app e leggere tutto.
  Con il blocco attivo serve l'impronta o il PIN (ma i dati non sono cifrati).
- **I file di backup senza password.** Sono testo semplice: li legge chiunque li trovi nella cartella Download o nel cloud dove
  li copi. Per questo l'app propone di proteggerli con una password. Anche i backup cifrati **non vanno mai caricati su
  GitHub** (il `.gitignore` aiuta, ma non sostituisce l'attenzione). Quanto è sicuro un file cifrato dipende dalla password:
  una frase lunga resiste a chi prova password a caso, una parola comune no.
- **I dati dentro l'app.** Non sono cifrati (la cifratura nell'app è prevista dopo, nella Fase 6).
- **La tastiera del telefono** (Samsung o Gboard) vede ciò che digiti: controlla nelle sue impostazioni se sono attive
  funzioni di cloud o di apprendimento. Anche il controllo ortografico «avanzato» di Chrome, se attivo, invia il testo a Google;
  quello di base è locale.

**Attenzione ai tuoi altri siti su GitHub Pages.** I dati di un sito sono legati al suo indirizzo (`TUONOME.github.io`),
non alla cartella. Tutti i progetti che pubblichi con GitHub Pages sotto lo stesso account condividono lo stesso indirizzo:
un altro progetto con codice non fidato (script esterni, librerie sconosciute) potrebbe, nello stesso browser, leggere il
database del diario. Finché pubblichi lì solo cose di cui conosci il codice non c'è problema; se vuoi pubblicare altro con
codice di terzi, separa prima i progetti (altro account o dominio proprio) e chiedimi come.

---

## Per chi sviluppa

Serve Node.js (solo per i test e per il piccolo server locale; l'app in sé non ha dipendenze).

```bash
npm install     # una volta sola: installa solo lo strumento dei test
npm test        # esegue i test automatici (date, Markdown, database, migrazioni, backup, PWA)
npm start       # server locale su http://localhost:8080
npm run sw      # aggiorna l'elenco dei file in sw.js: DA FARE dopo ogni modifica ai file dell'app
npm run icons   # rigenera le icone in icons/
```

**Versione:** a ogni aggiornamento si cambia `APP_VERSION` in `js/util.js` (e `version` in `package.json`, con `.0` in fondo)
e si aggiunge una riga in `CHANGELOG.md`. Piccole modifiche: 1.1, 1.2, 1.3…; modifiche grandi: 2.0, 3.0… I test controllano che i tre posti coincidano.

**Importante:** dopo aver modificato qualunque file dell'app (cartelle `css/`, `js/`, `fonts/`, `icons/`, `index.html`,
`manifest.webmanifest`) esegui `npm run sw`. Questo cambia la versione della cache e permette ai telefoni di accorgersi
dell'aggiornamento. Se ti dimentichi, `npm test` fallisce e te lo ricorda.

### Struttura

```
index.html  manifest.webmanifest  sw.js        pagina, installazione, offline
css/        theme.css (variabili: colori, caratteri, spaziature)  app.css (componenti)
js/         app.js (avvio, blocco, schermate)   navigation.js + routes.js (indirizzi e tasto indietro)
            db.js + migrations.js (IndexedDB e migrazioni)
            dates.js (date AAAA-MM-GG, fuso di Roma)   calendar.js   entries.js   settings.js
            archive.js (letture dell'archivio)   search.js (ricerca)
            backup.js (export/import)   markdown.js (formato del testo)   editor.js + toolbar.js
            pin.js, lockout.js, lockpolicy.js, webauthn*.js (logica del blocco)
            lockscreen.js, lockflow.js, pinpad.js (schermate del blocco)
            autosave.js   appearance.js   dom.js + ui.js
            views/ (today.js, read.js, archive.js, settings.js, dayhead.js)
fonts/      Lora e Inter (licenza OFL, con i testi di licenza)
icons/      icone dell'app          tests/  test automatici          tools/  script di servizio
```

### Come sono salvati i dati

- **IndexedDB** (`diario-stoico`), versione dello schema = `schemaVersion`. Archivi: `entries`, `settings` (usati)
  e `days`, `moduleDefs`, `moduleInstances`, `goals`, `goalLinks` (pronti per le fasi successive).
- Una **voce** ha: `id` (UUID), `date` (`AAAA-MM-GG`), `time` (`HH:MM`), `label` (`mattina` | `giorno` | `sera` | `null`),
  `content` (Markdown), `createdAt`, `updatedAt`.
- Il **testo** è un sottoinsieme di Markdown: `**grassetto**`, `*corsivo*`, `## titoletto`, `- elenco`, `1. elenco`.
  Il testo dell'utente non entra mai nella pagina come HTML: solo come nodi di testo.
- Per cambiare la struttura si aggiunge una **migrazione** in `js/migrations.js` (numero successivo, con `up` e,
  se serve, `migrateData` per i vecchi backup). Le migrazioni non devono mai perdere dati.

### Rete

Il codice dell'app non fa nessuna richiesta di rete. Resta solo il controllo che il browser fa da sé all'apertura per
vedere se `sw.js` è cambiato: è un file di GitHub Pages, non invia nulla di tuo, e offline fallisce in silenzio.

### Licenze dei font

Lora e Inter sono distribuiti con licenza SIL Open Font License 1.1 (testi in `fonts/`), che ne permette l'inclusione
nel repository.
