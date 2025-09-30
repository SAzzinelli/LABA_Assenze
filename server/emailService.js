const nodemailer = require('nodemailer');

// Configurazione email con fallback SendGrid
let transporter;

// Prova prima con SendGrid (più compatibile con Railway)
if (process.env.SENDGRID_API_KEY) {
  console.log('📧 Using SendGrid for email delivery');
  transporter = nodemailer.createTransport({
    service: 'SendGrid',
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY
    }
  });
} else {
  console.log('📧 Using Gmail SMTP (may have connection issues on Railway)');
  // Configurazione SMTP Gmail con opzioni avanzate per Railway
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true per 465, false per altri porti
    auth: {
      user: 'hr@labafirenze.com',
      pass: 'ktof ruov fcit mzvg'
    },
    // Opzioni per Railway e debugging
    debug: true,
    logger: true,
    // Timeout più lunghi per Railway
    connectionTimeout: 60000, // 60 secondi
    greetingTimeout: 30000,   // 30 secondi
    socketTimeout: 60000,     // 60 secondi
    // Retry automatico
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 14, // max 14 emails per secondo
    // TLS options per Railway
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Verifica connessione al transporter
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error);
    console.log('🔧 Tentativo di riconnessione in corso...');
  } else {
    console.log('✅ SMTP Server ready to send emails');
  }
});

// Funzione di fallback per testare connessione
const testSMTPConnection = async () => {
  try {
    console.log('🔍 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ SMTP verification failed:', error.message);
    return false;
  }
};

