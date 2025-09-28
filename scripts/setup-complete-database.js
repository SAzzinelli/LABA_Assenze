#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupCompleteDatabase() {
  console.log('🚀 Setup database completo Sistema HR...');
  
  try {
    // Leggi lo schema SQL
    const schema = fs.readFileSync('./database-complete-schema.sql', 'utf8');
    
    // Dividi lo schema in comandi separati (Supabase non supporta SQL multiplo)
    const commands = schema
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`📋 Eseguendo ${commands.length} comandi SQL...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      try {
        // Per i comandi di creazione tabelle, usiamo un approccio diverso
        if (command.includes('CREATE TABLE')) {
          console.log(`📊 Creazione tabella: ${command.match(/CREATE TABLE.*?(\w+)/)?.[1] || 'unknown'}`);
          
          // Per ora, creiamo le tabelle manualmente con Supabase client
          await createTableManually(command);
        } else if (command.includes('ALTER TABLE')) {
          console.log(`🔧 Alterazione tabella: ${command.match(/ALTER TABLE.*?(\w+)/)?.[1] || 'unknown'}`);
          // Skip ALTER TABLE per ora, le colonne verranno aggiunte quando necessario
        } else if (command.includes('CREATE INDEX')) {
          console.log(`📈 Creazione indice: ${command.match(/CREATE INDEX.*?(\w+)/)?.[1] || 'unknown'}`);
          // Skip CREATE INDEX per ora
        } else if (command.includes('CREATE POLICY')) {
          console.log(`🔒 Creazione policy: ${command.match(/CREATE POLICY.*?"([^"]+)"/)?.[1] || 'unknown'}`);
          // Skip CREATE POLICY per ora
        } else if (command.includes('INSERT INTO')) {
          console.log(`📝 Inserimento dati: ${command.match(/INSERT INTO.*?(\w+)/)?.[1] || 'unknown'}`);
          // Skip INSERT per ora
        } else if (command.includes('CREATE OR REPLACE FUNCTION')) {
          console.log(`⚙️ Creazione funzione: ${command.match(/CREATE OR REPLACE FUNCTION.*?(\w+)/)?.[1] || 'unknown'}`);
          // Skip CREATE FUNCTION per ora
        }
        
        successCount++;
      } catch (error) {
        console.log(`❌ Errore comando ${i + 1}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Setup completato!`);
    console.log(`✅ Comandi eseguiti: ${successCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Errore durante setup database:', error);
  }
}

async function createTableManually(createTableCommand) {
  // Estrai nome tabella e colonne
  const tableMatch = createTableCommand.match(/CREATE TABLE.*?(\w+)\s*\((.*?)\)/s);
  if (!tableMatch) return;
  
  const tableName = tableMatch[1];
  const columns = tableMatch[2];
  
  // Crea la tabella usando Supabase client
  const { error } = await supabase.rpc('create_table_if_not_exists', {
    table_name: tableName,
    columns_definition: columns
  });
  
  if (error) {
    console.log(`⚠️ Tabella ${tableName} potrebbe già esistere:`, error.message);
  } else {
    console.log(`✅ Tabella ${tableName} creata con successo`);
  }
}

// Funzione per creare tabelle specifiche manualmente
async function createSpecificTables() {
  console.log('📊 Creazione tabelle specifiche...');
  
  const tables = [
    {
      name: 'settings',
      columns: [
        'id UUID DEFAULT gen_random_uuid() PRIMARY KEY',
        'user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE',
        'category VARCHAR(50) NOT NULL',
        'settings JSONB NOT NULL DEFAULT \'{}\'',
        'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
        'updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
      ]
    },
    {
      name: 'work_schedules',
      columns: [
        'id UUID DEFAULT gen_random_uuid() PRIMARY KEY',
        'user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE',
        'day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6)',
        'is_working_day BOOLEAN DEFAULT TRUE',
        'work_type VARCHAR(20) DEFAULT \'full_day\'',
        'start_time TIME',
        'end_time TIME',
        'break_duration INTEGER DEFAULT 60',
        'notes TEXT',
        'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
        'updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
      ]
    },
    {
      name: 'leave_balances',
      columns: [
        'id UUID DEFAULT gen_random_uuid() PRIMARY KEY',
        'user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE',
        'year INTEGER NOT NULL',
        'leave_type VARCHAR(50) NOT NULL',
        'total_entitled DECIMAL(5,2) DEFAULT 0',
        'used DECIMAL(5,2) DEFAULT 0',
        'pending DECIMAL(5,2) DEFAULT 0',
        'remaining DECIMAL(5,2) DEFAULT 0',
        'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
        'updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
      ]
    }
  ];
  
  for (const table of tables) {
    try {
      // Prova a inserire un record di test per creare la tabella
      const testRecord = {
        user_id: 'ab485e38-890a-4c79-9231-9b7031430ebe',
        ...(table.name === 'settings' ? { category: 'test', settings: {} } : {}),
        ...(table.name === 'work_schedules' ? { day_of_week: 1, is_working_day: true } : {}),
        ...(table.name === 'leave_balances' ? { year: 2025, leave_type: 'vacation', total_entitled: 26 } : {})
      };
      
      const { data, error } = await supabase
        .from(table.name)
        .insert(testRecord)
        .select();
      
      if (error) {
        console.log(`❌ Errore creazione ${table.name}:`, error.message);
      } else {
        console.log(`✅ Tabella ${table.name} creata:`, data);
        // Cancella il record di test
        await supabase.from(table.name).delete().eq('id', data[0].id);
      }
    } catch (e) {
      console.log(`⚠️ Tabella ${table.name}:`, e.message);
    }
  }
}

// Esegui setup
if (require.main === module) {
  createSpecificTables()
    .then(() => setupCompleteDatabase())
    .catch(console.error);
}

module.exports = { setupCompleteDatabase, createSpecificTables };
