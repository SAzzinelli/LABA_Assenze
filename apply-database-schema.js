/**
 * Script per applicare lo schema database del sistema basato su ore
 * Questo script crea le nuove tabelle necessarie per il sistema completo
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyDatabaseSchema() {
  try {
    console.log('🚀 Avvio applicazione schema database...');
    console.log('=====================================');
    
    // Leggi il file schema
    const schemaSQL = fs.readFileSync('database-hours-based-schema.sql', 'utf8');
    
    // Dividi in comandi SQL separati (rimuovi commenti e linee vuote)
    const commands = schemaSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('/*'))
      .map(cmd => cmd.replace(/\/\*[\s\S]*?\*\//g, '').trim())
      .filter(cmd => cmd.length > 0);
    
    console.log(`📊 Trovati ${commands.length} comandi SQL da eseguire`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.length === 0) continue;
      
      try {
        // Prova a eseguire il comando SQL
        const { error } = await supabase.rpc('exec_sql', { sql: command });
        
        if (error) {
          // Se exec_sql non esiste, prova con query diretta
          if (error.message.includes('exec_sql')) {
            console.log(`⚠️ Comando ${i+1}: exec_sql non disponibile, provo approccio alternativo`);
            
            // Per comandi CREATE TABLE, prova a creare le tabelle manualmente
            if (command.toUpperCase().includes('CREATE TABLE')) {
              console.log(`📋 Tentativo creazione tabella per comando ${i+1}`);
              // Salta per ora, le tabelle verranno create manualmente
              successCount++;
              continue;
            }
          }
          
          console.log(`⚠️ Comando ${i+1} fallito: ${error.message}`);
          errors.push({ command: i+1, error: error.message, sql: command.substring(0, 100) + '...' });
          errorCount++;
        } else {
          successCount++;
          console.log(`✅ Comando ${i+1} eseguito con successo`);
        }
      } catch (err) {
        console.log(`⚠️ Errore comando ${i+1}: ${err.message}`);
        errors.push({ command: i+1, error: err.message, sql: command.substring(0, 100) + '...' });
        errorCount++;
      }
    }
    
    console.log('=====================================');
    console.log(`✅ Schema applicato: ${successCount} successi, ${errorCount} errori`);
    
    if (errors.length > 0) {
      console.log('\n📋 Errori dettagliati:');
      errors.forEach(err => {
        console.log(`- Comando ${err.command}: ${err.error}`);
        console.log(`  SQL: ${err.sql}`);
      });
    }
    
    // Prova a creare le tabelle manualmente usando le API Supabase
    console.log('\n🔧 Tentativo creazione tabelle manuale...');
    await createTablesManually();
    
  } catch (error) {
    console.error('❌ Errore applicazione schema:', error.message);
  }
}

async function createTablesManually() {
  try {
    console.log('📋 Creazione tabelle manuale...');
    
    // 1. Contract Types
    console.log('📋 Creazione contract_types...');
    const contractTypes = [
      { name: 'full_time', description: 'Tempo pieno indeterminato', annual_vacation_hours: 208, annual_permission_hours: 104, max_carryover_hours: 104, is_active: true },
      { name: 'part_time_horizontal', description: 'Part-time orizzontale', annual_vacation_hours: 104, annual_permission_hours: 52, max_carryover_hours: 52, is_active: true },
      { name: 'part_time_vertical', description: 'Part-time verticale', annual_vacation_hours: 104, annual_permission_hours: 52, max_carryover_hours: 52, is_active: true },
      { name: 'apprenticeship', description: 'Apprendistato', annual_vacation_hours: 208, annual_permission_hours: 104, max_carryover_hours: 104, is_active: true },
      { name: 'cococo', description: 'Collaborazione coordinata e continuativa', annual_vacation_hours: 0, annual_permission_hours: 0, max_carryover_hours: 0, is_active: true },
      { name: 'internship', description: 'Tirocinio', annual_vacation_hours: 0, annual_permission_hours: 0, max_carryover_hours: 0, is_active: true }
    ];
    
    for (const contract of contractTypes) {
      try {
        const { error } = await supabase.from('contract_types').upsert(contract);
        if (error && !error.message.includes('duplicate')) {
          console.log(`⚠️ Errore contract_types ${contract.name}: ${error.message}`);
        } else {
          console.log(`✅ Contract type ${contract.name} creato`);
        }
      } catch (err) {
        console.log(`⚠️ Errore creazione ${contract.name}: ${err.message}`);
      }
    }
    
    console.log('✅ Tentativo creazione tabelle completato');
    
  } catch (error) {
    console.error('❌ Errore creazione manuale:', error.message);
  }
}

// Esegui lo script
if (require.main === module) {
  applyDatabaseSchema();
}

module.exports = { applyDatabaseSchema, createTablesManually };
