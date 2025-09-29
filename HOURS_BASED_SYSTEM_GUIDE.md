# Sistema HR Basato su Ore - Guida Implementazione

## 🌐 Principi Generali Implementati

### 1. **Tutto in Ore**
- ✅ Ferie, permessi, monte ore → sempre ore
- ✅ I "giorni" sono solo una conversione basata sul pattern di lavoro
- ✅ Calcoli proporzionali per tutti i tipi di contratto

### 2. **Pattern di Lavoro come Base**
- ✅ Definisce quante ore e in quali giorni la persona dovrebbe lavorare
- ✅ Supporta full-time, part-time verticale/orizzontale, apprendistato
- ✅ Tutti i calcoli partono dal pattern attivo

### 3. **Ledger a Movimenti**
- ✅ Ogni maturazione (+), utilizzo (−), scadenza o rettifica lascia una riga
- ✅ Tracciabilità completa con data, causale e saldo corrente
- ✅ Audit trail per controlli e verifiche

---

## 🗂 Gestione Contratti

### Tipi di Contratto Supportati

| Tipo | Ore Settimanali | Ore Ferie/Anno | Ore Permessi/Anno | Note |
|------|----------------|----------------|-------------------|------|
| **Full Time** | 40h | 208h (26gg) | 104h (13gg) | Standard |
| **Part-time Orizzontale** | 20h | 104h (13gg) | 52h (6.5gg) | Stessi giorni, meno ore/giorno |
| **Part-time Verticale** | 20h | 104h (13gg) | 52h (6.5gg) | Stessi orari, meno giorni |
| **Apprendistato** | 40h | 208h (26gg) | 104h (13gg) | + ore formazione |
| **Co.Co.Co** | Variabile | 0h | 0h | Solo presenze |
| **Tirocinio** | Variabile | 0h | 0h | Solo presenze |

### Pattern di Lavoro Personalizzati

```sql
-- Esempio: Part-time verticale (lun-mer-ven, 8h/giorno)
INSERT INTO work_patterns (user_id, contract_type_id, effective_from, 
  monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours)
VALUES ('user-uuid', 'part_time_vertical-uuid', '2025-01-01',
  8.0, 0.0, 8.0, 0.0, 8.0);
```

---

## 🌴 Gestione Ferie

### Maturazione Mensile
```javascript
// Calcolo automatico mensile
const monthlyVacationHours = calculateMonthlyVacationAccrual(workPattern, 'full_time');
// Risultato: ~17.33 ore/mese per FT (208h/12)
```

### Consumo per Giorno
```javascript
// Quando richiede "1 giorno ferie"
const vacationHours = calculateVacationHoursForDay(workPattern, '2025-01-15');
// Se è un lunedì FT: 8h, se è un lunedì PT: 4h
```

### Scadenze e Carry-over
```sql
-- A fine anno, taglio eccedenza
INSERT INTO hours_ledger (user_id, transaction_date, transaction_type, category, 
  hours_amount, description, running_balance)
VALUES ('user-uuid', '2024-12-31', 'expiry', 'vacation', 
  -excess_hours, 'Scadenza ferie eccedenti', new_balance);
```

---

## ⏱ Gestione Permessi ROL

### Maturazione Mensile
```javascript
const monthlyPermissionHours = calculateMonthlyPermissionAccrual(workPattern, 'full_time');
// Risultato: ~8.67 ore/mese per FT (104h/12)
```

### Fruizione a Ore
```javascript
// Dipendente chiede 2h permesso
const canTake = canRequestPermission(currentBalance, 2.0);
if (canTake) {
  use_hours(user_id, date, 2.0, 'permission', 'Permesso ROL 2h');
}
```

---

## 🔄 Monte Ore (Straordinari → Permessi Recupero)

### Accumulo Straordinari
```javascript
// Se lavora 10h invece di 8h
const overtimeHours = calculateOvertimeHours(workPattern, date, 10.0);
// Risultato: 2h da aggiungere al monte ore

add_overtime_hours(user_id, date, overtimeHours, 'Straordinario giornaliero');
```

### Utilizzo per Recupero
```javascript
// Quando richiede permesso per recuperare
const canRecover = canUseOvertimeHours(overtimeBalance, requestedHours);
if (canRecover) {
  use_hours(user_id, date, requestedHours, 'overtime_bank', 'Recupero ore');
}
```

### Policy Configurabili
- **Tetto massimo**: es. 40h accumulabili
- **Scadenza**: es. entro 12 mesi vanno usate
- **Priorità**: prima monte ore o permessi ROL?

---

## 🚗 Trasferte e Viaggi per Eventi

### Calcolo Ore Trasferta
```javascript
const tripHours = calculateBusinessTripHours({
  travelHours: 4.0,    // Viaggio andata/ritorno
  eventHours: 8.0,     // Tempo evento
  waitingHours: 1.0    // Attese/logistica
});
// Totale: 13h
```

### Policy Viaggio
```javascript
// Policy configurabili
const travelHoursCounted = applyTravelPolicy(4.0, 'full_travel');     // 4h
const travelHoursCounted = applyTravelPolicy(4.0, 'excess_travel');   // 3h (escluso 1h normale)
const travelHoursCounted = applyTravelPolicy(4.0, 'none');            // 0h
```

