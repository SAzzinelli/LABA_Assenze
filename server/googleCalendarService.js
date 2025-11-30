const { google } = require('googleapis');

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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('⚠️ Google Calendar: Credenziali non configurate. L\'integrazione sarà disabilitata.');
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob' // Redirect URI per applicazioni server-side
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    calendarClient = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });

    console.log('✅ Google Calendar client inizializzato con successo');
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

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const { userName, startDate, endDate, hours, type, reason, entryTime, exitTime } = permissionData;

    // Determina il titolo dell'evento in base al tipo
    let eventTitle = '';
    let eventDescription = '';

    switch (type) {
      case 'permission':
        // Permesso normale: mostra ore
        const hoursFormatted = hours > 0
          ? `${Math.floor(hours)}h${Math.round((hours - Math.floor(hours)) * 60) > 0 ? ` ${Math.round((hours - Math.floor(hours)) * 60)}min` : ''}`
          : '0h';
        eventTitle = `Permesso - ${userName} (${hoursFormatted})`;
        eventDescription = `Permesso di ${hoursFormatted}`;
        if (entryTime) eventDescription += `\nEntrata: ${entryTime}`;
        if (exitTime) eventDescription += `\nUscita: ${exitTime}`;
        if (reason) eventDescription += `\nMotivo: ${reason}`;
        break;

      case 'vacation':
        eventTitle = `Ferie - ${userName}`;
        eventDescription = 'Giornata di ferie';
        if (reason) eventDescription += `\nMotivo: ${reason}`;
        break;

      case 'sick_leave':
        eventTitle = `Malattia - ${userName}`;
        eventDescription = 'Assenza per malattia';
        if (reason) eventDescription += `\nMotivo: ${reason}`;
        break;

      case 'permission_104':
        eventTitle = `Permesso 104 - ${userName}`;
        eventDescription = 'Permesso Legge 104';
        if (reason) eventDescription += `\nMotivo: ${reason}`;
        break;

      default:
        eventTitle = `Assenza - ${userName}`;
        eventDescription = type || 'Assenza';
        if (reason) eventDescription += `\nMotivo: ${reason}`;
    }

    // Prepara le date per l'evento
    // Google Calendar richiede date in formato ISO 8601 con timezone
    const startDateTime = new Date(startDate);
    startDateTime.setHours(9, 0, 0, 0); // Inizio giornata lavorativa (9:00)
    
    const endDateTime = new Date(endDate);
    endDateTime.setHours(18, 0, 0, 0); // Fine giornata lavorativa (18:00)

    // Se è un permesso con ore specifiche, calcola l'orario preciso
    if (type === 'permission' && entryTime && exitTime) {
      const [entryHour, entryMin] = entryTime.split(':').map(Number);
      const [exitHour, exitMin] = exitTime.split(':').map(Number);
      
      startDateTime.setHours(entryHour, entryMin, 0, 0);
      endDateTime.setHours(exitHour, exitMin, 0, 0);
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
    const response = await calendarClient.events.insert({
      calendarId: calendarId,
      resource: event
    });

    console.log(`✅ Evento Google Calendar creato: ${eventTitle} (${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error('❌ Errore creazione evento Google Calendar:', error);
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

