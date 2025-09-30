# Sistema HR Presenze LABA - Nuovo Sistema Senza Timbratura

## 🎯 Panoramica

Il sistema è stato completamente rinnovato per eliminare la timbratura manuale e implementare un sistema automatico basato su orari di lavoro personalizzati e monte ore con punto zero.

## 🔄 Principali Cambiamenti

### ❌ Rimosso
- Sistema di timbratura (check-in/check-out)
- Campi `clock_in`, `clock_out`, `break_start`, `break_end`
- Calcolo manuale delle ore lavorate

### ✅ Aggiunto
- **Presenza automatica** basata su orari di lavoro
- **Sistema monte ore** con punto zero (0)
- **Orari personalizzati** per ogni dipendente
- **Gestione assenze** solo tramite richieste approvate
- **Calcolo automatico** del saldo ore

## 📊 Sistema Monte Ore

### Logica del Sistema
- **Punto di partenza**: 0 ore
- **Positivo (+)** : Straordinari concordati
- **Negativo (-)** : Ritardi/anticipi
- **Neutro (0)** : Presenza normale secondo orario

### Esempi
```
Simone: 9:00-18:00 (8h lavorative)
- Giorno normale: 0h (saldo)
- Lavora 9h: +1h (straordinario)
- Lavora 7h: -1h (deficit)
- Assente per malattia: -8h (deficit)
```

## 🗄️ Struttura Database

### Nuove Tabelle

#### `work_schedules`
Orari di lavoro personalizzati per ogni dipendente
```sql
- user_id: UUID (riferimento utente)
- day_of_week: INTEGER (0=domenica, 6=sabato)
- is_working_day: BOOLEAN
- start_time: TIME
- end_time: TIME
- break_duration: INTEGER (minuti)
```

#### `hours_balance`
Monte ore cumulativo mensile
```sql
- user_id: UUID
- year: INTEGER
- month: INTEGER
- total_balance: DECIMAL (saldo totale)
- overtime_hours: DECIMAL (ore straordinario)
- deficit_hours: DECIMAL (ore deficit)
- working_days: INTEGER
- absent_days: INTEGER
```

### Tabelle Modificate

#### `attendance`
```sql
-- Rimosso
- clock_in, clock_out, break_start, break_end

-- Aggiunto
- expected_hours: DECIMAL (ore attese)
- actual_hours: DECIMAL (ore effettive)
- balance_hours: DECIMAL (saldo ore giornaliero)
- is_absent: BOOLEAN
- absence_reason: VARCHAR
- leave_request_id: UUID
- is_overtime: BOOLEAN
- is_early_departure: BOOLEAN
- is_late_arrival: BOOLEAN
- notes: TEXT
```

## 🔧 Funzionalità

### Per Dipendenti
- **Visualizzazione monte ore** mensile
- **Cronologia presenze** automatica
- **Stato presenza** basato su orario
- **Gestione richieste** permessi/malattia/ferie

### Per Amministratori
- **Gestione orari** di lavoro dipendenti
- **Modifica ore effettive** per correzioni
- **Contrassegno straordinari** concordati
- **Generazione automatica** presenze per periodo
- **Monitoraggio monte ore** di tutti i dipendenti

## 🚀 Installazione e Configurazione

### 1. Applica Modifiche Database
```bash
node scripts/apply-no-clock-changes.js
```

### 2. Configura Orari di Lavoro
Gli orari di default vengono creati automaticamente:
- **Lunedì-Venerdì**: 9:00-18:00 (8h lavorative)
- **Sabato-Domenica**: Non lavorativi
- **Pausa pranzo**: 1 ora automatica

### 3. Personalizza Orari
Gli amministratori possono modificare gli orari per dipendenti specifici tramite l'interfaccia web.

## 📱 Interfaccia Utente

### Pagina Presenze (`/presenze`)
- **Monte ore mensile** con indicatori visivi
- **Stato oggi** con orario di lavoro
- **Cronologia** delle ultime 10 presenze
- **Spiegazione sistema** per utenti

### Pagina Admin Presenze (`/admin-attendance`)
- **Gestione presenze** di tutti i dipendenti
- **Modifica ore effettive** inline
- **Generazione automatica** presenze
- **Filtri** per mese/anno/dipendente

### Dashboard
- **Statistiche aggiornate** con monte ore
- **Presenze attuali** senza timbratura
- **Indicatori visivi** per saldo ore

## 🔄 API Endpoints

### Nuovi Endpoints
```
GET /api/work-schedules - Orari di lavoro
POST /api/work-schedules - Salva orari
GET /api/attendance/hours-balance - Monte ore mensile
PUT /api/attendance/:id - Modifica presenza
POST /api/attendance/generate - Genera presenze
```

### Endpoints Rimossi
```
POST /api/attendance/clock-in
POST /api/attendance/clock-out
GET /api/attendance/current
GET /api/attendance/upcoming-departures
```

## 🎯 Vantaggi del Nuovo Sistema

1. **Automatizzazione**: Nessuna timbratura manuale
2. **Flessibilità**: Orari personalizzati per dipendente
3. **Trasparenza**: Monte ore sempre visibile
4. **Semplicità**: Logica chiara e intuitiva
5. **Controllo**: Gestione centralizzata da admin

## 🔍 Monitoraggio

### Metriche Chiave
- **Monte ore mensile** per dipendente
- **Ore straordinario** concordate
- **Ore deficit** da recuperare
- **Giorni lavorativi** vs assenti
- **Tasso presenza** giornaliero

### Report Automatici
- **Report settimanali** via email
- **Notifiche** per saldi negativi
- **Dashboard** in tempo reale

## 🛠️ Manutenzione

### Backup
- Backup regolare delle tabelle `attendance` e `hours_balance`
- Export periodico dei monte ore

### Pulizia
- Archiviazione dati storici oltre 2 anni
- Pulizia record temporanei

## 📞 Supporto

Per problemi o domande sul nuovo sistema:
1. Controlla i log del server
2. Verifica la configurazione degli orari
3. Controlla i permessi utente
4. Contatta l'amministratore di sistema

---

**Versione**: 2.0  
**Data**: Gennaio 2025  
**Autore**: Sistema HR LABA Firenze
