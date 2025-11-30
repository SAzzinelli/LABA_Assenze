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
   - Tipo applicazione: **"Web application"** (consigliato)
   - Nome: "HR LABA Calendar Integration"
   - **Authorized redirect URIs**: 
     - **Per server su Railway**: aggiungi l'URL del tuo server Railway (es. `https://your-app-name.railway.app` o il tuo dominio personalizzato)
     - **Per sviluppo locale**: aggiungi `http://localhost` o `http://localhost:3000`
     - **Nota**: Puoi aggiungere più redirect URI se vuoi supportare sia sviluppo che produzione
4. Clicca "Create"
5. Copia il **Client ID** e il **Client Secret**

**Nota importante**: 
- Google Cloud Console non accetta più `urn:ietf:wg:oauth:2.0:oob` come redirect URI
- L'URL del redirect URI deve corrispondere **esattamente** all'URL del tuo server (incluso `http://` o `https://`)
- Se il server è su Railway, usa l'URL completo del tuo servizio Railway

### 3. Ottenere il Refresh Token

Per ottenere il refresh token, usa lo script incluso nel progetto:

1. **Aggiungi le credenziali al file `.env` locale** (solo per eseguire lo script, non committare questo file):
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=https://hr.laba.biz
   ```
   
   **Nota**: Sostituisci `your_client_id_here` e `your_client_secret_here` con le tue credenziali reali ottenute da Google Cloud Console.

2. **Esegui lo script**:
   ```bash
   node get-refresh-token.js
   ```

3. **Segui le istruzioni**:
   - Lo script mostrerà un URL da aprire nel browser
   - Autorizza l'applicazione con il tuo account Google dedicato
   - Dopo l'autorizzazione, Google reindirizzerà a `https://hr.laba.biz/?code=...`
   - Copia il codice dalla URL (il parametro `code=...` dopo il `?`)
   - Incolla il codice nello script quando richiesto
   - Lo script genererà il **Refresh Token**

4. **Copia il Refresh Token** mostrato dallo script

**Nota importante**: 
- Il file `.env` locale non deve essere committato nel repository
- Le credenziali sono già configurate nello script, ma vengono lette da `.env` per sicurezza
- Se il redirect URI è `https://hr.laba.biz`, dopo l'autorizzazione verrai reindirizzato lì e potrai copiare il codice dalla URL

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
GOOGLE_REDIRECT_URI=https://your-app-name.railway.app
```

**Nota importante per Railway**:
- `GOOGLE_REDIRECT_URI` deve corrispondere **esattamente** all'URL del tuo server Railway
- Se il tuo server è su `https://hr-laba.railway.app`, usa quello
- Se hai un dominio personalizzato (es. `https://hr.laba.biz`), usa quello
- Il redirect URI nel file `.env` deve essere identico a quello configurato in Google Cloud Console

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

