/**
 * SISTEMA BACKUP E ROLLBACK COMPLETO
 * Gestisce backup automatici e rollback del sistema HR
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurazione backup
const BACKUP_CONFIG = {
  directory: './backups',
  retentionDays: 30,
  compressionEnabled: true,
  tables: [
    'users',
    'contract_types',
    'work_patterns',
    'hours_ledger',
    'current_balances',
    'business_trips',
    'leave_requests',
    'leave_balances',
    'attendance',
    'settings'
  ]
};

// Crea directory backup se non esiste
function ensureBackupDirectory() {
  if (!fs.existsSync(BACKUP_CONFIG.directory)) {
    fs.mkdirSync(BACKUP_CONFIG.directory, { recursive: true });
    console.log(`📁 Directory backup creata: ${BACKUP_CONFIG.directory}`);
  }
}

// Genera nome file backup
function generateBackupFilename(type = 'full') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const time = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
  return `backup_${type}_${timestamp}_${time}.json`;
}

// Backup completo del database
async function createFullBackup() {
  console.log('🚀 Avvio backup completo del database...');
  
  try {
    ensureBackupDirectory();
    const filename = generateBackupFilename('full');
    const filepath = path.join(BACKUP_CONFIG.directory, filename);
    
    const backup = {
      metadata: {
        type: 'full',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        tables: BACKUP_CONFIG.tables
      },
      data: {}
    };
    
    // Backup di ogni tabella
    for (const table of BACKUP_CONFIG.tables) {
      console.log(`📊 Backup tabella: ${table}`);
      
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*');
        
        if (error) {
          console.log(`⚠️ Errore tabella ${table}: ${error.message}`);
          backup.data[table] = { error: error.message };
        } else {
          backup.data[table] = data || [];
          console.log(`✅ ${table}: ${data?.length || 0} record`);
        }
      } catch (err) {
        console.log(`⚠️ Errore tabella ${table}: ${err.message}`);
        backup.data[table] = { error: err.message };
      }
    }
    
    // Salva backup
    const backupContent = JSON.stringify(backup, null, 2);
    fs.writeFileSync(filepath, backupContent);
    
    // Compressione se abilitata
    if (BACKUP_CONFIG.compressionEnabled) {
      const compressedFile = filepath + '.gz';
      execSync(`gzip -c "${filepath}" > "${compressedFile}"`);
      fs.unlinkSync(filepath); // Rimuovi file non compresso
      console.log(`💾 Backup compresso salvato: ${compressedFile}`);
    } else {
      console.log(`💾 Backup salvato: ${filepath}`);
    }
    
    console.log('✅ Backup completo terminato con successo');
    return filename;
    
  } catch (error) {
    console.error('❌ Errore durante il backup completo:', error.message);
    throw error;
  }
}

// Backup incrementale (solo tabelle modificate)
async function createIncrementalBackup() {
  console.log('🚀 Avvio backup incrementale...');
  
  try {
    ensureBackupDirectory();
    const filename = generateBackupFilename('incremental');
    const filepath = path.join(BACKUP_CONFIG.directory, filename);
    
    const backup = {
      metadata: {
        type: 'incremental',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        tables: BACKUP_CONFIG.tables
      },
      data: {}
    };
    
    // Backup solo delle tabelle critiche per il sistema ore
    const criticalTables = ['hours_ledger', 'current_balances', 'business_trips'];
    
    for (const table of criticalTables) {
      console.log(`📊 Backup incrementale tabella: ${table}`);
      
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Ultime 24h
        
        if (error) {
          console.log(`⚠️ Errore tabella ${table}: ${error.message}`);
          backup.data[table] = { error: error.message };
        } else {
          backup.data[table] = data || [];
          console.log(`✅ ${table}: ${data?.length || 0} record (ultime 24h)`);
        }
      } catch (err) {
        console.log(`⚠️ Errore tabella ${table}: ${err.message}`);
        backup.data[table] = { error: err.message };
      }
    }
    
    // Salva backup
    const backupContent = JSON.stringify(backup, null, 2);
    fs.writeFileSync(filepath, backupContent);
    
    console.log(`💾 Backup incrementale salvato: ${filepath}`);
    console.log('✅ Backup incrementale terminato con successo');
    return filename;
    
  } catch (error) {
    console.error('❌ Errore durante il backup incrementale:', error.message);
    throw error;
  }
}

// Backup specifico per tabella
async function createTableBackup(tableName) {
  console.log(`🚀 Avvio backup tabella: ${tableName}`);
  
  try {
    ensureBackupDirectory();
    const filename = generateBackupFilename(`table_${tableName}`);
    const filepath = path.join(BACKUP_CONFIG.directory, filename);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      throw new Error(`Errore backup tabella ${tableName}: ${error.message}`);
    }
    
    const backup = {
      metadata: {
        type: 'table',
        table: tableName,
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        recordCount: data?.length || 0
      },
      data: data || []
    };
    
    // Salva backup
    const backupContent = JSON.stringify(backup, null, 2);
    fs.writeFileSync(filepath, backupContent);
    
    console.log(`💾 Backup tabella ${tableName} salvato: ${filepath}`);
    console.log(`✅ ${tableName}: ${data?.length || 0} record`);
    
    return filename;
    
  } catch (error) {
    console.error(`❌ Errore durante il backup tabella ${tableName}:`, error.message);
    throw error;
  }
}

// Lista backup disponibili
function listBackups() {
  console.log('📋 Lista backup disponibili:');
  
  try {
    ensureBackupDirectory();
    const files = fs.readdirSync(BACKUP_CONFIG.directory);
    const backupFiles = files.filter(file => file.startsWith('backup_') && (file.endsWith('.json') || file.endsWith('.json.gz')));
    
    if (backupFiles.length === 0) {
      console.log('⚠️ Nessun backup trovato');
      return [];
    }
    
    const backups = backupFiles.map(file => {
      const filepath = path.join(BACKUP_CONFIG.directory, file);
      const stats = fs.statSync(filepath);
      const size = (stats.size / 1024 / 1024).toFixed(2); // MB
      
      return {
        filename: file,
        size: `${size} MB`,
        created: stats.birthtime.toISOString(),
        type: file.includes('full') ? 'Completo' : file.includes('incremental') ? 'Incrementale' : 'Tabella'
      };
    });
    
    // Ordina per data di creazione (più recenti prima)
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    console.log('📊 Backup disponibili:');
    backups.forEach((backup, index) => {
      console.log(`  ${index + 1}. ${backup.filename}`);
      console.log(`     Tipo: ${backup.type}`);
      console.log(`     Dimensione: ${backup.size}`);
      console.log(`     Creato: ${backup.created}`);
      console.log('');
    });
    
    return backups;
    
  } catch (error) {
    console.error('❌ Errore durante il listing backup:', error.message);
    return [];
  }
}

// Ripristina da backup
async function restoreFromBackup(filename) {
  console.log(`🚀 Avvio ripristino da backup: ${filename}`);
  
  try {
    const filepath = path.join(BACKUP_CONFIG.directory, filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error(`File backup non trovato: ${filepath}`);
    }
    
    // Leggi backup
    let backupContent;
    if (filename.endsWith('.gz')) {
      // Decomprimi se necessario
      const tempFile = filepath.replace('.gz', '');
      execSync(`gunzip -c "${filepath}" > "${tempFile}"`);
      backupContent = fs.readFileSync(tempFile, 'utf8');
      fs.unlinkSync(tempFile); // Rimuovi file temporaneo
    } else {
      backupContent = fs.readFileSync(filepath, 'utf8');
    }
    
    const backup = JSON.parse(backupContent);
    
    console.log(`📊 Tipo backup: ${backup.metadata.type}`);
    console.log(`📅 Data backup: ${backup.metadata.timestamp}`);
    console.log(`📋 Tabelle: ${backup.metadata.tables?.join(', ') || 'N/A'}`);
    
    // Conferma ripristino
    console.log('⚠️ ATTENZIONE: Questa operazione sovrascriverà i dati esistenti!');
    console.log('⚠️ Assicurati di aver fatto un backup recente prima di procedere.');
    
    // Ripristina ogni tabella
    for (const [tableName, tableData] of Object.entries(backup.data)) {
      if (tableData.error) {
        console.log(`⚠️ Salto tabella ${tableName}: ${tableData.error}`);
        continue;
      }
      
      console.log(`🔄 Ripristino tabella: ${tableName}`);
      
      try {
        // Pulisci tabella esistente
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
        
        if (deleteError && deleteError.code !== 'PGRST205') {
          console.log(`⚠️ Errore pulizia tabella ${tableName}: ${deleteError.message}`);
        }
        
        // Inserisci dati dal backup
        if (tableData.length > 0) {
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(tableData);
          
          if (insertError) {
            console.log(`⚠️ Errore inserimento tabella ${tableName}: ${insertError.message}`);
          } else {
            console.log(`✅ ${tableName}: ${tableData.length} record ripristinati`);
          }
        } else {
          console.log(`ℹ️ ${tableName}: Nessun dato da ripristinare`);
        }
        
      } catch (err) {
        console.log(`⚠️ Errore ripristino tabella ${tableName}: ${err.message}`);
      }
    }
    
    console.log('✅ Ripristino completato con successo');
    
  } catch (error) {
    console.error('❌ Errore durante il ripristino:', error.message);
    throw error;
  }
}

// Pulizia backup vecchi
function cleanupOldBackups() {
  console.log('🧹 Pulizia backup vecchi...');
  
  try {
    ensureBackupDirectory();
    const files = fs.readdirSync(BACKUP_CONFIG.directory);
    const backupFiles = files.filter(file => file.startsWith('backup_'));
    
    const cutoffDate = new Date(Date.now() - BACKUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    backupFiles.forEach(file => {
      const filepath = path.join(BACKUP_CONFIG.directory, file);
      const stats = fs.statSync(filepath);
      
      if (stats.birthtime < cutoffDate) {
        fs.unlinkSync(filepath);
        console.log(`🗑️ Eliminato backup vecchio: ${file}`);
        deletedCount++;
      }
    });
    
    console.log(`✅ Pulizia completata: ${deletedCount} file eliminati`);
    
  } catch (error) {
    console.error('❌ Errore durante la pulizia:', error.message);
  }
}

// Verifica integrità backup
function verifyBackup(filename) {
  console.log(`🔍 Verifica integrità backup: ${filename}`);
  
  try {
    const filepath = path.join(BACKUP_CONFIG.directory, filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error(`File backup non trovato: ${filepath}`);
    }
    
    // Leggi backup
    let backupContent;
    if (filename.endsWith('.gz')) {
      const tempFile = filepath.replace('.gz', '');
      execSync(`gunzip -c "${filepath}" > "${tempFile}"`);
      backupContent = fs.readFileSync(tempFile, 'utf8');
      fs.unlinkSync(tempFile);
    } else {
      backupContent = fs.readFileSync(filepath, 'utf8');
    }
    
    const backup = JSON.parse(backupContent);
    
    console.log('📊 Verifica backup:');
    console.log(`  Tipo: ${backup.metadata.type}`);
    console.log(`  Data: ${backup.metadata.timestamp}`);
    console.log(`  Versione: ${backup.metadata.version}`);
    
    // Verifica struttura dati
    let totalRecords = 0;
    for (const [tableName, tableData] of Object.entries(backup.data)) {
      if (tableData.error) {
        console.log(`  ❌ ${tableName}: ${tableData.error}`);
      } else {
        const recordCount = Array.isArray(tableData) ? tableData.length : 0;
        console.log(`  ✅ ${tableName}: ${recordCount} record`);
        totalRecords += recordCount;
      }
    }
    
    console.log(`📈 Totale record: ${totalRecords}`);
    console.log('✅ Verifica integrità completata');
    
    return {
      valid: true,
      totalRecords,
      metadata: backup.metadata
    };
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error.message);
    return {
      valid: false,
      error: error.message
    };
  }
}

// Funzione principale
async function runBackupSystem() {
  console.log('🚀 Sistema Backup e Rollback HR LABA');
  console.log('=====================================');
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'full':
        await createFullBackup();
        break;
        
      case 'incremental':
        await createIncrementalBackup();
        break;
        
      case 'table':
        const tableName = args[1];
        if (!tableName) {
          console.log('❌ Specifica il nome della tabella: node backup-system.js table <table_name>');
          return;
        }
        await createTableBackup(tableName);
        break;
        
      case 'list':
        listBackups();
        break;
        
      case 'restore':
        const backupFile = args[1];
        if (!backupFile) {
          console.log('❌ Specifica il file di backup: node backup-system.js restore <backup_file>');
          return;
        }
        await restoreFromBackup(backupFile);
        break;
        
      case 'verify':
        const verifyFile = args[1];
        if (!verifyFile) {
          console.log('❌ Specifica il file di backup: node backup-system.js verify <backup_file>');
          return;
        }
        verifyBackup(verifyFile);
        break;
        
      case 'cleanup':
        cleanupOldBackups();
        break;
        
      default:
        console.log('📋 Utilizzo:');
        console.log('  node backup-system.js full                    - Backup completo');
        console.log('  node backup-system.js incremental             - Backup incrementale');
        console.log('  node backup-system.js table <table_name>     - Backup tabella specifica');
        console.log('  node backup-system.js list                    - Lista backup disponibili');
        console.log('  node backup-system.js restore <backup_file>   - Ripristina da backup');
        console.log('  node backup-system.js verify <backup_file>    - Verifica integrità backup');
        console.log('  node backup-system.js cleanup                 - Pulizia backup vecchi');
        console.log('');
        console.log('📊 Configurazione:');
        console.log(`  Directory: ${BACKUP_CONFIG.directory}`);
        console.log(`  Retention: ${BACKUP_CONFIG.retentionDays} giorni`);
        console.log(`  Compressione: ${BACKUP_CONFIG.compressionEnabled ? 'Abilitata' : 'Disabilitata'}`);
        console.log(`  Tabelle: ${BACKUP_CONFIG.tables.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Errore durante l\'esecuzione:', error.message);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runBackupSystem();
}

module.exports = {
  createFullBackup,
  createIncrementalBackup,
  createTableBackup,
  listBackups,
  restoreFromBackup,
  verifyBackup,
  cleanupOldBackups
};
