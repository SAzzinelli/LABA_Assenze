# 🔧 **GUIDA AMMINISTRATORE - SISTEMA HR BASATO SU ORE**

## 🎯 **INTRODUZIONE**

Questa guida è destinata agli **amministratori del sistema HR** per la gestione completa del nuovo sistema basato su ore.

---

## 🗄️ **GESTIONE DATABASE**

### **📊 Tabelle Principali**

#### **`contract_types`**
Definisce i tipi di contratto e le loro regole:
```sql
- name: Tipo contratto (full_time, part_time_horizontal, etc.)
- annual_vacation_hours: Ore ferie annuali
- annual_permission_hours: Ore permessi annuali  
- max_carryover_hours: Ore massime riportabili
- is_active: Se il contratto è attivo
```

#### **`work_patterns`**
Pattern di lavoro per ogni utente:
```sql
- user_id: ID utente
- contract_type_id: Tipo di contratto
- monday_hours: Ore lunedì
- tuesday_hours: Ore martedì
- wednesday_hours: Ore mercoledì
- thursday_hours: Ore giovedì
- friday_hours: Ore venerdì
- saturday_hours: Ore sabato
- sunday_hours: Ore domenica
- weekly_hours: Ore settimanali totali
- monthly_hours: Ore mensili totali
```

#### **`hours_ledger`**
Registro completo di tutti i movimenti:
```sql
- user_id: ID utente
- category: vacation, permission, overtime
- transaction_type: accrual, usage, expiration, adjustment
- hours: Ore della transazione
- transaction_date: Data transazione
- reason: Motivo della transazione
- period_year: Anno di riferimento
- period_month: Mese di riferimento
```

#### **`current_balances`**
Saldi correnti per ogni utente:
```sql
- user_id: ID utente
- category: vacation, permission, overtime
- year: Anno di riferimento
- total_accrued: Ore totali maturate
- total_used: Ore totali utilizzate
- current_balance: Saldo corrente
- pending_requests: Ore in attesa di approvazione
```

#### **`business_trips`**
Gestione trasferte:
```sql
- user_id: ID utente
- destination: Destinazione
- purpose: Scopo del viaggio
- departure_date: Data partenza
- return_date: Data ritorno
- travel_hours: Ore di viaggio
- event_hours: Ore di evento
- total_hours: Ore totali
- status: pending, approved, rejected, completed
```

---

## 🔄 **OPERAZIONI AUTOMATICHE**

### **📅 Maturazione Mensile**

**Script**: `scripts/monthly-accrual.js`

**Esecuzione**:
```bash
# Maturazione completa
node scripts/monthly-accrual.js

# Test per singolo utente
node scripts/monthly-accrual.js test <user_id>
```

**Cron Job**:
```bash
# Avvia cron job automatico
node scripts/setup-cron.js start

# Ferma cron job
node scripts/setup-cron.js stop

# Test cron job
node scripts/setup-cron.js test
```

**Calcolo Maturazione**:
- **Ferie**: `ore_lavorate_mese * (ore_ferie_annuali / ore_lavoro_annuali)`
- **Permessi**: `ore_lavorate_mese * (ore_permessi_annuali / ore_lavoro_annuali)`

### **🔄 Gestione Carry-Over**

**Script**: `scripts/carryover-management.js`

**Esecuzione**:
```bash
# Carry-over completo (anno precedente)
node scripts/carryover-management.js

# Carry-over per anno specifico
node scripts/carryover-management.js 2024

# Test per singolo utente
node scripts/carryover-management.js test <user_id> [year]
```

**Logica Carry-Over**:
1. **Calcola ore eccedenti**: `saldo_corrente - max_carryover`
2. **Crea transazione scadenza**: Per ore eccedenti
3. **Crea transazione carry-over**: Per ore riportabili
4. **Aggiorna saldi**: Anno corrente azzerato, anno successivo aggiornato

---

## 🛠️ **GESTIONE UTENTI**

### **👤 Creazione Utente**

1. **Crea utente** nella tabella `users`
2. **Assegna tipo contratto** (`contract_type`)
3. **Crea pattern di lavoro** nella tabella `work_patterns`
4. **Genera saldi iniziali** nella tabella `current_balances`

### **📋 Aggiornamento Pattern**

Quando un utente cambia orario:
1. **Disattiva pattern corrente**: `is_active = false`
2. **Crea nuovo pattern**: Con `effective_from` = data cambio
3. **Aggiorna saldi**: Se necessario

### **🔄 Migrazione Dati**

**Script**: `complete-migration.js`

```bash
# Migrazione completa
node complete-migration.js
```

**Operazioni**:
- Crea pattern di lavoro per tutti gli utenti
- Migra saldi esistenti al sistema ore
- Aggiorna richieste ferie con calcoli ore
- Genera maturazioni mensili
- Crea trasferte di esempio

---

## 🔧 **CONFIGURAZIONE SISTEMA**

### **⚙️ Variabili Ambiente**

