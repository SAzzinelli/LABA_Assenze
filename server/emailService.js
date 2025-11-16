const { Resend } = require('resend');

// Configurazione Resend
let resend;

if (process.env.RESEND_API_KEY) {
  console.log('📧 Using Resend for email delivery');
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.log('📧 Using Resend with provided API key');
  resend = new Resend('re_ScLMo29m_7NSht5w8Ruu5ST8VHPnPiPWh');
}

// Resend è pronto per l'uso
console.log('✅ Resend configured and ready to send emails');

// Funzione helper per formattare date in formato GG/MM/AAAA
const formatDateItalian = (dateStr) => {
  if (!dateStr) return '';
  
  // Se è già una stringa YYYY-MM-DD, convertila
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  
  // Se è un oggetto Date, formattalo
  if (dateStr instanceof Date) {
    const day = String(dateStr.getDate()).padStart(2, '0');
    const month = String(dateStr.getMonth() + 1).padStart(2, '0');
    const year = dateStr.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return dateStr;
};

// Funzione helper per formattare date estese (es: "08 gennaio 2025")
const formatDateExtended = (dateStr) => {
  if (!dateStr) return '';
  
  const parseLocalDate = (str) => {
    if (typeof str === 'string' && str.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [year, month, day] = str.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(str);
  };
  
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome'
  });
};

// Funzioni helper per traduzione
const getItalianRequestType = (type) => {
  const types = {
    'sick_leave': 'Malattia',
    'vacation': 'Ferie',
    'permission': 'Permesso',
    'permission_104': 'Permesso Legge 104',
    'business_trip': 'Trasferta'
  };
  return types[type] || type;
};

const getItalianStatus = (status) => {
  const statuses = {
    'approved': 'Approvata',
    'rejected': 'Rifiutata',
    'pending': 'In Attesa'
  };
  return statuses[status] || status;
};