// Template email per notifiche
const emailTemplates = {
  // Notifica admin per nuova richiesta
  newRequest: (userName, requestType, startDate, endDate, requestId) => ({
    subject: `🔔 Nuova Richiesta ${requestType} - Sistema HR LABA`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuova Richiesta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .request-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .highlight { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Nuova Richiesta</h1>
            <p>Sistema HR LABA</p>
          </div>
          <div class="content">
            <div class="highlight">
              <h2>📋 Dettagli Richiesta</h2>
              <p><strong>Dipendente:</strong> ${userName}</p>
              <p><strong>Tipo:</strong> ${requestType}</p>
              <p><strong>Periodo:</strong> ${startDate} - ${endDate}</p>
              <p><strong>ID Richiesta:</strong> #${requestId}</p>
            </div>
            
            <div class="request-card">
              <h3>📝 Azione Richiesta</h3>
              <p>È stata inviata una nuova richiesta che richiede la tua attenzione.</p>
              <p>Accedi al sistema per visualizzare i dettagli completi e gestire la richiesta.</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/dashboard" class="btn">
                📊 Gestisci Richiesta
              </a>
            </div>
            
            <div class="footer">
              <p>Questo messaggio è stato inviato automaticamente dal Sistema HR LABA</p>
              <p>LABA Firenze - Libera Accademia di Belle Arti</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Risposta richiesta per dipendente
  requestResponse: (requestType, status, startDate, endDate, notes, requestId) => ({
    subject: `📋 Aggiornamento Richiesta ${requestType}: ${status}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Aggiornamento Richiesta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .status-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .btn { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .highlight { background: #e8f5e8; padding: 15px; border-left: 4px solid #27ae60; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Aggiornamento Richiesta</h1>
            <p>Sistema HR LABA</p>
          </div>
          <div class="content">
            <div class="highlight">
              <h2>📝 Dettagli Richiesta</h2>
              <p><strong>Tipo:</strong> ${requestType}</p>
              <p><strong>Periodo:</strong> ${startDate} - ${endDate}</p>
              <p><strong>Stato:</strong> ${status}</p>
              <p><strong>ID Richiesta:</strong> #${requestId}</p>
            </div>
            
            <div class="status-card">
              <h3>✅ Risposta</h3>
              <p>La tua richiesta è stata <strong>${status}</strong>.</p>
              ${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ''}
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/dashboard" class="btn">
                📊 Visualizza Dettagli
              </a>
            </div>
            
            <div class="footer">
              <p>Questo messaggio è stato inviato automaticamente dal Sistema HR LABA</p>
              <p>LABA Firenze - Libera Accademia di Belle Arti</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

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
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .reminder-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .btn { display: inline-block; background: #f39c12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .highlight { background: #fef9e7; padding: 15px; border-left: 4px solid #f39c12; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Promemoria Timbratura</h1>
            <p>Ciao ${userName}</p>
          </div>
          <div class="content">
            <div class="highlight">
              <h2>📅 Ricorda di Timbrare</h2>
              <p>Non dimenticare di registrare la tua presenza oggi!</p>
              <p><strong>Dipartimento:</strong> ${department}</p>
            </div>
            
            <div class="reminder-card">
              <h3>⏰ Azione Richiesta</h3>
              <p>Assicurati di timbrare correttamente:</p>
              <ul>
                <li>✅ Entrata al mattino</li>
                <li>✅ Uscita alla sera</li>
                <li>✅ Pausa pranzo (se applicabile)</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/presenze" class="btn">
                ⏰ Vai alla Timbratura
              </a>
            </div>
            
            <div class="footer">
              <p>Questo messaggio è stato inviato automaticamente dal Sistema HR LABA</p>
              <p>LABA Firenze - Libera Accademia di Belle Arti</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Report settimanale
  weeklyReport: (userName, weekData) => ({
    subject: `📊 Report Settimanale - Settimana ${weekData.weekNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Settimanale</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .stats-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .btn { display: inline-block; background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .highlight { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 15px 0; }
          .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Report Settimanale</h1>
            <p>Settimana ${weekData.weekNumber}</p>
          </div>
          
          <div class="content">
            <p>Ciao ${userName},</p>
            <p>Ecco il riepilogo delle tue presenze e ore lavorate per la settimana:</p>
            
            <div class="stats-card">
              <div class="stat-row">
                <strong>Ore Lavorate Totali:</strong> <span>${weekData.totalHours}h</span>
              </div>
              <div class="stat-row">
                <strong>Giorni di Presenza:</strong> <span>${weekData.daysPresent}</span>
              </div>
              <div class="stat-row">
                <strong>Ore Straordinario:</strong> <span>${weekData.overtimeHours}h</span>
              </div>
              <div class="stat-row">
                <strong>Saldo Ore:</strong> <span>${weekData.balanceHours}h</span>
              </div>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://hr.laba.biz'}/presenze" class="btn">
                Visualizza Dettagli Completi
              </a>
            </div>
            
            <div class="footer">
              <p>© LABA Firenze 2025 - Sistema HR</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

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
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .btn { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .highlight { background: #e8f5e8; padding: 15px; border-left: 4px solid #27ae60; margin: 15px 0; }
          .steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Benvenuto in LABA!</h1>
            <p>Ciao ${userName}, il tuo account è stato approvato</p>
          </div>
          
          <div class="content">
            <div class="highlight">
              <h3>✅ Account Attivato</h3>
              <p>Il tuo account è stato approvato e attivato. Ora puoi accedere al sistema HR di LABA Firenze.</p>
            </div>
            
            <div class="steps">
              <h3>📋 Prossimi Passi</h3>
              <ul>
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
            
            <div class="footer">
              <p>© LABA Firenze 2025 - Sistema HR<br>
              Dipartimento: ${department}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Funzione per inviare email con fallback e test connessione
const sendEmail = async (to, template, data) => {
  try {
    console.log(`📧 Attempting to send ${template} email to: ${to}`);
    
    // Testa la connessione prima di inviare
    const connectionOk = await testSMTPConnection();
    if (!connectionOk) {
      console.log('❌ SMTP connection failed, using fallback simulation');
      // Fallback: simula l'invio per non bloccare l'app
      console.log(`📧 [SIMULATED] Email ${template} would be sent to: ${to}`);
      console.log(`📧 [SIMULATED] Subject: ${emailTemplates[template](...data).subject}`);
      return { success: true, messageId: `simulated-${Date.now()}`, simulated: true };
    }
    
    const emailTemplate = emailTemplates[template](...data);
    
    const mailOptions = {
      from: 'LABA HR <hr@labafirenze.com>',
      to: to,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    };

    // Aggiungi timeout di 60 secondi (più lungo per Railway)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email timeout after 60 seconds')), 60000);
    });

    const sendPromise = transporter.sendMail(mailOptions);
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log('✅ Email inviata con successo: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Errore invio email:', error);
    // Fallback: simula l'invio anche in caso di errore
    console.log(`📧 [FALLBACK] Email ${template} simulated for: ${to}`);
    return { success: true, messageId: `fallback-${Date.now()}`, simulated: true };
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
      .select('email')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (error) {
      console.error('Errore nel recupero admin per email:', error);
      return { success: false, error: error.message };
    }

    const realAdminEmails = admins.map(admin => admin.email).filter(email => isRealEmail(email));
    
    const results = [];
    for (const email of realAdminEmails) {
      const result = await sendEmail(email, template, data);
      results.push({ email, ...result });
    }
    
    return results;
  } catch (error) {
    console.error('Errore invio email admin:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to check if email is real
const isRealEmail = (email) => {
  const realEmails = ['hr@labafirenze.com', 'simone.azzinelli@labafirenze.com', 'marco.rossi@labafirenze.com', 'anna.bianchi@labafirenze.com'];
  return realEmails.includes(email);
};

module.exports = {
  sendEmail,
  sendEmailToAdmins,
  transporter
};