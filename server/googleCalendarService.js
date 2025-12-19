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
    console.log('🔧 [Google Calendar] Inizio inizializzazione client...');
    // Debug: verifica tutte le possibili varianti del nome
    let clientId = process.env.GOOGLE_CLIENT_ID;
    
    // Se non trovato, prova varianti comuni di errori di digitazione
    if (!clientId) {
      console.log('⚠️ [Google Calendar] GOOGLE_CLIENT_ID non trovato, provo varianti...');
      clientId = process.env['GOOGLE_CLIENT_ID'] || 
                 process.env['GOOGLE_CLIENTID'] || 
                 process.env['GOOGLE_CLIENT_ID '] || // con spazio finale
                 process.env[' GOOGLE_CLIENT_ID'] || // con spazio iniziale
                 process.env['google_client_id'] || // lowercase
                 process.env['Google_Client_Id']; // mixed case
      
      if (clientId) {
        console.log(`✅ [Google Calendar] Trovato GOOGLE_CLIENT_ID con nome alternativo`);
      }
    }
    
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    // Debug: verifica quali variabili sono presenti (senza mostrare i valori completi)
    console.log('🔍 [Google Calendar] Verifica variabili d\'ambiente:');
    console.log(`   GOOGLE_CLIENT_ID: ${clientId ? '✅ presente (' + clientId.substring(0, 20) + '...)' : '❌ mancante'}`);
    console.log(`   GOOGLE_CLIENT_SECRET: ${clientSecret ? '✅ presente (' + clientSecret.substring(0, 10) + '...)' : '❌ mancante'}`);
    console.log(`   GOOGLE_REFRESH_TOKEN: ${refreshToken ? '✅ presente (' + refreshToken.substring(0, 10) + '...)' : '❌ mancante'}`);

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('⚠️ [Google Calendar] Credenziali non configurate. L\'integrazione sarà disabilitata.');
      console.warn('⚠️ [Google Calendar] Verifica che le variabili siano configurate su Railway:');
      console.warn('   - GOOGLE_CLIENT_ID');
      console.warn('   - GOOGLE_CLIENT_SECRET');
      console.warn('   - GOOGLE_REFRESH_TOKEN');
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

    console.log('✅ [Google Calendar] Client inizializzato con successo');
    console.log(`   Calendar ID: ${process.env.GOOGLE_CALENDAR_ID || 'primary (default)'}`);
    console.log(`   Redirect URI: ${process.env.GOOGLE_REDIRECT_URI || process.env.FRONTEND_URL || 'http://localhost'}`);
    console.log(`✅ [Google Calendar] Pronto per creare eventi`);
    return calendarClient;
  } catch (error) {
    console.error('❌ [Google Calendar] Errore inizializzazione:', error);
    console.error('❌ [Google Calendar] Stack:', error.stack);
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
    console.log('📅 [Google Calendar] Tentativo creazione evento:', {
      userName: permissionData.userName,
      type: permissionData.type,
      startDate: permissionData.startDate,
      endDate: permissionData.endDate
    });

    // Inizializza il client se non è già inizializzato
    if (!calendarClient) {
      console.log('📅 [Google Calendar] Client non inizializzato, tentativo inizializzazione...');
      calendarClient = initializeCalendarClient();
      if (!calendarClient) {
        console.error('❌ [Google Calendar] Client non disponibile dopo inizializzazione');
        console.error('   Verifica che le credenziali siano configurate correttamente su Railway');
        return null;
      }
      console.log('✅ [Google Calendar] Client inizializzato con successo');
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

    // Helper function per calcolare l'offset del timezone Europe/Rome per una data specifica
    // Gestisce automaticamente l'ora legale (CET vs CEST)
    const getRomeTimezoneOffset = (dateStr) => {
      // Crea una data UTC di riferimento per questa data (mezzogiorno UTC)
      const utcRef = new Date(`${dateStr}T12:00:00Z`);
      
      // Ottieni la stessa data nel timezone Europe/Rome usando Intl
      // Formattiamo come ISO string per confrontare facilmente
      const romeFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const utcFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const romeStr = romeFormatter.format(utcRef);
      const utcStr = utcFormatter.format(utcRef);
      
      // Calcola l'offset confrontando le ore
      const romeHour = parseInt(romeStr.split('T')[1].split(':')[0]);
      const utcHour = parseInt(utcStr.split('T')[1].split(':')[0]);
      const offsetHours = Math.abs(romeHour - utcHour);
      const offsetSign = romeHour >= utcHour ? '+' : '-';
      
      return { offsetSign, offsetHours };
    };

    // Helper function per creare una data ISO nel timezone Europe/Rome
    // Evita problemi di conversione UTC che causano spostamenti di 1 ora
    const createDateTimeISO = (dateStr, hour, minute) => {
      // Calcola l'offset del timezone Europe/Rome per questa data
      const { offsetSign, offsetHours } = getRomeTimezoneOffset(dateStr);
      
      // Crea la stringa ISO con il timezone corretto
      // Google Calendar interpreterà questa come ora locale Europe/Rome grazie a timeZone: 'Europe/Rome'
      return `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${offsetSign}${String(offsetHours).padStart(2, '0')}:00`;
    };

    // Prepara le date per l'evento
    // Google Calendar richiede date in formato ISO 8601 con timezone
    let startDateTimeISO;
    let endDateTimeISO;

    // Gestione orari in base al tipo di permesso
    if (type === 'permission') {
      // Permesso normale: usa gli orari specifici se disponibili
      if (entryTime && entryTime.trim() !== '' && exitTime && exitTime.trim() !== '') {
        // Entrambi gli orari specificati: da entryTime a exitTime (durata reale del permesso)
        const [entryHour, entryMin] = entryTime.split(':').map(Number);
        const [exitHour, exitMin] = exitTime.split(':').map(Number);
        
        startDateTimeISO = createDateTimeISO(startDate, entryHour, entryMin);
        endDateTimeISO = createDateTimeISO(endDate, exitHour, exitMin);
      } else if (entryTime && entryTime.trim() !== '') {
        // Solo entrata: evento di 1 ora da entryTime (es. entra alle 10 → evento 10:00-11:00)
        const [entryHour, entryMin] = entryTime.split(':').map(Number);
        
        startDateTimeISO = createDateTimeISO(startDate, entryHour, entryMin);
        // Aggiungi 1 ora
        const endHour = entryMin === 59 ? (entryHour + 1) % 24 : entryHour + 1;
        const endMin = entryMin === 59 ? 0 : entryMin;
        endDateTimeISO = createDateTimeISO(endDate, endHour, endMin);
      } else if (exitTime && exitTime.trim() !== '') {
        // Solo uscita: evento di 1 ora da exitTime (es. esce alle 16 → evento 16:00-17:00)
        const [exitHour, exitMin] = exitTime.split(':').map(Number);
        
        startDateTimeISO = createDateTimeISO(startDate, exitHour, exitMin);
        // Aggiungi 1 ora
        const tempDate = new Date(`${startDate}T${String(exitHour).padStart(2, '0')}:${String(exitMin).padStart(2, '0')}:00`);
        tempDate.setHours(tempDate.getHours() + 1);
        const endHourFinal = tempDate.getHours();
        const endMinFinal = tempDate.getMinutes();
        endDateTimeISO = createDateTimeISO(endDate, endHourFinal, endMinFinal);
      } else {
        // Nessun orario: permesso a giornata intera (9:00-18:00)
        startDateTimeISO = createDateTimeISO(startDate, 9, 0);
        endDateTimeISO = createDateTimeISO(endDate, 18, 0);
      }
    } else if (type === 'permission_104' && entryTime && exitTime && entryTime.trim() !== '' && exitTime.trim() !== '') {
      // Permesso 104 con orari specifici
      const [entryHour, entryMin] = entryTime.split(':').map(Number);
      const [exitHour, exitMin] = exitTime.split(':').map(Number);
      
      startDateTimeISO = createDateTimeISO(startDate, entryHour, entryMin);
      endDateTimeISO = createDateTimeISO(endDate, exitHour, exitMin);
    } else {
      // Giornata intera: dalle 9:00 alle 18:00 (default per ferie, malattia, 104 senza orari)
      startDateTimeISO = createDateTimeISO(startDate, 9, 0);
      endDateTimeISO = createDateTimeISO(endDate, 18, 0);
    }

    // Crea l'evento
    const event = {
      summary: eventTitle,
      description: eventDescription,
      start: {
        dateTime: startDateTimeISO,
        timeZone: 'Europe/Rome'
      },
      end: {
        dateTime: endDateTimeISO,
        timeZone: 'Europe/Rome'
      },
      colorId: getColorIdForType(type), // Colore in base al tipo
      reminders: {
        useDefault: false,
        overrides: [] // Nessun promemoria per i permessi
      }
    };

    // Aggiungi l'evento al calendario
    console.log(`📅 [Google Calendar] Tentativo inserimento evento nel calendario: ${calendarId}`);
    console.log(`📅 [Google Calendar] Dettagli evento:`, {
      title: eventTitle,
      description: eventDescription,
      start: event.start.dateTime,
      end: event.end.dateTime,
      colorId: event.colorId
    });
    
    // Verifica prima se il calendario esiste e se abbiamo accesso
    try {
      console.log(`📅 [Google Calendar] Verifica accesso calendario...`);
      const calendarInfo = await calendarClient.calendars.get({
        calendarId: calendarId
      });
      console.log(`✅ [Google Calendar] Calendario trovato: ${calendarInfo.data.summary || calendarId}`);
      console.log(`   Proprietario: ${calendarInfo.data.id || 'N/A'}`);
    } catch (calendarError) {
      console.error(`❌ [Google Calendar] Errore accesso calendario ${calendarId}:`, calendarError.message);
      console.error(`   Codice errore: ${calendarError.code || 'N/A'}`);
      console.error(`   Dettagli completi:`, JSON.stringify(calendarError.response?.data || calendarError, null, 2));
      
      if (calendarError.code === 404) {
        console.error(`\n⚠️ [Google Calendar] ERRORE 404 - Calendario non trovato o non accessibile`);
        console.error(`   Possibili cause:`);
        console.error(`   1. Il Calendar ID potrebbe essere errato`);
        console.error(`   2. L'account Google usato per l'autenticazione (quello del refresh token) NON ha accesso a questo calendario`);
        console.error(`   3. Il calendario potrebbe non essere condiviso correttamente`);
        console.error(`\n   SOLUZIONE:`);
        console.error(`   - Verifica che l'account Google usato per ottenere il refresh token sia lo stesso che ha accesso al calendario`);
        console.error(`   - Oppure condividi il calendario con l'account Google usato per l'autenticazione`);
        console.error(`   - Il calendario è condiviso da: calendari@labafirenze.com`);
        console.error(`   - Assicurati che l'account del refresh token abbia accesso come "Collaboratore" o "Proprietario"`);
      } else if (calendarError.code === 403) {
        console.error(`\n⚠️ [Google Calendar] ERRORE 403 - Accesso negato`);
        console.error(`   L'account non ha i permessi necessari per accedere a questo calendario`);
      }
      
      throw calendarError;
    }
    
    console.log(`📅 [Google Calendar] Creazione evento in corso...`);
    const response = await calendarClient.events.insert({
      calendarId: calendarId,
      resource: event
    });

    console.log(`✅ [Google Calendar] Evento creato con successo: ${eventTitle}`);
    console.log(`   Event ID: ${response.data.id}`);
    console.log(`   Link: ${response.data.htmlLink || 'N/A'}`);
    return response.data;
  } catch (error) {
    console.error('❌ [Google Calendar] Errore creazione evento:', error.message);
    console.error('❌ [Google Calendar] Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    
    // Log più dettagliato per errori comuni
    if (error.message?.includes('invalid_grant')) {
      console.error('⚠️ [Google Calendar] Refresh token scaduto o revocato!');
      console.error('   SOLUZIONE: Rigenera il refresh token usando get-refresh-token.js');
    } else if (error.message?.includes('redirect_uri_mismatch')) {
      console.error('⚠️ [Google Calendar] Redirect URI non corrisponde!');
      console.error('   Verifica che GOOGLE_REDIRECT_URI corrisponda esattamente a quello in Google Cloud Console');
    } else if (error.code === 401) {
      console.error('⚠️ [Google Calendar] Errore autenticazione!');
      console.error('   Verifica che le credenziali siano corrette e che il refresh token sia valido');
    }
    
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