// Template email per notifiche
const emailTemplates = {
  // Notifica admin per nuova richiesta
  newRequest: (userName, requestType, startDate, endDate, requestId) => {
    const typeLabel = getItalianRequestType(requestType);
    const dateStart = formatDateItalian(startDate);
    const dateEnd = formatDateItalian(endDate);
    const dateRange = startDate === endDate ? dateStart : `${dateStart} - ${dateEnd}`;
    
    return {
      subject: `🔔 Nuova Richiesta ${typeLabel} - Sistema HR LABA`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nuova Richiesta</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .info-box { background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .info-box h2 { margin-top: 0; color: #1E40AF; font-size: 18px; }
            .info-row { margin: 10px 0; }
            .info-label { font-weight: bold; color: #1E40AF; }
            .btn { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .btn:hover { background: #2563EB; }
            .footer { text-align: center; padding: 20px; background: #F9FAFB; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Nuova Richiesta ${typeLabel}</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistema HR LABA</p>
            </div>
            <div class="content">
              <p style="font-size: 16px; margin-bottom: 20px;">È stata ricevuta una nuova richiesta che richiede la tua attenzione.</p>
              
              <div class="info-box">
                <h2>📋 Dettagli Richiesta</h2>
                <div class="info-row">
                  <span class="info-label">Dipendente:</span> ${userName}
                </div>
                <div class="info-row">
                  <span class="info-label">Tipo Richiesta:</span> ${typeLabel}
                </div>
                <div class="info-row">
                  <span class="info-label">Periodo:</span> ${dateRange}
                </div>
                <div class="info-row">
                  <span class="info-label">ID Richiesta:</span> #${requestId}
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/permessi" class="btn">
                  📊 Gestisci Richiesta
                </a>
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">
                Accedi al sistema per visualizzare i dettagli completi e gestire la richiesta.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 5px 0;">Questo messaggio è stato inviato automaticamente dal Sistema HR LABA</p>
              <p style="margin: 5px 0;">LABA Firenze - Libera Accademia di Belle Arti</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  // Risposta richiesta per dipendente
  requestResponse: (requestType, status, startDate, endDate, notes, requestId) => {
    const typeLabel = getItalianRequestType(requestType);
    const statusLabel = getItalianStatus(status);
    const dateStart = formatDateItalian(startDate);
    const dateEnd = formatDateItalian(endDate);
    const dateRange = startDate === endDate ? dateStart : `${dateStart} - ${dateEnd}`;
    
    // Colori in base allo stato
    const statusColor = status === 'approved' ? '#10B981' : '#EF4444'; // Verde per approvato, Rosso per rifiutato
    const statusBg = status === 'approved' ? '#D1FAE5' : '#FEE2E2';
    const statusText = status === 'approved' ? 'Approvata' : 'Rifiutata';
    const headerColor = status === 'approved' 
      ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
      : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
    
    return {
      subject: `📋 Richiesta ${typeLabel} ${statusText} - Sistema HR LABA`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aggiornamento Richiesta</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: ${headerColor}; color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .status-box { background: ${statusBg}; border-left: 4px solid ${statusColor}; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .status-box h2 { margin-top: 0; color: ${statusColor}; font-size: 18px; }
            .info-row { margin: 10px 0; }
            .info-label { font-weight: bold; color: #374151; }
            .btn { display: inline-block; background: ${statusColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .btn:hover { opacity: 0.9; }
            .notes-box { background: #F9FAFB; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #E5E7EB; }
            .footer { text-align: center; padding: 20px; background: #F9FAFB; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Richiesta ${typeLabel} ${statusText}</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistema HR LABA</p>
            </div>
            <div class="content">
              <p style="font-size: 16px; margin-bottom: 20px;">La tua richiesta è stata <strong style="color: ${statusColor};">${statusText}</strong>.</p>
              
              <div class="status-box">
                <h2>📝 Dettagli Richiesta</h2>
                <div class="info-row">
                  <span class="info-label">Tipo Richiesta:</span> ${typeLabel}
                </div>
                <div class="info-row">
                  <span class="info-label">Periodo:</span> ${dateRange}
                </div>
                <div class="info-row">
                  <span class="info-label">Stato:</span> <strong style="color: ${statusColor};">${statusLabel}</strong>
                </div>
                <div class="info-row">
                  <span class="info-label">ID Richiesta:</span> #${requestId}
                </div>
              </div>
              
              ${notes ? `
                <div class="notes-box">
                  <strong>Note:</strong><br>
                  ${notes}
                </div>
              ` : ''}
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/permessi" class="btn">
                  📊 Visualizza Dettagli
                </a>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 5px 0;">Questo messaggio è stato inviato automaticamente dal Sistema HR LABA</p>
              <p style="margin: 5px 0;">LABA Firenze - Libera Accademia di Belle Arti</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  // Promemoria timbratura
  attendanceReminder: (userName, department) => ({
    subject: `⏰ Promemoria Timbratura - LABA Firenze`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Promemoria Timbratura</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .reminder-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .reminder-box h2 { margin-top: 0; color: #92400E; font-size: 18px; }
          .btn { display: inline-block; background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .btn:hover { background: #D97706; }
          .checklist { list-style: none; padding: 0; }
          .checklist li { padding: 8px 0; padding-left: 30px; position: relative; }
          .checklist li:before { content: "✅"; position: absolute; left: 0; }
          .footer { text-align: center; padding: 20px; background: #F9FAFB; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Promemoria Timbratura</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Ciao ${userName}</p>
          </div>
          <div class="content">
            <p style="font-size: 16px; margin-bottom: 20px;">Non dimenticare di registrare la tua presenza oggi!</p>
            
            <div class="reminder-box">
              <h2>📅 Ricorda di Timbrare</h2>
              <p><strong>Dipartimento:</strong> ${department || 'Ufficio'}</p>
              <p style="margin-top: 15px;"><strong>Assicurati di timbrare correttamente:</strong></p>
              <ul class="checklist">
                <li>Entrata al mattino</li>
                <li>Uscita alla sera</li>
                <li>Pausa pranzo (se applicabile)</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/presenze" class="btn">
                ⏰ Vai alla Timbratura
              </a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 5px 0;">Questo messaggio è stato inviato automaticamente dal Sistema HR LABA</p>
            <p style="margin: 5px 0;">LABA Firenze - Libera Accademia di Belle Arti</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Report settimanale
  weeklyReport: (userName, weekData) => {
    const weekNumber = weekData.weekNumber || 1;
    const totalHours = weekData.totalHours || 0;
    const daysPresent = weekData.daysPresent || 0;
    const overtimeHours = weekData.overtimeHours || 0;
    const balanceHours = weekData.balanceHours || 0;
    
    // Formatta ore in formato "Xh Ym"
    const formatHours = (hours) => {
      const h = Math.floor(Math.abs(hours));
      const m = Math.round((Math.abs(hours) - h) * 60);
      const sign = hours < 0 ? '-' : '';
      if (m === 0) return `${sign}${h}h`;
      return `${sign}${h}h ${m}m`;
    };
    
    return {
      subject: `📊 Report Settimanale - Settimana ${weekNumber} - Sistema HR LABA`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Report Settimanale</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .stats-box { background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .stats-box h2 { margin-top: 0; color: #1E40AF; font-size: 18px; }
            .stat-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #DBEAFE; }
            .stat-row:last-child { border-bottom: none; }
            .stat-label { font-weight: 600; color: #1E40AF; }
            .stat-value { font-weight: bold; color: #1F2937; font-size: 16px; }
            .stat-value.positive { color: #10B981; }
            .stat-value.negative { color: #EF4444; }
            .btn { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .btn:hover { background: #2563EB; }
            .footer { text-align: center; padding: 20px; background: #F9FAFB; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Report Settimanale</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Settimana ${weekNumber}</p>
            </div>
            <div class="content">
              <p style="font-size: 16px; margin-bottom: 20px;">Ciao ${userName},</p>
              <p>Ecco il riepilogo delle tue presenze e ore lavorate per la settimana:</p>
              
              <div class="stats-box">
                <h2>📈 Riepilogo Settimanale</h2>
                <div class="stat-row">
                  <span class="stat-label">Ore Lavorate Totali:</span>
                  <span class="stat-value">${formatHours(totalHours)}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Giorni di Presenza:</span>
                  <span class="stat-value">${daysPresent}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Ore Straordinario:</span>
                  <span class="stat-value ${overtimeHours > 0 ? 'positive' : ''}">${formatHours(overtimeHours)}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Saldo Ore:</span>
                  <span class="stat-value ${balanceHours >= 0 ? 'positive' : 'negative'}">${formatHours(balanceHours)}</span>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/presenze" class="btn">
                  📊 Visualizza Dettagli Completi
                </a>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 5px 0;">© LABA Firenze 2025 - Sistema HR</p>
              <p style="margin: 5px 0;">Questo messaggio è stato inviato automaticamente</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  welcome: (userName, department) => ({
    subject: `🎉 Benvenuto in LABA Firenze!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto in LABA</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .welcome-box { background: #D1FAE5; border-left: 4px solid #10B981; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .welcome-box h3 { margin-top: 0; color: #065F46; font-size: 18px; }
          .steps-box { background: #F9FAFB; padding: 20px; margin: 20px 0; border-radius: 5px; border: 1px solid #E5E7EB; }
          .steps-box h3 { margin-top: 0; color: #374151; font-size: 18px; }
          .steps-list { list-style: none; padding: 0; }
          .steps-list li { padding: 10px 0; padding-left: 35px; position: relative; }
          .steps-list li:before { content: "📋"; position: absolute; left: 0; font-size: 18px; }
          .btn { display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .btn:hover { background: #059669; }
          .footer { text-align: center; padding: 20px; background: #F9FAFB; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Benvenuto in LABA!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Ciao ${userName}, il tuo account è stato approvato</p>
          </div>
          <div class="content">
            <div class="welcome-box">
              <h3>✅ Account Attivato</h3>
              <p>Il tuo account è stato approvato e attivato. Ora puoi accedere al sistema HR di LABA Firenze.</p>
            </div>
            
            <div class="steps-box">
              <h3>📋 Prossimi Passi</h3>
              <ul class="steps-list">
                <li>Accedi al sistema con le tue credenziali</li>
                <li>Completa il tuo profilo</li>
                <li>Configura il tuo orario di lavoro</li>
                <li>Inizia a timbrare le presenze</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/login" class="btn">
                🚀 Accedi al Sistema
              </a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 5px 0;">© LABA Firenze 2025 - Sistema HR</p>
            <p style="margin: 5px 0;">Dipartimento: ${department || 'Ufficio'}</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Funzione per inviare email con Resend
const sendEmail = async (to, template, data) => {
  try {
    console.log(`📧 Tentativo invio email ${template} a: ${to}`);
    
    if (!to || !emailTemplates[template]) {
      console.error(`❌ Parametri non validi: to=${to}, template=${template}`);
      return { success: false, error: 'Parametri non validi' };
    }
    
    const emailTemplate = emailTemplates[template](...data);
    
    const result = await resend.emails.send({
      from: 'LABA HR <hr@labafirenze.com>',
      to: to,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });

    console.log(`✅ Email inviata con successo a ${to}:`, result.data?.id);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error(`❌ Errore invio email a ${to}:`, error);
    return { success: false, error: error.message };
  }
};

// Funzione per inviare email a tutti gli admin
const sendEmailToAdmins = async (template, data) => {
  try {
    // Recupera tutti gli admin reali dal database
    const { createClient } = require('@supabase/supabase-js');
    require('dotenv').config();
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: admins, error } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (error) {
      console.error('❌ Errore nel recupero admin per email:', error);
      return { success: false, error: error.message };
    }

    if (!admins || admins.length === 0) {
      console.log('⚠️ Nessun admin trovato per invio email');
      return { success: false, error: 'Nessun admin trovato' };
    }

    console.log(`📧 Invio email a ${admins.length} admin`);
    
    const results = [];
    for (const admin of admins) {
      // Invia a tutti gli admin, non solo quelli con email "reali"
      if (admin.email) {
        const result = await sendEmail(admin.email, template, data);
        results.push({ email: admin.email, name: `${admin.first_name} ${admin.last_name}`, ...result });
      }
    }
    
    console.log(`✅ Email inviate a ${results.filter(r => r.success).length}/${results.length} admin`);
    return results;
  } catch (error) {
    console.error('❌ Errore invio email admin:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to check if email is real (rimossa restrizione - invia a tutte le email valide)
const isRealEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  // Verifica formato email valido
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  sendEmail,
  sendEmailToAdmins,
  resend,
  formatDateItalian,
  formatDateExtended
};