### Generazione Straordinari
```javascript
// Se trasferta supera orario giornaliero previsto
const overtimeGenerated = calculateBusinessTripOvertime(workPattern, tripData, tripDate);
// Se previsto 8h e trasferta 13h → 5h in monte ore
```

### Riposo Minimo
- Se viaggio notturno → garantire 11h riposo
- Calcolo automatico partenza posticipata se necessario

---

## 📊 Chiusure e Controlli Mensili

### Processo di Chiusura
```sql
-- 1. Calcola ore lavorate totali
SELECT SUM(hours_worked) FROM attendance 
WHERE user_id = ? AND EXTRACT(MONTH FROM date) = ? AND EXTRACT(YEAR FROM date) = ?;

-- 2. Calcola ferie/permessi fruiti
SELECT SUM(hours_amount) FROM hours_ledger 
WHERE user_id = ? AND category = 'vacation' AND transaction_type = 'usage' 
AND EXTRACT(MONTH FROM transaction_date) = ?;

-- 3. Calcola monte ore generato/usato
SELECT SUM(hours_amount) FROM hours_ledger 
WHERE user_id = ? AND category = 'overtime_bank' 
AND EXTRACT(MONTH FROM transaction_date) = ?;

-- 4. Aggiorna saldi
UPDATE current_balances SET 
  total_used = total_used + monthly_used,
  current_balance = current_balance - monthly_used
WHERE user_id = ? AND category = ? AND year = ?;
```

### Blocco Modifiche Retroattive
- Dopo chiusura mensile, bloccare modifiche ai dati del mese precedente
- Solo rettifica manuale con approvazione admin

---

## ✅ Esempi Pratici di Utilizzo

### Scenario 1: Nuovo Dipendente Part-time Verticale
```sql
-- 1. Crea pattern di lavoro (lun-mer-ven, 8h/giorno)
INSERT INTO work_patterns (user_id, contract_type_id, effective_from,
  monday_hours, wednesday_hours, friday_hours)
VALUES ('new-user', 'part_time_vertical', '2025-01-15', 8.0, 8.0, 8.0);

-- 2. Maturazione pro-rata per gennaio (dal 15 al 31)
SELECT calculateProRataAccrual('part_time_vertical', '2025-01-15');
-- Risultato: ~8.67h ferie, ~4.33h permessi per gennaio
```

### Scenario 2: Richiesta Ferie
```javascript
// Dipendente richiede 3 giorni ferie (lun-mer-ven)
const mondayHours = calculateVacationHoursForDay(workPattern, '2025-02-03'); // 8h
const wednesdayHours = calculateVacationHoursForDay(workPattern, '2025-02-05'); // 8h  
const fridayHours = calculateVacationHoursForDay(workPattern, '2025-02-07'); // 8h
const totalHours = mondayHours + wednesdayHours + fridayHours; // 24h

// Verifica saldo disponibile
const canTake = canRequestVacation(vacationBalance, totalHours, maxCarryover);
```

### Scenario 3: Trasferta con Straordinari
```javascript
// Trasferta Milano-Roma (8h viaggio + 8h evento = 16h totali)
const tripData = { travelHours: 8.0, eventHours: 8.0, waitingHours: 0.0 };
const totalTripHours = calculateBusinessTripHours(tripData); // 16h

// Se giorno normale prevedeva 8h → 8h in monte ore
const overtimeGenerated = calculateBusinessTripOvertime(workPattern, tripData, tripDate);
add_overtime_hours(user_id, tripDate, overtimeGenerated, 'Trasferta Milano-Roma');
```

---

## 🔧 Funzioni Database Principali

### Maturazione Mensile Automatica
```sql
-- Esegui per tutti gli utenti attivi
SELECT accrue_monthly_hours(user_id, 2025, 1, 'vacation');
SELECT accrue_monthly_hours(user_id, 2025, 1, 'permission');
```

### Utilizzo Ore
```sql
-- Approva richiesta ferie
SELECT use_hours(user_id, '2025-02-03', 8.0, 'vacation', 
  'Ferie 3 febbraio', request_id, 'leave_request');
```

### Aggiunta Straordinari
```sql
-- Registra straordinario
SELECT add_overtime_hours(user_id, '2025-02-03', 2.0, 
  'Straordinario progetto urgente', attendance_id);
```

---

## 📋 Checklist Implementazione

- [ ] **Database**: Applicare schema `database-hours-based-schema.sql`
- [ ] **Frontend**: Importare utility `hoursCalculation.js`
- [ ] **Contratti**: Configurare tipi contratto per la tua azienda
- [ ] **Pattern**: Definire pattern di lavoro per ogni dipendente
- [ ] **Policy**: Configurare policy trasferte e monte ore
- [ ] **Processi**: Implementare chiusure mensili automatiche
- [ ] **Training**: Formare team su nuove logiche di calcolo
- [ ] **Test**: Verificare calcoli con dati reali

---

## 🚨 Note Importanti

1. **Migrazione Dati**: I dati esistenti vanno convertiti al nuovo sistema
2. **Backup**: Sempre backup prima di applicare modifiche schema
3. **Testing**: Testare calcoli con diversi scenari contrattuali
4. **Documentazione**: Aggiornare manuali utente con nuove logiche
5. **Supporto**: Preparare FAQ per domande comuni sui nuovi calcoli
