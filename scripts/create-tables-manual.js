#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTablesManually() {
  console.log('🚀 Creazione tabelle manuali per Sistema HR...');
  
  const tables = [
    {
      name: 'settings',
      description: 'Impostazioni utente per categoria',
      testData: {
        user_id: 'ab485e38-890a-4c79-9231-9b7031430ebe',
        category: 'company',
        settings: {
          name: 'LABA Firenze',
          email: 'info@labafirenze.com',
          website: 'https://www.labafirenze.com',
          phone: '+39 055 1234567',
          address: 'Via Vecchietti, 123 - Firenze',
          vat: 'IT12345678901'
        }
      }
    },
    {
      name: 'work_schedules',
      description: 'Orari di lavoro personalizzati per dipendenti',
      testData: {
        user_id: 'ab485e38-890a-4c79-9231-9b7031430ebe',
        day_of_week: 1,
        is_working_day: true,
        work_type: 'full_day',
        start_time: '09:00',
        end_time: '18:00',
        break_duration: 60
      }
    },
    {
      name: 'leave_balances',
      description: 'Saldi ferie/permessi per anno',
      testData: {
        user_id: 'ab485e38-890a-4c79-9231-9b7031430ebe',
        year: 2025,
        leave_type: 'vacation',
        total_entitled: 26,
        used: 5,
        pending: 2,
        remaining: 19
      }
    },
    {
      name: 'departments',
      description: 'Dipartimenti aziendali',
      testData: {
        name: 'Amministrazione',
        description: 'Gestione amministrativa e contabile',
        location: 'LABA Firenze - Sede Via Vecchietti',
        is_active: true
      }
    },
    {
      name: 'notifications',
      description: 'Notifiche per utenti',
      testData: {
        user_id: 'ab485e38-890a-4c79-9231-9b7031430ebe',
        title: 'Benvenuto nel Sistema HR',
        message: 'Il tuo account è stato creato con successo',
        type: 'info',
        category: 'general',
        is_read: false
      }
    }
  ];
  
  for (const table of tables) {
    try {
      console.log(`\n📊 Creazione tabella: ${table.name}`);
      console.log(`📝 Descrizione: ${table.description}`);
      
      // Prova a inserire un record di test
      const { data, error } = await supabase
        .from(table.name)
        .insert(table.testData)
        .select();
      
      if (error) {
        console.log(`❌ Tabella ${table.name} non esiste:`, error.message);
        
        // Se la tabella non esiste, proviamo a crearla usando SQL diretto
        console.log(`🔨 Tentativo creazione tabella ${table.name}...`);
        
        const createTableSQL = getCreateTableSQL(table.name);
        if (createTableSQL) {
          const { error: sqlError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
          
          if (sqlError) {
            console.log(`❌ Errore SQL per ${table.name}:`, sqlError.message);
          } else {
            console.log(`✅ Tabella ${table.name} creata con SQL`);
            
            // Riprova l'inserimento
            const { data: retryData, error: retryError } = await supabase
              .from(table.name)
              .insert(table.testData)
              .select();
            
            if (retryError) {
              console.log(`❌ Errore inserimento test data per ${table.name}:`, retryError.message);
            } else {
              console.log(`✅ Test data inseriti in ${table.name}:`, retryData);
              // Cancella il record di test
              await supabase.from(table.name).delete().eq('id', retryData[0].id);
            }
          }
        }
      } else {
        console.log(`✅ Tabella ${table.name} già esiste, test data inseriti:`, data);
        // Cancella il record di test
        await supabase.from(table.name).delete().eq('id', data[0].id);
      }
      
    } catch (e) {
      console.log(`❌ Errore generale per ${table.name}:`, e.message);
    }
  }
  
  console.log('\n🎉 Setup tabelle completato!');
}

function getCreateTableSQL(tableName) {
  const tableSQLs = {
    'settings': `
      CREATE TABLE IF NOT EXISTS settings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        settings JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, category)
      );
    `,
    'work_schedules': `
      CREATE TABLE IF NOT EXISTS work_schedules (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        is_working_day BOOLEAN DEFAULT TRUE,
        work_type VARCHAR(20) DEFAULT 'full_day',
        start_time TIME,
        end_time TIME,
        break_duration INTEGER DEFAULT 60,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, day_of_week)
      );
    `,
    'leave_balances': `
      CREATE TABLE IF NOT EXISTS leave_balances (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        total_entitled DECIMAL(5,2) DEFAULT 0,
        used DECIMAL(5,2) DEFAULT 0,
        pending DECIMAL(5,2) DEFAULT 0,
        remaining DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, year, leave_type)
      );
    `,
    'departments': `
      CREATE TABLE IF NOT EXISTS departments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        manager_id UUID REFERENCES users(id),
        budget DECIMAL(12,2),
        location VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
    'notifications': `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP WITH TIME ZONE,
        action_url VARCHAR(500),
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  };
  
  return tableSQLs[tableName];
}

// Esegui creazione tabelle
if (require.main === module) {
  createTablesManually().catch(console.error);
}

module.exports = { createTablesManually };
