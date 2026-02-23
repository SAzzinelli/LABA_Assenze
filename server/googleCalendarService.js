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
 * @param {string} permissionData.permissionType - 'late_entry' | 'early_exit' | 'full_day' (opzionale)
 * @param {string} permissionData.scheduleStartTime - Ora inizio turno (es. '09:00') per eventi con orario
 * @param {string} permissionData.scheduleEndTime - Ora fine turno (es. '18:00') per eventi con orario
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

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const { userName, startDate, endDate, hours, type, reason, entryTime, exitTime, permissionType, scheduleStartTime, scheduleEndTime } = permissionData;

    const schedStart = scheduleStartTime || '09:00';
    const schedEnd = scheduleEndTime || '18:00';

    // Determina titolo e tipo evento
    let eventTitle = '';
    let eventDescription = '';
    let isAllDay = false;

    switch (type) {
      case 'permission': {
        const isFullDay = !entryTime && !exitTime || (permissionType || '').includes('full') || (permissionType || '').includes('giornata');
        const hasLateEntry = (entryTime && entryTime.trim() !== '') || (permissionType === 'late_entry');
        const hasEarlyExit = (exitTime && exitTime.trim() !== '') || (permissionType === 'early_exit');

        if (isFullDay) {
          eventTitle = `NO ${userName}`;
          eventDescription = 'Permesso - Assenza';
          isAllDay = true;
        } else if (hasLateEntry && !hasEarlyExit) {
          eventTitle = userName;
          eventDescription = `Entrata posticipata - rientro alle ${entryTime}`;
        } else if (hasEarlyExit && !hasLateEntry) {
          eventTitle = userName;
          eventDescription = `Uscita anticipata - esce alle ${exitTime}`;
        } else {
          eventTitle = `NO ${userName}`;
          eventDescription = 'Permesso';
          isAllDay = true;
        }
        break;
      }

      case 'vacation':
        eventTitle = `NO ${userName}`;
        eventDescription = 'Ferie';
        isAllDay = true;
        break;

      case 'sick_leave':
        eventTitle = `NO ${userName}`;
        eventDescription = 'Malattia';
        isAllDay = true;
        break;

      case 'permission_104':
        eventTitle = `NO ${userName}`;
        eventDescription = 'Assenza Legge 104';
        isAllDay = true;
        break;

      default:
        eventTitle = `NO ${userName}`;
        eventDescription = type || 'Assenza';
        isAllDay = true;
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
    let eventStart;
    let eventEnd;

    if (isAllDay) {
      // Evento tutto il giorno: usa date (senza orario). End è ESCLUSIVO in Google Calendar.
      const endDateExclusive = new Date(endDate);
      endDateExclusive.setDate(endDateExclusive.getDate() + 1);
      const endDateStr = endDateExclusive.toISOString().split('T')[0];
      eventStart = { date: startDate };
      eventEnd = { date: endDateStr };
    } else if (type === 'permission' && (entryTime || exitTime)) {
      // Entrata posticipata: evento inizia all'ora di inizio turno, finisce all'ora di entrata (periodo assente)
      // Es. Simone entra alle 11 → evento 9:00-11:00
      if (entryTime && entryTime.trim() !== '' && (!exitTime || exitTime.trim() === '')) {
        const [sH, sM] = schedStart.split(':').map(Number);
        const [eH, eM] = entryTime.split(':').map(Number);
        eventStart = { dateTime: createDateTimeISO(startDate, sH, sM), timeZone: 'Europe/Rome' };
        eventEnd = { dateTime: createDateTimeISO(startDate, eH, eM), timeZone: 'Europe/Rome' };
      }
      // Uscita anticipata: evento inizia all'ora di uscita, finisce alla fine del turno (periodo assente)
      // Es. Adriano esce alle 15 → evento 15:00-18:00
      else if (exitTime && exitTime.trim() !== '' && (!entryTime || entryTime.trim() === '')) {
        const [exH, exM] = exitTime.split(':').map(Number);
        const [eH, eM] = schedEnd.split(':').map(Number);
        eventStart = { dateTime: createDateTimeISO(startDate, exH, exM), timeZone: 'Europe/Rome' };
        eventEnd = { dateTime: createDateTimeISO(endDate, eH, eM), timeZone: 'Europe/Rome' };
      } else {
        // Entrambi o nessuno: fallback evento tutto il giorno
        const endDateExclusive = new Date(endDate);
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);
        eventStart = { date: startDate };
        eventEnd = { date: endDateExclusive.toISOString().split('T')[0] };
      }
    } else {
      // Fallback: evento tutto il giorno
      const endDateExclusive = new Date(endDate);
      endDateExclusive.setDate(endDateExclusive.getDate() + 1);
      eventStart = { date: startDate };
      eventEnd = { date: endDateExclusive.toISOString().split('T')[0] };
    }

    // Crea l'evento
    const event = {
      summary: eventTitle,
      description: eventDescription,
      start: eventStart,
      end: eventEnd,
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
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
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

