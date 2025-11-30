const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

/**
 * Servizio per l'integrazione con Google Calendar
 * Aggiunge automaticamente eventi quando i permessi vengono approvati
 */

let calendarClient = null;

/**
 * Inizializza il client Google Calendar con le credenziali OAuth2
 */
function initializeCalendarClient() {
  try {
    // Debug: verifica tutte le possibili varianti del nome
    let clientId = process.env.GOOGLE_CLIENT_ID;
    
    // Se non trovato, prova varianti comuni di errori di digitazione
    if (!clientId) {
      console.log('⚠️ GOOGLE_CLIENT_ID non trovato, provo varianti...');
      clientId = process.env['GOOGLE_CLIENT_ID'] || 
                 process.env['GOOGLE_CLIENTID'] || 
                 process.env['GOOGLE_CLIENT_ID '] || // con spazio finale
                 process.env[' GOOGLE_CLIENT_ID'] || // con spazio iniziale
                 process.env['google_client_id'] || // lowercase
                 process.env['Google_Client_Id']; // mixed case
      
      if (clientId) {
        console.log(`✅ Trovato GOOGLE_CLIENT_ID con nome alternativo`);
      }
    }
    
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    // Debug: verifica quali variabili sono presenti (senza mostrare i valori completi)
    console.log('🔍 Google Calendar - Verifica variabili d\'ambiente:');
    console.log(`   GOOGLE_CLIENT_ID: ${clientId ? '✅ presente (' + clientId.substring(0, 20) + '...)' : '❌ mancante'}`);
    console.log(`   GOOGLE_CLIENT_SECRET: ${clientSecret ? '✅ presente (' + clientSecret.substring(0, 10) + '...)' : '❌ mancante'}`);
    console.log(`   GOOGLE_REFRESH_TOKEN: ${refreshToken ? '✅ presente (' + refreshToken.substring(0, 10) + '...)' : '❌ mancante'}`);

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('⚠️ Google Calendar: Credenziali non configurate. L\'integrazione sarà disabilitata.');
      return null;
    }

    // Redirect URI: deve corrispondere ESATTAMENTE a quello configurato in Google Cloud Console
    // Per server su Railway: usa l'URL completo del server (es. https://your-app.railway.app)
    // Per sviluppo locale: usa http://localhost
    // IMPORTANTE: Se non specificato, cerca di usare FRONTEND_URL o genera un errore
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || process.env.FRONTEND_URL || 'http://localhost';
    
    if (!process.env.GOOGLE_REDIRECT_URI && !process.env.FRONTEND_URL) {
      console.warn('⚠️ Google Calendar: GOOGLE_REDIRECT_URI non configurato. Usando http://localhost come default.');
      console.warn('⚠️ Assicurati che questo corrisponda al redirect URI configurato in Google Cloud Console.');
    }

    const oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    calendarClient = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });

    console.log('✅ Google Calendar client inizializzato con successo');
    console.log(`   Calendar ID: ${process.env.GOOGLE_CALENDAR_ID || 'primary (default)'}`);
    console.log(`   Redirect URI: ${process.env.GOOGLE_REDIRECT_URI || process.env.FRONTEND_URL || 'http://localhost'}`);
    return calendarClient;
  } catch (error) {
    console.error('❌ Errore inizializzazione Google Calendar:', error);
    return null;
  }
}

/**
 * Aggiunge un evento al calendario Google quando un permesso viene approvato
 * @param {Object} permissionData - Dati del permesso approvato
 * @param {string} permissionData.userName - Nome completo del dipendente (es. "Simone Azzinelli")
 * @param {string} permissionData.startDate - Data inizio permesso (YYYY-MM-DD)
 * @param {string} permissionData.endDate - Data fine permesso (YYYY-MM-DD)
 * @param {number} permissionData.hours - Ore di permesso (solo per permessi normali)
 * @param {string} permissionData.type - Tipo di permesso ('permission', 'vacation', 'sick_leave', 'permission_104')
 * @param {string} permissionData.reason - Motivo del permesso (opzionale)
 * @param {string} permissionData.entryTime - Ora di entrata (opzionale, per permessi)
 * @param {string} permissionData.exitTime - Ora di uscita (opzionale, per permessi)
 * @returns {Promise<Object|null>} Evento creato o null se errore
 */
