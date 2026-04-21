# Admin – Gestione moduli GREST

Applicazione **Next.js 14** (App Router) per amministratori: autenticazione, elenco moduli, creazione/modifica dello **schema JSON** dei moduli tramite un **form builder** visuale (drag-and-drop), anteprima e salvataggio sul backend.

Non è il sito pubblico di compilazione moduli: quello è l’app `apps/public` (porta tipica **3000**). L’admin gira di solito sulla **3001**.

---

## Avvio in sviluppo

Dalla **root del monorepo**:

```bash
npm run dev:admin
```

L’app è in ascolto su **http://localhost:3001**.

Oppure dalla cartella dell’app:

```bash
cd apps/admin && npm run dev
```

Build di produzione (verifica tipi e lint):

```bash
npm run build:admin
```

---

## Variabili d’ambiente

Copia l’esempio e personalizza (`.env.local` non va committato):

```bash
cp apps/admin/.env.example apps/admin/.env.local
```

| Variabile | Obbligatorio | Descrizione |
|-----------|--------------|-------------|
| `NEXT_PUBLIC_API_URL` | Sì | Base URL del backend API (es. `http://localhost:8000` o `https://api.tuodominio.it`). Senza questa variabile il client API non è configurato. |
| `NEXT_PUBLIC_PUBLIC_SITE_URL` | No | Origine del **sito pubblico** (es. `http://localhost:3000`), usata per mostrare e copiare il **link di compilazione** `/form/{slug}`. Se assente, vedi comunque lo slug (GUID o ID) ma non l’URL completo. |

---

## Guida rapida: come si usa l’app

1. **Login** (`/login`) — credenziali dell’ambiente backend (stesso flusso token descritto sotto).
2. **Dashboard** (`/dashboard`) — punto di ingresso dopo il login.
3. **Moduli** (`/forms`) — tabella dei moduli con ID, titolo, GUID/slug utile per il link pubblico, azioni (modifica, copia link se configurato).
4. **Nuovo modulo** (`/forms/new`) — crea uno schema vuoto (uno step iniziale). **Salva** crea il modulo sul server e reindirizza alla modifica.
5. **Modifica modulo** (`/forms/[id]/edit`) — builder completo; **Salva** invia l’intero schema con `PUT`.

### Editor moduli (layout)

| Area | Ruolo |
|------|--------|
| **Opzioni modulo** (accordion in cima alla colonna centrale) | Tutto ciò che è **a livello modulo**: ID tecnico (sola lettura), GUID pubblico, link, versione schema, titolo/descrizione **meta**, testi **ringraziamento**, e configurazione **email dopo invio** (vedi sotto). Apri/chiudi l’accordion se ti serve spazio per gli step. |
| **Step e campi** | Lista di **step** ordinabili a drag. Dentro ogni step, i **campi** sono ordinabili e si possono **spostare tra uno step e l’altro** trascinando su un altro campo, sull’**intestazione** dello step (in cima allo step) o nell’**area campi** (anche step vuoti; evidenziazione tratteggiata al passaggio). |
| **Aggiungi campo** (colonna sinistra) | Aggiunge un campo nello **step attivo** (l’ultimo su cui hai lavorato: selezione step o campo). Tipi disponibili: testo, email, numero, textarea, select, radio, checkbox-group, checkbox, switch, data, ecc. |
| **Proprietà** (destra) | Contenuto **contestuale**: se selezioni un **campo**, modifichi ID, tipo, label, validazione, condizioni **showIf** / **requiredIf**, opzioni per select/radio/checkbox-group. Se selezioni solo uno **step** (barra titolo), modifichi ID e titolo dello step. Se non c’è selezione, un breve testo rimanda alle **Opzioni modulo**. |
| **Anteprima** | Anteprima read-only del modulo. |
| **Esporta JSON** | Scarica o copia negli appunti lo **schema intero** del modulo (utile per backup o confronti). |
| **Importa JSON** | Apre una finestra: incolla JSON o scegli un file `.json` (es. da `docs/samples/` o da un export). Valida lo schema e sostituisce il modulo nel builder. Opzione **«Mantieni ID e GUID del modulo aperto»** (predefinita in modifica) evita di sovrascrivere l’identificativo del record al salvataggio. |

Suggerimento: dopo **Salva**, lo schema persistito è quello del backend; in caso di dubbio, ricarica la pagina di modifica per riallinearti.

---

## Opzioni modulo (dettaglio)

- **ID modulo** — identificativo tecnico (DB/API). L’URL di modifica admin è `/forms/{id}/edit`; il submit pubblico usa spesso lo stesso identificatore se non c’è GUID.
- **GUID / link** — segmento opaco per l’URL pubblico (`/form/{guid}`). Puoi rigenerare il GUID; il link completo richiede `NEXT_PUBLIC_PUBLIC_SITE_URL`.
- **Versione schema** — numero intero ≥ 1 (come da convenzioni del progetto).
- **Meta** — titolo e descrizione del modulo (i18n `it` nel builder).
- **Pagina di ringraziamento** — titolo, testo principale e note dopo l’invio riuscito lato pubblico (secondo lo schema condiviso).

### Email dopo invio (`emailOnSubmit`)

Configurazione opzionale **nello stesso JSON del modulo** (come `steps` / `meta`), usata dal **backend** dopo ogni submit: generazione PDF/DOCX da template Word e invio SMTP. L’admin non invia mail da solo.

Campi gestiti dall’editor:

| Campo | Significato |
|-------|-------------|
| `enabled` | Attiva/disattiva l’invio dopo ogni compilazione. |
| `templateFile` | Solo **nome file** `.docx` (es. `iscrizione.docx`), da copiare nella cartella `email_templates/` sul server. |
| `to` | Lista opzionale di email destinatari; se vuota può valere il default SMTP lato server (`SMTP_TO_DEFAULT`). |
| `subject` / `body` | Testo con segnaposto **Jinja** (es. `{{ _module_title }}`, `{{ cognome }}`, `{{ answers['id-campo'] }}`). |
| `attachDocxToo` | Se allegare anche il `.docx` oltre al PDF (quando il PDF è generato). |

Guida operativa completa (SMTP, LibreOffice, Docker, troubleshooting): **[`docs/email-submission-templates.md`](../../docs/email-submission-templates.md)**.

**Validazione in admin:** se `enabled` è attivo, il nome file template deve essere un `.docx` valido (solo nome, senza percorsi); gli indirizzi in `to` devono essere formattati correttamente. In caso di errore, il **Salva** mostra un messaggio e non invia la richiesta.

---

## Condizioni (showIf / requiredIf)

- Per campi **switch** e **checkbox** il valore confrontato è **booleano** (`true` / `false`).
- Per **select** / **radio** / **checkbox-group** si sceglie un’opzione dalla lista di riferimento.
- Per operatori **in** / **notIn** si inserisce **un valore per riga**.

---

## Collegamento al backend

1. Avvia il backend come in `backend/README.md` (es. `http://localhost:8000`).
2. Imposta `NEXT_PUBLIC_API_URL` in `apps/admin/.env.local`.

Contratti utili (dettagli anche in `contratti_e_convenzioni.md` nella root del repo):

- **Auth**: `POST /api/auth/login`, `POST /api/auth/refresh`. Risposta con `accessToken`, `refreshToken`, `expiresIn`.
- **Richieste autenticate**: header `Authorization: Bearer <accessToken>`. Su **401** il client tenta il refresh; se fallisce, redirect a `/login`.
- **Moduli**: `GET /api/admin/modules`, `GET /api/admin/modules/{id}`, `PUT /api/admin/modules/{id}`, `POST /api/admin/modules`. Il body di creazione/aggiornamento è lo **schema modulo completo** (inclusi `meta`, `steps`, `guid`, `emailOnSubmit`, ecc.) come da specifiche del progetto.

---

## Route

| Path | Descrizione |
|------|-------------|
| `/login` | Accesso (pubblica). |
| `/dashboard` | Dashboard (protetta). |
| `/forms` | Elenco moduli (protetta). |
| `/forms/new` | Nuovo modulo (protetta). |
| `/forms/[id]/edit` | Modifica schema (protetta). |
| `/analytics` | Placeholder analytics (protetta). |

Tutte le route tranne `/login` sono **protette**: senza token valido o dopo 401 definitivo si viene reindirizzati al login.

---

## Cose da sapere / troubleshooting

- **Porte** — pubblico **3000**, admin **3001** negli script tipici del monorepo; se cambi porta, aggiorna bookmark e `NEXT_PUBLIC_PUBLIC_SITE_URL` di conseguenza in locale.
- **Link pubblico** — dipende da `NEXT_PUBLIC_PUBLIC_SITE_URL` e dallo slug (GUID preferito). La colonna elenco e il builder mostrano ciò che restituisce l’API.
- **Email dopo invio** — anche con `enabled: true`, l’invio reale richiede SMTP e file template sul **server backend**; in admin configuri solo lo schema.

### Errori `net::ERR_ABORTED 404` su `/_next/static/chunks/...` (dashboard “rotta”)

Non sono causati dal **salvataggio** del modulo sul backend: il log `POST /api/admin/modules` `201` indica che l’API ha funzionato. Il browser sta chiedendo **file JS** che non esistono più nella cartella `.next` corrente (hash dei chunk cambiati).

Succede di solito se:

1. **`next dev` è stato riavviato** (o hai fatto `rm -rf .next` / pull) mentre una **scheda** aveva ancora in cache la pagina vecchia.
2. Sono attivi **due processi** `next dev` sulla stessa porta o cartelle diverse.
3. **Cache del browser** molto aggressiva su `localhost`.

**Procedura consigliata:**

1. Ferma il dev server (Ctrl+C nella finestra dove gira `npm run dev:admin`).
2. Dalla root del monorepo: `rm -rf apps/admin/.next`
3. Riavvia: `npm run dev:admin`
4. Nel browser: **chiudi tutte le schede** su `http://localhost:3001`, oppure apri DevTools → scheda **Application** → **Clear site data** per `localhost:3001`, poi apri di nuovo `/login` o `/dashboard`.
5. Evita di tenere aperte schede “vecchie” dopo un rebuild; usa **navigazione completa** (non solo soft refresh) se vedi ancora 404 sui chunk.

In **produzione** (build statica o `next start`), assicurati di deployare **tutta** la cartella `.next` generata e di non servire HTML vecchio da CDN con chunk nuovi.

---

## Riferimenti nel repo

| Documento / cartella | Contenuto |
|---------------------|-----------|
| `docs/email-submission-templates.md` | SMTP, template Word, oggetto `emailOnSubmit`, Docker |
| `backend/README.md` | Avvio API e variabili ambiente backend |
| `specifiche_moduli_e_architettura.md` (root) | Schema moduli e convenzioni |
| `packages/shared` | Tipi TypeScript condivisi (`Module`, `EmailOnSubmit`, campi, step) usati dall’admin |
