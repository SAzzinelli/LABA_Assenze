# Sistema HR Basato su Ore - Presenze LABA

## 🎯 Panoramica

Il sistema HR è stato completamente aggiornato per implementare un approccio basato su **ore** invece che giorni, seguendo le migliori pratiche per la gestione di contratti, ferie, permessi, monte ore e trasferte.

## 🚀 Installazione e Setup

### 1. Applicare il Nuovo Schema Database

```bash
# Applica il nuovo schema con sistema basato su ore
psql -d presenze_laba -f database-hours-based-schema.sql
```

### 2. Migrare i Dati Esistenti

```bash
# Esegui lo script di migrazione
node scripts/migrate-to-hours-system.js
```

### 3. Testare il Sistema

```bash
# Esegui i test per verificare che tutto funzioni
node test-hours-system.js
```

### 4. Avviare il Server

```bash
# Avvia il server con le nuove API
npm start
```

## 🔧 Architettura del Sistema

### Database Schema

#### Tabelle Principali

- **`contract_types`**: Tipi di contratto (FT, PT, apprendistato, etc.)
- **`work_patterns`**: Pattern di lavoro personalizzati per ogni dipendente
- **`hours_ledger`**: Ledger completo di tutti i movimenti ore
- **`current_balances`**: Saldi correnti per performance
- **`business_trips`**: Gestione trasferte e viaggi per eventi

#### Funzioni SQL

- `get_active_work_pattern()`: Ottiene pattern attivo per data
- `calculate_vacation_hours_for_day()`: Calcola ore ferie per giorno specifico
- `accrue_monthly_hours()`: Maturazione mensile automatica
- `use_hours()`: Utilizzo ore con controllo saldo
- `add_overtime_hours()`: Aggiunta straordinari al monte ore

### API Endpoints

#### Nuovi Endpoint `/api/hours/`

- `GET /contract-types`: Lista tipi di contratto
- `GET /work-patterns`: Pattern di lavoro utente
- `POST /work-patterns`: Crea/aggiorna pattern
- `GET /hours-ledger`: Registro movimenti ore
- `GET /current-balances`: Saldi correnti
- `GET /business-trips`: Trasferte utente
- `POST /business-trips`: Crea trasferta
- `POST /calculate-vacation-hours`: Calcola ore per periodo
- `POST /leave-requests-hours`: Richiesta ferie con calcolo ore

### Frontend Components

#### Componenti Aggiornati

- **`Ferie.jsx`**: Gestione ferie con calcolo ore automatico
- **`hoursCalculation.js`**: Utility per calcoli ore
- **Pattern di lavoro**: Visualizzazione e gestione orari personalizzati

## 📋 Guida Utilizzo

### Per Amministratori

#### 1. Configurare Tipi di Contratto

```sql
-- Esempio: Creare nuovo tipo contratto
INSERT INTO contract_types (name, description, annual_vacation_hours, annual_permission_hours) 
VALUES ('part_time_60', 'Part-time 60%', 125, 62);
```

#### 2. Gestire Pattern di Lavoro

```javascript
// Esempio: Part-time verticale (lun-mer-ven)
const workPattern = {
  contract_type_id: 'part_time_vertical_id',
  effective_from: '2025-01-01',
  monday_hours: 8,
  tuesday_hours: 0,
  wednesday_hours: 8,
  thursday_hours: 0,
  friday_hours: 8,
  saturday_hours: 0,
  sunday_hours: 0
};
```

#### 3. Approvare Richieste Ferie

```javascript
// Approva richiesta e aggiorna saldi automaticamente
PUT /api/hours/admin/leave-requests/:id/approve
{
  "notes": "Approvata per motivi personali"
}
```

### Per Dipendenti

#### 1. Visualizzare Saldi Ore

Il sistema mostra automaticamente:
- **Ore totali**: Ferie/permessi maturati
- **Ore utilizzate**: Già godute
- **Ore rimanenti**: Disponibili per richieste
- **Pattern attivo**: Orari settimanali personalizzati

#### 2. Richiedere Ferie

1. Seleziona date inizio/fine
2. Il sistema calcola automaticamente le ore necessarie
3. Verifica saldo disponibile
4. Invia richiesta

#### 3. Gestire Trasferte

```javascript
// Esempio: Trasferta Milano
const businessTrip = {
  trip_name: 'Conferenza Tech Milano',
  destination: 'Milano',
  departure_date: '2025-02-15',
  return_date: '2025-02-15',
  travel_hours: 4,
  event_hours: 8,
  waiting_hours: 1,
  travel_policy: 'full_travel'
};
```

## 🔄 Processi Automatici

### Maturazione Mensile

