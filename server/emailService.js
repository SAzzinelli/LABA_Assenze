const nodemailer = require('nodemailer');

// Configurazione SMTP Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hr@labafirenze.com',
    pass: 'ktof ruov fcit mzvg'
  }
});

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
              <h3>⚡ Azione Richiesta</h3>
              <p>È necessaria la tua approvazione per questa richiesta. Accedi al sistema per gestirla.</p>
              <a href="https://hr.laba.biz/permessi" class="btn">👨‍💼 Gestisci Richiesta</a>
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

  // Notifica utente per risposta richiesta
  requestResponse: (requestType, status, startDate, endDate, notes, requestId) => ({
    subject: `✅ Richiesta ${requestType} ${status === 'approved' ? 'Approvata' : 'Rifiutata'} - LABA`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Risposta Richiesta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, ${status === 'approved' ? '#4caf50' : '#f44336'} 0%, ${status === 'approved' ? '#2e7d32' : '#c62828'} 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .status-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .highlight { background: ${status === 'approved' ? '#e8f5e8' : '#ffebee'}; padding: 15px; border-left: 4px solid ${status === 'approved' ? '#4caf50' : '#f44336'}; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${status === 'approved' ? '✅' : '❌'} Richiesta ${status === 'approved' ? 'Approvata' : 'Rifiutata'}</h1>
            <p>Sistema HR LABA</p>
          </div>
          <div class="content">
            <div class="highlight">
              <h2>📋 Dettagli Richiesta</h2>
              <p><strong>Tipo:</strong> ${requestType}</p>
              <p><strong>Periodo:</strong> ${startDate} - ${endDate}</p>
              <p><strong>Stato:</strong> ${status === 'approved' ? '✅ Approvata' : '❌ Rifiutata'}</p>
              <p><strong>ID Richiesta:</strong> #${requestId}</p>
              ${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ''}
            </div>
            
            <div class="status-card">
              <h3>📊 Prossimi Passi</h3>
              ${status === 'approved' ? 
                '<p>La tua richiesta è stata approvata. Puoi procedere secondo il piano concordato.</p>' :
                '<p>La tua richiesta è stata rifiutata. Contatta l\'amministrazione per maggiori informazioni.</p>'
              }
              <a href="https://hr.laba.biz/dashboard" class="btn">📱 Vai al Dashboard</a>
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

  // Promemoria presenze
  attendanceReminder: (userName, workplace) => ({
    subject: `⏰ Promemoria Timbratura - ${workplace}`,
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
          .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .reminder-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .btn { display: inline-block; background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .highlight { background: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Promemoria Timbratura</h1>
            <p>Sistema HR LABA</p>
          </div>
          <div class="content">
            <div class="highlight">
              <h2>👋 Ciao ${userName}!</h2>
              <p>Ricordati di timbrare l'entrata oggi!</p>
              <p><strong>Sede:</strong> ${workplace}</p>
              <p><strong>Orario consigliato:</strong> 09:00</p>
            </div>
            
            <div class="reminder-card">
              <h3>📱 Timbra Ora</h3>
              <p>Accedi al sistema per timbrare l'entrata e iniziare la tua giornata lavorativa.</p>
              <a href="https://hr.laba.biz/presenze" class="btn">⏰ Timbra Entrata</a>
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
            <p>Settimana ${weekData.weekNumber} - Sistema HR LABA</p>
          </div>
          <div class="content">
            <div class="highlight">
              <h2>👋 Ciao ${userName}!</h2>
              <p>Ecco il tuo report settimanale delle presenze.</p>
            </div>
            
            <div class="stats-card">
              <h3>📈 Statistiche Settimana</h3>
              <div class="stat-row">
                <span><strong>Ore Lavorate:</strong></span>
                <span>${weekData.totalHours}h</span>
              </div>
              <div class="stat-row">
                <span><strong>Giorni Presenti:</strong></span>
                <span>${weekData.daysPresent}/5</span>
              </div>
              <div class="stat-row">
                <span><strong>Ore Straordinario:</strong></span>
                <span>${weekData.overtimeHours}h</span>
              </div>
              <div class="stat-row">
                <span><strong>Saldo Ore:</strong></span>
                <span>${weekData.balanceHours}h</span>
              </div>
            </div>
            
            <div class="stats-card">
              <h3>📱 Dettagli Completi</h3>
              <p>Accedi al sistema per vedere tutti i dettagli delle tue presenze.</p>
              <a href="https://hr.laba.biz/presenze" class="btn">📊 Vedi Dettagli</a>
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
  })
};

// Funzione per inviare email
const sendEmail = async (to, template, data) => {
  try {
    const emailTemplate = emailTemplates[template](...data);
    
    const mailOptions = {
      from: 'LABA HR <hr@labafirenze.com>',
      to: to,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email inviata:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Errore invio email:', error);
    return { success: false, error: error.message };
  }
};

// Funzione per inviare email a tutti gli admin
const sendEmailToAdmins = async (template, data) => {
  try {
    // SOLO email reali degli admin
    const realAdminEmails = ['hr@labafirenze.com'];
    
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

module.exports = {
  sendEmail,
  sendEmailToAdmins,
  transporter
};
