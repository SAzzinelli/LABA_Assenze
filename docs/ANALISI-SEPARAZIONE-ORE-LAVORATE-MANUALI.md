# Analisi: separazione ore lavorate / ore aggiunte manualmente

## Obiettivo
Tenere separati in `attendance`:
- **balance_hours** = solo `actual_hours - expected_hours` (ore lavorate vs attese)
- **hours_ledger** = ricariche/sottrazioni manuali (già esiste)

Saldo totale = somma(attendance.balance_hours) + somma(manual_credit da ledger)

---

## 1. Dove viene scritto `balance_hours` (attendance)

| File:riga | Contesto | Azione attuale | Impatto separazione |
|-----------|----------|----------------|---------------------|
| server 2033 | save-hourly | `finalBalance = baseBalance + manualCredit` | **Da cambiare**: salvare solo `actual - expected` |
| server 2529 | attendance-edit (PUT) | `balance_hours += manualCredit` | **Da cambiare**: salvare solo `actual - expected` |
| server 3599 | update-current | `balance_hours = balanceHours + manualCredit` | **Da cambiare**: salvare solo `actual - expected` |
| server 4670, 4691 | update-current | `finalBalanceWithManual` | **Da cambiare**: salvare solo `actual - expected` |
| server 5153 | save-hourly | `balance_hours: balanceHours` (già con manuale) | Come sopra |
| server 12207 | add-credit-hours | `balance_hours = oldBalance + creditHours` | **Da cambiare**: NON toccare attendance |
| server 12993 | remove-alessia-credit | `balance_hours = newBalance` (sottrae) | **Da cambiare**: NON toccare attendance |
| server 13061 | subtract-credit-hours | `balance_hours = oldBalance - amount` | **Da cambiare**: NON toccare attendance |
| server 15424 | cron saveHourlyAttendance | `balanceToSave = finalBalanceHours + manualCredit` | **Da cambiare**: salvare solo `finalBalanceHours` |

**NON da toccare** (logiche diverse, non manual_credit):
- Permessi 104: balance_hours = 0
- Permessi orari: balance_hours = -permissionData.hours
- Recuperi ore: balance_hours += recoveryHours (è lavoro effettivo)
- Ferie/malattia: non influenzano banca ore

---

## 2. Dove viene letto `balance_hours`

| Contesto | Uso | Impatto |
|----------|-----|---------|
| calculateOvertimeBalance | Somma attendance + manualCreditTopUp | Se attendance non include manuale, manualCreditTopUp già compensa quando ledger > attendance. Con separazione: attendance=puro lavoro, ledger=sempre manuale → somma corretta |
| total-balance | Somma attendance, poi sottrae manualCreditToday se giornata in corso | Stessa logica |
| Ultime fluttuazioni (client) | Mostra balance_hours per ogni record | Con separazione mostrerà solo ore lavoro. Le ricariche manuali andrebbero mostrate da ledger (nuova colonna o sezione) |
| Recovery processing | Legge balance per verificare/aggiungere | Nessun impatto (usa attendance per lavoro) |
| processSingleRecovery, processRecovery | Aggiunge ore recupero a balance | Nessun impatto (è lavoro) |

---

## 3. Flusso `getManualCreditForDate` / manual_credit

| Contesto | Uso attuale | Con separazione |
|----------|-------------|-----------------|
| save-hourly | Se manual_credit > 0: non sovrascrivere. Altrimenti: aggiungi al balance | Non sovrascrivere se manual_credit: già OK. Ma quando salviamo, non aggiungere manuale a balance |
| update-current | Idem | Idem |
| cron | Se manual_credit > 0: SKIP (non salva). Altrimenti: aggiungi manualCredit a balanceToSave | **Cambio**: non skippare. Salva balance = solo lavoro. Il ledger ha già il manuale |
| attendance-edit | Aggiunge manualCredit al balance prima di salvare | Non aggiungere |
| add-credit-hours | Scrive in ledger + aggiorna attendance.balance_hours | Solo ledger (+ current_balances) |
| subtract-credit-hours | Aggiorna attendance + elimina ledger | Solo ledger (elimina/riduci) |
| calculateOvertimeBalance | manualCreditTopUp: aggiunge (ledger - giàInAttendance) | Con attendance puro, manualCreditTopUp = somma ledger (nessun giàInAttendance) |
| total-balance | Sottrae manualCreditToday se giornata in corso | Stessa logica |

---

## 4. Rischio: cron attualmente SKIP quando c'è manual_credit

Oggi: se oggi ha manual_credit, il cron **non salva** nulla (per evitare di sovrascrivere).
Con separazione: il cron **deve salvare** (actual, expected, balance = actual - expected) anche quando c'è manual_credit, altrimenti non aggiorna le ore effettive del giorno.