async function addPermissionEvent(permissionData) {
  try {
    // Inizializza il client se non è già inizializzato
    if (!calendarClient) {
      calendarClient = initializeCalendarClient();
      if (!calendarClient) {
        console.warn('⚠️ Google Calendar: Client non disponibile, evento non aggiunto');
        return null;
      }
    }

    // Calendar ID: può essere 'primary' (calendario principale) o l'ID di un calendario specifico
    // Per trovare l'ID di un calendario: Google Calendar → Impostazioni calendario → Integra il calendario → ID calendario
    // Default: 'primary' = calendario principale dell'account Google usato per l'autenticazione
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const { userName, startDate, endDate, hours, type, reason, entryTime, exitTime } = permissionData;

    // Determina il titolo dell'evento in base al tipo
    let eventTitle = '';
    let eventDescription = '';

    switch (type) {
      case 'permission':
        // Permesso normale: "Nome entra dopo" o "Nome esce prima" in base agli orari
        const hoursFormatted = hours > 0
          ? `${Math.floor(hours)}h${Math.round((hours - Math.floor(hours)) * 60) > 0 ? ` ${Math.round((hours - Math.floor(hours)) * 60)}min` : ''}`
          : '0h';
        
        // Determina se entra dopo, esce prima, o assente tutta la giornata
        if (!entryTime || entryTime.trim() === '') {
          if (!exitTime || exitTime.trim() === '') {
            // Nessun orario: permesso a giornata intera
            eventTitle = `${userName} assente oggi`;
          } else {
            // Solo uscita: "esce prima"
            eventTitle = `${userName} esce prima`;
          }
        } else if (!exitTime || exitTime.trim() === '') {
          // Solo entrata: "entra dopo"
          eventTitle = `${userName} entra dopo`;
        } else {
          // Entrambi gli orari: "entra dopo" (priorità all'entrata)
          eventTitle = `${userName} entra dopo`;
        }
        
        eventDescription = `permesso di ${hoursFormatted}`; // Solo le ore, senza motivo
        break;

      case 'vacation':
        eventTitle = userName; // Solo nome dipendente
        eventDescription = 'Ferie'; // Solo "Ferie", senza motivo
        break;

      case 'sick_leave':
        eventTitle = userName; // Solo nome dipendente
        eventDescription = 'Malattia'; // Solo "Malattia", senza motivo
        break;

      case 'permission_104':
        // Permesso 104: "Nome - Assenza 104" nel titolo
        eventTitle = `${userName} - Assenza 104`;
        eventDescription = 'Assenza Legge 104'; // Solo "Assenza Legge 104", senza motivo
        break;

      default:
        eventTitle = userName;
        eventDescription = type || 'Assenza';
    }

    // Prepara le date per l'evento
    // Google Calendar richiede date in formato ISO 8601 con timezone
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    // Gestione orari in base al tipo di permesso
    if (type === 'permission') {
      // Permesso normale: usa gli orari specifici se disponibili
      if (entryTime && entryTime.trim() !== '' && exitTime && exitTime.trim() !== '') {
        // Entrambi gli orari specificati: da entryTime a exitTime (durata reale del permesso)
        const [entryHour, entryMin] = entryTime.split(':').map(Number);
        const [exitHour, exitMin] = exitTime.split(':').map(Number);
        
        startDateTime.setHours(entryHour, entryMin, 0, 0);
        endDateTime.setHours(exitHour, exitMin, 0, 0);
      } else if (entryTime && entryTime.trim() !== '') {
        // Solo entrata: evento di 1 ora da entryTime (es. entra alle 10 → evento 10:00-11:00)
        const [entryHour, entryMin] = entryTime.split(':').map(Number);
        
        startDateTime.setHours(entryHour, entryMin, 0, 0);
        // Aggiungi 1 ora
        endDateTime.setHours(entryHour, entryMin, 0, 0);
        endDateTime.setHours(endDateTime.getHours() + 1);
      } else if (exitTime && exitTime.trim() !== '') {
        // Solo uscita: evento di 1 ora da exitTime (es. esce alle 16 → evento 16:00-17:00)
        const [exitHour, exitMin] = exitTime.split(':').map(Number);
        
        startDateTime.setHours(exitHour, exitMin, 0, 0);
        // Aggiungi 1 ora
        endDateTime.setHours(exitHour, exitMin, 0, 0);
        endDateTime.setHours(endDateTime.getHours() + 1);
      } else {
        // Nessun orario: permesso a giornata intera (9:00-18:00)
        startDateTime.setHours(9, 0, 0, 0);
        endDateTime.setHours(18, 0, 0, 0);
      }
    } else if (type === 'permission_104' && entryTime && exitTime && entryTime.trim() !== '' && exitTime.trim() !== '') {
      // Permesso 104 con orari specifici
      const [entryHour, entryMin] = entryTime.split(':').map(Number);
      const [exitHour, exitMin] = exitTime.split(':').map(Number);
      
      startDateTime.setHours(entryHour, entryMin, 0, 0);
      endDateTime.setHours(exitHour, exitMin, 0, 0);
    } else {
      // Giornata intera: dalle 9:00 alle 18:00 (default per ferie, malattia, 104 senza orari)
      startDateTime.setHours(9, 0, 0, 0);
      endDateTime.setHours(18, 0, 0, 0);
    }

    // Crea l'evento
    const event = {
      summary: eventTitle,
      description: eventDescription,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Europe/Rome'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Europe/Rome'
      },
      colorId: getColorIdForType(type), // Colore in base al tipo
      reminders: {
        useDefault: false,
        overrides: [] // Nessun promemoria per i permessi
      }
    };

    // Aggiungi l'evento al calendario
    console.log(`📅 Tentativo inserimento evento nel calendario: ${calendarId}`);
    
    // Verifica prima se il calendario esiste e se abbiamo accesso
    try {
      const calendarInfo = await calendarClient.calendars.get({
        calendarId: calendarId
      });
      console.log(`✅ Calendario trovato: ${calendarInfo.data.summary || calendarId}`);
      console.log(`   Proprietario: ${calendarInfo.data.id || 'N/A'}`);
    } catch (calendarError) {
      console.error(`❌ Errore accesso calendario ${calendarId}:`, calendarError.message);
      console.error(`   Codice errore: ${calendarError.code || 'N/A'}`);
      
      if (calendarError.code === 404) {
        console.error(`\n⚠️ ERRORE 404 - Calendario non trovato o non accessibile`);
        console.error(`   Possibili cause:`);
        console.error(`   1. Il Calendar ID potrebbe essere errato`);
        console.error(`   2. L'account Google usato per l'autenticazione (quello del refresh token) NON ha accesso a questo calendario`);
        console.error(`   3. Il calendario potrebbe non essere condiviso correttamente`);
        console.error(`\n   SOLUZIONE:`);
        console.error(`   - Verifica che l'account Google usato per ottenere il refresh token sia lo stesso che ha accesso al calendario`);
        console.error(`   - Oppure condividi il calendario con l'account Google usato per l'autenticazione`);
        console.error(`   - Il calendario è condiviso da: calendari@labafirenze.com`);
        console.error(`   - Assicurati che l'account del refresh token abbia accesso come "Collaboratore" o "Proprietario"`);
      }
      
      throw calendarError;
    }
    
    const response = await calendarClient.events.insert({
      calendarId: calendarId,
      resource: event
    });

    console.log(`✅ Evento Google Calendar creato: ${eventTitle} (${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error('❌ Errore creazione evento Google Calendar:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      stack: error.stack
    });
    // Non bloccare il processo se Google Calendar fallisce
    return null;
  }
}

/**
 * Restituisce il colorId per Google Calendar in base al tipo di permesso
 * @param {string} type - Tipo di permesso
 * @returns {string} ColorId (1-11)
 */
function getColorIdForType(type) {
  const colorMap = {
    'permission': '5',      // Giallo
    'vacation': '9',       // Viola
    'sick_leave': '11',    // Rosso
    'permission_104': '10' // Verde
  };
  return colorMap[type] || '1'; // Default: lavanda
}

/**
 * Elimina un evento dal calendario Google (quando un permesso viene cancellato)
 * @param {string} eventId - ID dell'evento da eliminare
 * @returns {Promise<boolean>} true se eliminato con successo
 */
async function deletePermissionEvent(eventId) {
  try {
    if (!calendarClient) {
      calendarClient = initializeCalendarClient();
      if (!calendarClient) {
        return false;
      }
    }

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    await calendarClient.events.delete({
      calendarId: calendarId,
      eventId: eventId
    });

    console.log(`✅ Evento Google Calendar eliminato: ${eventId}`);
    return true;
  } catch (error) {
    console.error('❌ Errore eliminazione evento Google Calendar:', error);
    return false;
  }
}

module.exports = {
  initializeCalendarClient,
  addPermissionEvent,
  deletePermissionEvent
};