```env
SUPABASE_URL=https://gojhljczpwbjxbbrtrlq.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **🔐 Sicurezza**

**Row Level Security (RLS)**:
- Tutte le tabelle hanno RLS attivo
- Utenti possono accedere solo ai propri dati
- Admin possono accedere a tutti i dati

**Autenticazione**:
- JWT tokens per API
- Sessioni per frontend
- Middleware `authenticateToken` per protezione

### **📊 Indici Database**

```sql
-- Indici per performance
CREATE INDEX idx_hours_ledger_user_date ON hours_ledger(user_id, transaction_date);
CREATE INDEX idx_current_balances_user_year ON current_balances(user_id, year);
CREATE INDEX idx_work_patterns_user_active ON work_patterns(user_id, is_active);
CREATE INDEX idx_business_trips_user_status ON business_trips(user_id, status);
```

---

## 📈 **MONITORAGGIO E REPORTING**

### **📊 Dashboard Admin**

**Metriche Principali**:
- Utenti attivi totali
- Ore ferie utilizzate nel mese
- Ore permessi utilizzate nel mese
- Ore straordinario accumulate
- Trasferte in corso

**Report Disponibili**:
- Utilizzo ferie per dipendente
- Ore straordinario per dipartimento
- Trasferte per periodo
- Maturazioni mensili
- Carry-over annuale

### **🔍 Query Utili**

**Ore ferie utilizzate per utente**:
```sql
SELECT 
  u.first_name, 
  u.last_name,
  SUM(hl.hours) as ore_ferie_usate
FROM hours_ledger hl
JOIN users u ON hl.user_id = u.id
WHERE hl.category = 'vacation' 
  AND hl.transaction_type = 'usage'
  AND hl.period_year = 2025
GROUP BY u.id, u.first_name, u.last_name;
```

**Saldi correnti per categoria**:
```sql
SELECT 
  category,
  COUNT(*) as utenti,
  SUM(current_balance) as ore_totali,
  AVG(current_balance) as ore_medie
FROM current_balances
WHERE year = 2025
GROUP BY category;
```

---

## 🚨 **RISOLUZIONE PROBLEMI**

### **❌ Errori Comuni**

#### **"Could not find the table"**
- **Causa**: Tabelle non create nel database
- **Soluzione**: Eseguire script di migrazione

#### **"Cannot read properties of undefined"**
- **Causa**: `req.user` non definito
- **Soluzione**: Verificare middleware autenticazione

#### **"Saldo insufficiente"**
- **Causa**: Utente tenta di usare più ore di quelle disponibili
- **Soluzione**: Verificare saldi e pattern di lavoro

### **🔧 Debug**

**Log del Server**:
```bash
# Verifica log server
tail -f server.log

# Verifica errori API
grep "ERROR" server.log
```

**Test Database**:
```bash
# Test connessione
node -e "console.log(process.env.SUPABASE_URL)"

# Test query
node scripts/test-database.js
```

---

## 📋 **CHECKLIST MANUTENZIONE**

### **📅 Operazioni Giornaliere**

- [ ] Verificare log errori server
- [ ] Controllare richieste pendenti
- [ ] Monitorare performance database

### **📅 Operazioni Settimanali**

- [ ] Verificare maturazioni mensili
- [ ] Controllare saldi utenti
- [ ] Aggiornare pattern di lavoro se necessario

### **📅 Operazioni Mensili**

- [ ] Eseguire maturazione mensile
- [ ] Verificare carry-over
- [ ] Generare report utilizzo
- [ ] Backup database

### **📅 Operazioni Annuali**

- [ ] Eseguire gestione carry-over
- [ ] Aggiornare tipi di contratto
- [ ] Revisionare policy aziendali
- [ ] Aggiornare documentazione

---

## 🚀 **DEPLOYMENT E AGGIORNAMENTI**

### **🔄 Deploy Nuove Funzionalità**

1. **Test in ambiente di sviluppo**
2. **Backup database produzione**
3. **Deploy codice**
4. **Eseguire migrazioni**
5. **Verificare funzionamento**

### **📦 Backup e Restore**

**Backup Database**:
```bash
# Backup completo
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Backup tabelle specifiche
pg_dump -t hours_ledger -t current_balances $DATABASE_URL > backup_hours.sql
```

**Restore Database**:
```bash
# Restore completo
psql $DATABASE_URL < backup_20250929.sql

# Restore tabelle specifiche
psql $DATABASE_URL < backup_hours.sql
```

---

## 📞 **SUPPORTO TECNICO**

### **🔧 Team di Sviluppo**

- **Lead Developer**: Simone Azzinelli
- **Email**: simone@laba.biz
- **Telefono**: +39 02 1234567

### **📚 Documentazione Tecnica**

- **API Documentation**: `API_DOCUMENTATION.md`
- **Database Schema**: `database-hours-based-schema.sql`
- **System Guide**: `HOURS_BASED_SYSTEM_GUIDE.md`

### **🐛 Bug Tracking**

Per segnalare bug:
1. **Descrivi il problema** in dettaglio
2. **Includi screenshot** se possibile
3. **Specifica passi** per riprodurre
4. **Invia a**: tech-support@laba.biz

---

## 🎉 **CONCLUSIONE**

Il sistema HR basato su ore offre:

✅ **Automazione completa** delle maturazioni
✅ **Tracciabilità totale** di tutti i movimenti
✅ **Flessibilità** per diversi tipi di contratto
✅ **Scalabilità** per crescita aziendale
✅ **Sicurezza** con RLS e autenticazione

**Il futuro della gestione HR è qui!** 🚀

---

*Ultimo aggiornamento: Settembre 2025*
*Versione sistema: 2.0.0*
*Documentazione per amministratori*