**Cambio necessario**: rimuovere lo skip per manual_credit. Salvare sempre il balance di lavoro. Il ledger resta la fonte per il credito manuale.

---

## 5. add-credit-hours: presenza senza lavoro

Oggi: se non esiste attendance per quella data, add-credit **crea** un record con balance_hours = creditHours.
Con separazione: creare attendance con balance_hours = 0, actual = 0, expected = 0? O non creare nulla?
- Se non creiamo attendance: il ledger ha il credito, totale = 0 + 8 = 8 ✓
- Se creiamo con balance 0: stesso risultato ✓

---

## 6. subtract-credit-hours

Oggi: aggiorna attendance (sottrae) e elimina ledger.
Con separazione: **solo** eliminare/ridurre nel ledger. Non toccare attendance.

**Nota**: per "sottrarre" ore dal ledger, servirebbe un movimento negativo (usage) invece di eliminare. L'eliminazione cancella il credito. Se vogliamo tracciare le sottrazioni, potremmo inserire un `manual_debit` in ledger. Per ora: eliminare il movimento manual_credit per quella data (o inserire un movimento negativo se vogliamo storico).

---

## 7. Visualizzazione "Ultime fluttuazioni"

Oggi: mostra `balance_hours` per ogni record attendance.
Con separazione: ogni riga mostrerebbe solo (actual - expected). Le ricariche manuali non apparirebbero nelle righe attendance.

**Opzione A**: aggiungere una sezione/riga separata "Ricariche manuali" da ledger.
**Opzione B**: per ogni data con manual_credit nel ledger, mostrare sia "Lavoro: Xh" che "Ricarica: +Yh" nella stessa riga.

---

## 8. Riepilogo modifiche necessarie

1. **add-credit-hours**: non scrivere in attendance.balance_hours. Solo ledger + current_balances. Se non esiste attendance, opzionale creare con balance 0.
2. **subtract-credit-hours**: non scrivere in attendance. Solo ledger (eliminare o movimento negativo).
3. **remove-alessia-credit**: idem subtract (già fa delete ledger, ma anche update attendance → rimuovere update).
4. **save-hourly**: `balance_hours = actual - expected` (o baseBalance senza +manualCredit). Non aggiungere manualCredit.
5. **update-current**: idem, `balance_hours = actual - expected` (senza +manualCredit).
6. **cron saveHourlyAttendance**: 
   - Rimuovere skip quando manual_credit > 0
   - `balanceToSave = finalBalanceHours` (senza +manualCredit)
7. **attendance-edit (PUT)**: `balance_hours = actual - expected` (senza +manualCredit). Gestire permessi come ora.
8. **calculateOvertimeBalance**: manualCreditTopUp - con attendance puro, sommare tutto il manual_credit da ledger (senza confronto alreadyCounted, perché attendance non ha più manuale).
9. **total-balance**: idem.
10. **Client "Ultime fluttuazioni"**: aggiungere visualizzazione ricariche da ledger (opzionale, miglioramento UX).

---

## 9. Cosa NON si tocca

- Permessi (104, orari): logica invariata
- Ferie, malattia: invariati
- Recuperi ore: aggiungono a balance (è lavoro) → invariato
- current_balances: add-credit lo aggiorna, calculateOvertimeBalance non lo usa direttamente per il display (usa attendance+ledger)
- processSingleRecovery, processRecovery: invariati

---

## 10. Dati esistenti (migrazione)

I record attendance attuali hanno `balance_hours` già misto (lavoro + manuale). Dopo il refactor, i nuovi salvataggi saranno puri. Per i record vecchi:
- **Opzione 1**: lasciarli così. Il manualCreditTopUp in calculateOvertimeBalance aggiunge (ledger - alreadyCounted). Se attendance ha 4.58 e ledger ha 8, alreadyCounted=4.58, si aggiunge 3.42. Totale potrebbe essere sbagliato se i dati sono inconsistenti.
- **Opzione 2**: script di migrazione che per ogni record con note "Ricarica"/"credito" e balance > 0, sottrae il manual_credit dal ledger da balance_hours e lascia solo (actual - expected). Complesso e rischioso.

**Raccomandazione**: procedere senza migrazione. I nuovi flussi saranno corretti. I record esistenti rimarranno misti; col tempo si “puliscono” da soli (giorni passati non vengono più riscritti).

---

## 11. Test da fare dopo le modifiche

- [ ] Aggiungi 8h manuali a un dipendente: ledger ha +8, attendance.balance_hours non cambia (o resta actual-expected)
- [ ] Sottrai ore: solo ledger cambia
- [ ] Cron salva presenza: balance_hours = actual - expected anche se c'è manual_credit
- [ ] Saldo totale = corretto (attendance + ledger)
- [ ] Recupero ore: funziona come prima
- [ ] Permessi: invariati
- [ ] "Ultime fluttuazioni" mostra dati sensati (almeno il totale)
