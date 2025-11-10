// Script diagnostica per capire perché le ore non vengono calcolate
const https = require('https');

const API_URL = 'https://hr.laba.biz';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
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

async function diagnose() {
  try {
    console.log('\n🔍 DIAGNOSI PROBLEMA ORE A 0h 0m\n');
    console.log('='.repeat(60));
    
    // 1. Login come Simone
    console.log('\n1️⃣ Login come Simone...');
    const loginRes = await makeRequest(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'simone.azzinelli@labadvertising.it',
        password: 'Test1234'
      })
    });
    
    if (loginRes.status !== 200) {
      console.error('❌ Login fallito:', loginRes.data);
      console.log('\n⚠️  CAMBIA LA PASSWORD nello script se necessario!');
      return;
    }
    
    const token = loginRes.data.token;
    const userId = loginRes.data.user.id;
    console.log('✅ Login OK');
    console.log('   User ID:', userId);
    console.log('   Email:', loginRes.data.user.email);
    
    // 2. Controlla gli orari di lavoro
    console.log('\n2️⃣ Controllo orari di lavoro...');
    const schedulesRes = await makeRequest(`${API_URL}/api/work-schedules`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (schedulesRes.status === 200) {
      const schedules = schedulesRes.data;
      console.log(`✅ Trovati ${schedules.length} orari di lavoro`);
      
      if (schedules.length === 0) {
        console.log('❌ PROBLEMA: Nessun orario di lavoro trovato!');
        console.log('   Gli schedule devono essere creati.');
      } else {
        console.log('\n📅 Orari configurati:');
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        schedules.forEach(s => {
          console.log(`   ${dayNames[s.day_of_week]} (${s.day_of_week}): ${s.start_time}-${s.end_time}, working=${s.is_working_day}, break=${s.break_duration}m`);
        });
        
        // Controlla venerdì (day 5)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 5 per venerdì
        console.log(`\n🗓️  Oggi è giorno ${dayOfWeek} (0=Dom, 5=Ven)`);
        
        const todaySchedule = schedules.find(s => s.day_of_week === dayOfWeek);
        if (!todaySchedule) {
          console.log(`❌ PROBLEMA: Nessuno schedule per giorno ${dayOfWeek}!`);
        } else if (!todaySchedule.is_working_day) {
          console.log(`❌ PROBLEMA: Giorno ${dayOfWeek} non è working_day!`);
        } else {
          console.log(`✅ Schedule per oggi trovato: ${todaySchedule.start_time}-${todaySchedule.end_time}`);
        }
      }
    } else {
      console.log('❌ Errore nel recupero schedules:', schedulesRes.status, schedulesRes.data);
    }
    
    // 3. Testa l'endpoint current-hours
    console.log('\n3️⃣ Test endpoint /api/attendance/current-hours...');
    const currentHoursRes = await makeRequest(`${API_URL}/api/attendance/current-hours`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status:', currentHoursRes.status);
    console.log('Response:', JSON.stringify(currentHoursRes.data, null, 2));
    
    if (currentHoursRes.status === 200 && currentHoursRes.data.isWorkingDay) {
      const data = currentHoursRes.data;
      console.log('\n📊 RISULTATO:');
      console.log(`   Giorno lavorativo: ${data.isWorkingDay ? 'SÌ' : 'NO'}`);
      console.log(`   Orario corrente: ${data.currentTime}`);
      console.log(`   Ore attese: ${data.expectedHours}h`);
      console.log(`   Ore lavorate: ${data.actualHours}h`);
      console.log(`   Saldo: ${data.balanceHours}h`);
      console.log(`   Stato: ${data.status}`);
      
      if (data.actualHours === 0) {
        console.log('\n❌ PROBLEMA CONFERMATO: actualHours = 0');
        console.log('   Possibili cause:');
        console.log('   1. L\'orario corrente è prima dell\'inizio lavoro');
        console.log('   2. Lo schedule non è configurato correttamente');
        console.log('   3. C\'è un bug nel calcolo real-time');
      } else {
        console.log('\n✅ Le ore vengono calcolate correttamente!');
      }
    } else if (currentHoursRes.status === 200 && !currentHoursRes.data.isWorkingDay) {
      console.log('\n❌ PROBLEMA: Il sistema dice che oggi NON è un giorno lavorativo!');
      console.log('   Message:', currentHoursRes.data.message);
    } else {
      console.log('\n❌ Errore nella chiamata:', currentHoursRes.data);
    }
    
    // 4. Controlla presenze salvate
    console.log('\n4️⃣ Controllo presenze salvate nel database...');
    const today = new Date().toISOString().split('T')[0];
    const attendanceRes = await makeRequest(`${API_URL}/api/attendance?date=${today}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (attendanceRes.status === 200) {
      const attendance = attendanceRes.data;
      console.log(`✅ Trovate ${attendance.length} presenze per oggi`);
      
      attendance.forEach(a => {
        console.log(`   ${a.users?.first_name}: ${a.actual_hours}h / ${a.expected_hours}h`);
      });
      
      if (attendance.length > 0 && attendance[0].actual_hours === 0) {
        console.log('\n⚠️  Le presenze sono salvate a 0h nel database');
        console.log('   Questo blocca il calcolo real-time!');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnosi completata!\n');
    
  } catch (error) {
    console.error('\n❌ Errore durante la diagnosi:', error.message);
  }
}

diagnose();



