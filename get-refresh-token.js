/**
 * Script per ottenere il refresh token di Google Calendar
 * 
 * Istruzioni:
 * 1. Esegui: node get-refresh-token.js
 * 2. Apri l'URL mostrato nel browser
 * 3. Autorizza l'applicazione
 * 4. Dopo l'autorizzazione, verrai reindirizzato a https://hr.laba.biz/?code=...
 * 5. Copia il codice dalla URL (il parametro code=...)
 * 6. Incolla il codice qui
 * 7. Copia il refresh token generato e aggiungilo al file .env
 */

const { google } = require('googleapis');
const readline = require('readline');

// Credenziali da variabili d'ambiente o file .env
require('dotenv').config();

// Puoi passare le credenziali come variabili d'ambiente inline:
// GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy GOOGLE_REDIRECT_URI=https://hr.laba.biz node get-refresh-token.js
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://hr.laba.biz';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Errore: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devono essere configurati');
  console.error('\nOpzione 1: Passa le variabili inline al comando:');
  console.error('GOOGLE_CLIENT_ID=750075008732-xxx GOOGLE_CLIENT_SECRET=GOCSPX-xxx GOOGLE_REDIRECT_URI=https://hr.laba.biz node get-refresh-token.js');
  console.error('\nOpzione 2: Crea un file .env temporaneo con:');
  console.error('GOOGLE_CLIENT_ID=750075008732-xxx');
  console.error('GOOGLE_CLIENT_SECRET=GOCSPX-xxx');
  console.error('GOOGLE_REDIRECT_URI=https://hr.laba.biz');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const scopes = ['https://www.googleapis.com/auth/calendar'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent' // Forza il consenso per ottenere il refresh token
});

console.log('\n🔐 AUTENTICAZIONE GOOGLE CALENDAR\n');
console.log('1. Apri questo URL nel browser:');
console.log('\n' + authUrl + '\n');
console.log('2. Autorizza l\'applicazione con il tuo account Google dedicato');
console.log('3. Dopo l\'autorizzazione, verrai reindirizzato a https://hr.laba.biz/?code=...');
console.log('4. Copia il codice dalla URL (il parametro dopo code=)\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Incolla il codice qui: ', (code) => {
  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error('\n❌ Errore recupero token:', err.message);
      if (err.message.includes('redirect_uri_mismatch')) {
        console.error('\n⚠️ ERRORE: Il redirect URI non corrisponde!');
        console.error('Verifica che in Google Cloud Console il redirect URI sia esattamente: https://hr.laba.biz');
      }
      rl.close();
      return;
    }
    
    console.log('\n✅ Token ottenuto con successo!\n');
    console.log('📋 Aggiungi queste variabili al file .env su Railway:\n');
    console.log('GOOGLE_CLIENT_ID=' + CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET=' + CLIENT_SECRET);
    console.log('GOOGLE_REFRESH_TOKEN=' + token.refresh_token);
    console.log('GOOGLE_CALENDAR_ID=primary');
    console.log('GOOGLE_REDIRECT_URI=' + REDIRECT_URI);
    console.log('\n⚠️ IMPORTANTE: Non committare mai queste credenziali nel repository!\n');
    
    rl.close();
  });
});

