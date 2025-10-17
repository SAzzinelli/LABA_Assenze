# Migration: Aggiunta campo break_start_time

## 📋 Cosa fa questa migration

Aggiunge il campo `break_start_time` alla tabella `work_schedules` per permettere di personalizzare l'orario di inizio pausa pranzo per ogni dipendente.

## 🔧 Come applicare

### 1. Vai su Supabase Dashboard

1. Apri https://supabase.com/dashboard
2. Seleziona il progetto LABA HR
3. Vai su **SQL Editor**
4. Clicca su **New Query**

### 2. Esegui questo SQL

```sql
-- Aggiunge il campo break_start_time alla tabella work_schedules
ALTER TABLE work_schedules 
ADD COLUMN IF NOT EXISTS break_start_time TIME DEFAULT '13:00';

-- Aggiorna tutti i record esistenti con orario default 13:00
UPDATE work_schedules
SET break_start_time = '13:00'
WHERE break_start_time IS NULL 
  AND is_working_day = true;

-- Verifica che sia stato applicato correttamente
SELECT 
  u.first_name, 
  u.last_name,
  ws.day_of_week,
  ws.start_time,
  ws.end_time,
  ws.break_start_time,
  ws.break_duration
FROM work_schedules ws
JOIN users u ON u.id = ws.user_id
WHERE ws.is_working_day = true
ORDER BY u.last_name, ws.day_of_week;
```

### 3. Verifica il risultato

Dovresti vedere tutti gli orari con `break_start_time = 13:00` come default.

### 4. Personalizza gli orari (opzionale)

Puoi già personalizzare gli orari per utenti specifici:

```sql
-- Esempio: Simone inizia la pausa alle 12:30
UPDATE work_schedules
SET break_start_time = '12:30'
WHERE user_id = (SELECT id FROM users WHERE first_name ILIKE '%simone%')
  AND is_working_day = true;

-- Esempio: Adriano inizia la pausa alle 13:30
UPDATE work_schedules
SET break_start_time = '13:30'
WHERE user_id = (SELECT id FROM users WHERE first_name ILIKE '%adriano%')
  AND is_working_day = true;
```

### 5. Deploy del codice

Dopo aver applicato la migration su Supabase, fai il deploy del nuovo codice che usa questo campo.

## ✅ Cosa cambia dopo

- ✅ Ogni dipendente può avere il proprio orario di pausa
- ✅ Il calcolo delle ore "In pausa" sarà corretto
- ✅ Non più "In pausa" alle 15:30! 😅
- ✅ Dashboard e Presenze useranno l'orario personalizzato

## 🔮 Prossimi step

Dopo questa migration, aggiungerò un'interfaccia nella pagina **Orari di Lavoro** per modificare facilmente l'orario di pausa senza SQL.