Il sistema calcola automaticamente:
- **Ferie**: Proporzionali alle ore mensili del pattern
- **Permessi ROL**: Proporzionali alle ore mensili del pattern
- **Pro-rata**: Per ingressi/uscite a metà mese

### Calcoli Ore

- **Ferie per giorno**: Basate sul pattern di lavoro del giorno specifico
- **Straordinari**: Ore lavorate oltre il pattern giornaliero
- **Trasferte**: Viaggio + evento + attese secondo policy

### Ledger Movimenti

Ogni operazione genera un movimento:
- **Maturazione**: `+` ore con causale e periodo
- **Utilizzo**: `-` ore con riferimento richiesta
- **Scadenza**: `-` ore eccedenti con data limite
- **Rettifica**: `+/-` ore per correzioni manuali

## 📊 Esempi Pratici

### Scenario 1: Dipendente Part-time Verticale

```javascript
// Pattern: Lun-Mer-Ven, 8h/giorno
const pattern = {
  monday_hours: 8,
  tuesday_hours: 0,
  wednesday_hours: 8,
  thursday_hours: 0,
  friday_hours: 8,
  saturday_hours: 0,
  sunday_hours: 0
};

// Richiesta ferie: Lun-Mer-Ven (3 giorni)
// Calcolo: 8h + 8h + 8h = 24h totali
```

### Scenario 2: Trasferta con Straordinari

```javascript
// Trasferta: 8h viaggio + 8h evento = 16h totali
// Pattern giornaliero: 8h
// Straordinari generati: 8h → monte ore
```

### Scenario 3: Maturazione Pro-rata

```javascript
// Ingresso: 15 gennaio
// Giorni lavorati gennaio: 12 giorni
// Giorni totali gennaio: 22 giorni
// Pro-rata: 12/22 = 54.5%
// Maturazione ferie: 208h * 54.5% = 113.6h
```

## 🛠️ Manutenzione

### Chiusure Mensili

```sql
-- Esegui maturazione per tutti gli utenti
SELECT accrue_monthly_hours(user_id, 2025, 1, 'vacation');
SELECT accrue_monthly_hours(user_id, 2025, 1, 'permission');
```

### Controlli Saldi

```sql
-- Verifica coerenza ledger vs saldi
SELECT 
  user_id,
  category,
  SUM(hours_amount) as ledger_total,
  current_balance
FROM hours_ledger 
JOIN current_balances USING (user_id, category)
GROUP BY user_id, category, current_balance;
```

### Backup e Recovery

```bash
# Backup completo
pg_dump presenze_laba > backup_hours_system.sql

# Restore
psql presenze_laba < backup_hours_system.sql
```

## 🚨 Troubleshooting

### Problemi Comuni

1. **Pattern non trovato**: Verificare `effective_from` e `effective_to`
2. **Saldo negativo**: Controllare movimenti ledger per errori
3. **Calcoli errati**: Verificare pattern di lavoro attivo
4. **API non risponde**: Controllare autenticazione e permessi

### Log e Debug

```javascript
// Abilita debug nel frontend
localStorage.setItem('debug', 'hours-system');

// Verifica pattern attivo
const pattern = await apiCall('/api/hours/work-patterns');
console.log('Pattern attivo:', pattern);
```

## 📈 Monitoraggio

### Metriche Chiave

- **Accuratezza calcoli**: Confronto ledger vs saldi
- **Performance API**: Tempo risposta endpoint
- **Utilizzo funzioni**: Frequenza chiamate SQL
- **Errori sistema**: Log errori e eccezioni

### Dashboard Admin

- **Saldi totali**: Ore ferie/permessi per dipartimento
- **Utilizzo mensile**: Trend utilizzo ore
- **Trasferte**: Ore viaggio vs lavoro effettivo
- **Monte ore**: Accumulo e utilizzo straordinari

## 🔮 Roadmap

### Prossime Funzionalità

- [ ] **Dashboard avanzata**: Grafici utilizzo ore
- [ ] **Notifiche push**: Alert saldo basso
- [ ] **Export Excel**: Report ore per contabilità
- [ ] **API mobile**: App smartphone
- [ ] **Integrazione payroll**: Collegamento stipendi

### Miglioramenti Tecnici

- [ ] **Cache Redis**: Performance calcoli frequenti
- [ ] **Queue system**: Processamento asincrono
- [ ] **Audit trail**: Tracciamento modifiche admin
- [ ] **Backup automatico**: Backup giornalieri

---

## 📞 Supporto

Per domande o problemi:
- **Email**: hr@labafirenze.com
- **Documentazione**: `/docs/hours-system-guide.md`
- **Issues**: GitHub repository

**Versione**: 2.0.0 - Sistema Basato su Ore  
**Ultimo aggiornamento**: Febbraio 2025
