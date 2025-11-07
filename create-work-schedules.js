// Script per creare work_schedules per un utente via API
const https = require('https');

const API_URL = 'https://hr.laba.biz';
const EMAIL = 'simone.azzinelli@labadvertising.it';
const PASSWORD = 'Test1234';  // Cambia con la tua password se diversa

async function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function main() {
  try {
    console.log('🔐 Login...');
    const loginRes = await makeRequest(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    
    if (loginRes.status !== 200) {
      console.error('❌ Login fallito:', loginRes.data);
      return;
    }
    
    const token = loginRes.data.token;
    const userId = loginRes.data.user.id;
    console.log('✅ Login OK, User ID:', userId);
    
    // Crea work_schedules per tutti i giorni della settimana
    const schedules = [
      { day_of_week: 1, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Lunedì
      { day_of_week: 2, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Martedì
      { day_of_week: 3, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Mercoledì
      { day_of_week: 4, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Giovedì
      { day_of_week: 5, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Venerdì
      { day_of_week: 6, is_working_day: false, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Sabato
      { day_of_week: 0, is_working_day: false, start_time: '09:00', end_time: '18:00', break_duration: 60 }  // Domenica
    ];
    
    console.log('\n📅 Creazione work_schedules...');
    
    const createRes = await makeRequest(`${API_URL}/api/work-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ schedules })
    });
    
    if (createRes.status === 200 || createRes.status === 201) {
      console.log('✅ Tutti gli orari creati con successo!');
      schedules.forEach(s => {
        const dayName = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][s.day_of_week];
        console.log(`  ${dayName} (${s.day_of_week}): ${s.start_time}-${s.end_time}, working=${s.is_working_day}`);
      });
    } else {
      console.log('❌ Errore:', createRes.status, createRes.data);
    }
    
    console.log('\n✅ Fatto! Ora ricarica la pagina Presenze');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

main();

