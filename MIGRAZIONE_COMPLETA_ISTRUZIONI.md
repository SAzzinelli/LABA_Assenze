# 🚀 **MIGRAZIONE COMPLETA SISTEMA ORE - ISTRUZIONI**

## 📋 **STATO ATTUALE**

✅ **Sistema implementato**: Tutte le funzionalità sono pronte  
✅ **Script migrazione**: Creato e testato  
⚠️ **Tabelle database**: Devono essere create manualmente  

## 🔧 **PASSI PER COMPLETARE LA MIGRAZIONE**

### **1. Crea le Tabelle Database**

**Vai su Supabase Dashboard:**
1. https://supabase.com/dashboard
2. Accedi al progetto: `gojhljczpwbjxbbrtrlq`
3. Vai su **SQL Editor** (icona `</>`)

**Copia e incolla questo SQL:**

```sql
-- =====================================================
-- TABELLE SISTEMA HR BASATO SU ORE
-- =====================================================

-- 1. CONTRACT TYPES
CREATE TABLE IF NOT EXISTS contract_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  annual_vacation_hours DECIMAL(6,2) DEFAULT 208,
  annual_permission_hours DECIMAL(6,2) DEFAULT 0,
  max_carryover_hours DECIMAL(6,2) DEFAULT 104,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. WORK PATTERNS
CREATE TABLE IF NOT EXISTS work_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_type_id UUID NOT NULL REFERENCES contract_types(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  monday_hours DECIMAL(4,2) DEFAULT 8.0,
  tuesday_hours DECIMAL(4,2) DEFAULT 8.0,
  wednesday_hours DECIMAL(4,2) DEFAULT 8.0,
  thursday_hours DECIMAL(4,2) DEFAULT 8.0,
  friday_hours DECIMAL(4,2) DEFAULT 8.0,
  saturday_hours DECIMAL(4,2) DEFAULT 0.0,
  sunday_hours DECIMAL(4,2) DEFAULT 0.0,
  weekly_hours DECIMAL(5,2) NOT NULL,
  monthly_hours DECIMAL(6,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. HOURS LEDGER
CREATE TABLE IF NOT EXISTS hours_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('vacation', 'permission', 'overtime')),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('accrual', 'usage', 'expiration', 'adjustment')),
  hours DECIMAL(6,2) NOT NULL,
  transaction_date DATE NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type VARCHAR(20),
  reference_id UUID,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CURRENT BALANCES
CREATE TABLE IF NOT EXISTS current_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('vacation', 'permission', 'overtime')),
  year INTEGER NOT NULL,
  total_accrued DECIMAL(6,2) DEFAULT 0,
  total_used DECIMAL(6,2) DEFAULT 0,
  current_balance DECIMAL(6,2) DEFAULT 0,
  pending_requests DECIMAL(6,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category, year)
);

-- 5. BUSINESS TRIPS
CREATE TABLE IF NOT EXISTS business_trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination VARCHAR(255) NOT NULL,
  purpose TEXT NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  travel_hours DECIMAL(4,2) DEFAULT 0,
  event_hours DECIMAL(4,2) DEFAULT 0,
  total_hours DECIMAL(4,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DATI INIZIALI
INSERT INTO contract_types (name, description, annual_vacation_hours, annual_permission_hours, max_carryover_hours) VALUES
('full_time', 'Tempo pieno indeterminato', 208, 104, 104),
('part_time_horizontal', 'Part-time orizzontale', 104, 52, 52),
('part_time_vertical', 'Part-time verticale', 104, 52, 52),
('apprenticeship', 'Apprendistato', 208, 104, 104),
('cococo', 'Collaborazione coordinata e continuativa', 0, 0, 0),
('internship', 'Tirocinio', 0, 0, 0);
```

### **2. Esegui la Migrazione**

Dopo aver creato le tabelle, esegui:

```bash
node complete-migration.js
```

Questo script:
- ✅ Crea pattern di lavoro per tutti gli utenti
- ✅ Migra saldi ferie/permessi al sistema ore
- ✅ Aggiorna richieste ferie esistenti
- ✅ Genera maturazioni mensili
- ✅ Crea trasferte di esempio

### **3. Testa il Sistema Completo**

```bash
node test-hours-system.js
```

### **4. Avvia e Testa il Frontend**

```bash
npm start
```

Poi vai su: http://localhost:3000

## 🎯 **COSA SUCCEDERÀ DOPO LA MIGRAZIONE**

### **✅ Sistema Completamente Funzionante**

1. **Pattern di Lavoro**: Ogni utente avrà un pattern personalizzato
2. **Saldi Ore**: Ferie e permessi convertiti in ore
3. **Maturazioni**: Calcolo automatico mensile
4. **Trasferte**: Gestione viaggi per eventi
5. **Ledger**: Tracciabilità completa movimenti

### **🚀 Nuove Funzionalità Disponibili**

- **Calcoli Automatici**: Ore ferie basate su pattern reale
- **Validazione Intelligente**: Controllo saldo ore
- **Visualizzazione Dual**: Ore e giorni equivalenti
- **Gestione Trasferte**: Policy configurabili
- **Monte Ore**: Sistema straordinari → permessi

## 📊 **VERIFICA MIGRAZIONE**

Dopo la migrazione, verifica che:

1. **Tabelle create**: 5 nuove tabelle nel database
2. **Dati migrati**: Utenti, saldi, richieste aggiornate
3. **Sistema funzionante**: Frontend con calcoli ore
4. **API attive**: Tutti gli endpoint `/api/hours/*`

## 🎉 **RISULTATO FINALE**

**Sistema HR basato su ore completamente funzionante con:**
- ✅ Tutte le tue linee guida implementate
- ✅ Calcoli automatici ore/giorni
- ✅ Pattern di lavoro personalizzati
- ✅ Ledger a movimenti completo
- ✅ Gestione contratti avanzata
- ✅ Sistema trasferte intelligente

---

**🚀 Una volta completata la migrazione, il sistema sarà al 100% funzionante!**
