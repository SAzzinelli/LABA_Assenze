require('dotenv').config();
const { sendEmail } = require('../server/emailService');

async function testEmail() {
  console.log('📧 Invio email di test...');
  
  const emailTo = process.argv[2] || 'simone.azzinelli@labafirenze.com';
  const template = process.argv[3] || 'newRequest';
  
  console.log(`📬 Destinatario: ${emailTo}`);
  console.log(`📋 Template: ${template}`);
  
  // Usa la data di oggi per il test
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  console.log(`📅 Data utilizzata: ${todayStr}`);
  
  let result;
  
  try {
    switch (template) {
      case 'newRequest':
        result = await sendEmail(emailTo, 'newRequest', [
          'Simone Azzinelli',
          'permission',
          todayStr,
          todayStr,
          12345
        ]);
        break;
      case 'requestResponse':
        const status = process.argv[4] || 'approved';
        result = await sendEmail(emailTo, 'requestResponse', [
          'permission',
          status,
          todayStr,
          todayStr,
          'Test di approvazione - Email riformattata con date GG/MM/AAAA',
          12345
        ]);
        break;
      case 'attendanceReminder':
        result = await sendEmail(emailTo, 'attendanceReminder', [
          'Simone Azzinelli',
          'Ufficio'
        ]);
        break;
      case 'weeklyReport':
        result = await sendEmail(emailTo, 'weeklyReport', [
          'Simone Azzinelli',
          {
            weekNumber: 1,
            totalHours: 40,
            daysPresent: 5,
            overtimeHours: 2,
            balanceHours: 2
          }
        ]);
        break;
      default:
        console.error('❌ Template non valido. Usa: newRequest, requestResponse, attendanceReminder, weeklyReport');
        process.exit(1);
    }
    
    if (result.success) {
      console.log('✅ Email inviata con successo!');
      console.log(`📧 Message ID: ${result.messageId || 'N/A'}`);
    } else {
      console.error('❌ Errore invio email:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

testEmail();

