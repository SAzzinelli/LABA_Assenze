# Setup Google Calendar Integration

Questa guida spiega come configurare l'integrazione con Google Calendar per aggiungere automaticamente eventi quando i permessi vengono approvati.

## Prerequisiti

1. Un account Google dedicato per il sistema HR
2. Accesso a Google Cloud Console

## Passaggi per la configurazione

### 1. Creare un progetto in Google Cloud Console

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita l'API "Google Calendar API" per il progetto

### 2. Creare credenziali OAuth 2.0

1. Vai su "APIs & Services" > "Credentials"
2. Clicca su "Create Credentials" > "OAuth client ID"
3. Se è la prima volta, configurare la schermata di consenso OAuth:
   - Tipo applicazione: **"Web application"** (consigliato) o "Desktop app"
   - Nome: "HR LABA Calendar Integration"
   - **Authorized redirect URIs**: 
     - Se usi "Web application": aggiungi `http://localhost` o `http://localhost:3000` (o l'URL del tuo server)
     - Se usi "Desktop app": non è necessario un redirect URI
4. Clicca "Create"
5. Copia il **Client ID** e il **Client Secret**

**Nota importante**: Google Cloud Console non accetta più `urn:ietf:wg:oauth:2.0:oob` come redirect URI. Usa invece un URL HTTP valido come `http://localhost` o l'URL del tuo server.

### 3. Ottenere il Refresh Token

Per ottenere il refresh token, devi eseguire uno script di autenticazione iniziale:

```javascript
// Script: get-refresh-token.js
const { google } = require('googleapis');
const readline = require('readline');

// IMPORTANTE: Usa lo stesso redirect URI che hai configurato in Google Cloud Console
// Se hai usato "Web application" con http://localhost, usa quello
// Se hai usato "Desktop app", puoi usare http://localhost
const REDIRECT_URI = 'http://localhost'; // Cambia se hai usato un URL diverso

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  REDIRECT_URI
);

const scopes = ['https://www.googleapis.com/auth/calendar'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes
});

console.log('Autorizza questa app visitando:', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Incolla il codice qui: ', (code) => {
  oauth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Errore recupero token:', err);
    console.log('Refresh Token:', token.refresh_token);
    rl.close();
  });
});
```

Esegui lo script:
```bash
node get-refresh-token.js
```

1. Copia l'URL mostrato e aprilo nel browser
2. Autorizza l'applicazione con il tuo account Google dedicato
3. Copia il codice di autorizzazione
4. Incolla il codice nello script
5. Copia il **Refresh Token** generato

### 4. Ottenere l'ID del Calendario

1. Vai su [Google Calendar](https://calendar.google.com/)
2. Clicca sulle impostazioni del calendario che vuoi usare
3. Scorri fino a "Integrate calendar"
4. Copia il **Calendar ID** (solitamente è l'email del calendario, es. `your-email@example.com`)
   - Oppure usa `primary` per il calendario principale

### 5. Configurare le variabili d'ambiente

Aggiungi queste variabili al file `.env`:

```env
# Google Calendar Integration
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_CALENDAR_ID=primary
GOOGLE_REDIRECT_URI=http://localhost
```

**Nota**: `GOOGLE_REDIRECT_URI` è opzionale e di default usa `http://localhost`. Usalo solo se hai configurato un redirect URI diverso in Google Cloud Console.

**Nota:** Se non specifichi `GOOGLE_CALENDAR_ID`, verrà usato il calendario principale (`primary`).

### 6. Riavviare il server

Dopo aver configurato le variabili d'ambiente, riavvia il server:

```bash
npm start
```

Dovresti vedere nel log:
```
✅ Google Calendar client inizializzato con successo
📅 Google Calendar: Integrazione attiva
```

## Come funziona

Quando un admin approva un permesso (permesso normale, ferie, malattia, permesso 104), il sistema:

1. Recupera i dati del dipendente (nome e cognome)
2. Crea un evento nel calendario Google con:
   - **Titolo**: Tipo di permesso + nome dipendente + ore (se permesso normale)
   - **Descrizione**: Dettagli del permesso (ore, orari, motivo)
   - **Data/ora**: Dalle 9:00 alle 18:00 (o orari specifici se permesso con entry/exit time)
   - **Colore**: Diverso in base al tipo (giallo per permessi, viola per ferie, rosso per malattia, verde per 104)

## Tipi di eventi creati

- **Permesso normale**: `Permesso - Nome Cognome (Xh Ymin)`
- **Ferie**: `Ferie - Nome Cognome`
- **Malattia**: `Malattia - Nome Cognome`
- **Permesso 104**: `Permesso 104 - Nome Cognome`

## Troubleshooting

### Errore: "Invalid grant"
- Il refresh token potrebbe essere scaduto o revocato
- Rigenera il refresh token seguendo il passo 3

### Errore: "Calendar not found"
- Verifica che il `GOOGLE_CALENDAR_ID` sia corretto
- Assicurati che l'account Google abbia accesso al calendario

### Eventi non vengono creati
- Controlla i log del server per errori
- Verifica che le credenziali siano corrette nel file `.env`
- Assicurati che l'API Google Calendar sia abilitata nel progetto

## Sicurezza

- **NON committare** il file `.env` nel repository
- Mantieni le credenziali segrete
- Usa un account Google dedicato (non personale) per questa integrazione

