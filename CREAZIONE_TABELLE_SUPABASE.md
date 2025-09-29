# 🗄️ Creazione Tabelle Database - Supabase Dashboard

## 📋 Istruzioni per Creare le Tabelle del Sistema Basato su Ore

Dato che Supabase non permette la creazione diretta di tabelle via API, devi crearle manualmente tramite il **Supabase Dashboard**.

### 🔗 **Accesso al Dashboard**
1. Vai su: https://supabase.com/dashboard
2. Accedi al tuo progetto: `gojhljczpwbjxbbrtrlq`
3. Vai su **SQL Editor** (icona `</>` nella sidebar)

### 📊 **Tabelle da Creare**

#### **1. Contract Types**
```sql
CREATE TABLE IF NOT EXISTS contract_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  annual_vacation_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  annual_permission_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  max_carryover_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **2. Work Patterns**
```sql
CREATE TABLE IF NOT EXISTS work_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_type_id UUID NOT NULL REFERENCES contract_types(id),
  monday_hours DECIMAL(4,2) DEFAULT 0,
  tuesday_hours DECIMAL(4,2) DEFAULT 0,
  wednesday_hours DECIMAL(4,2) DEFAULT 0,
  thursday_hours DECIMAL(4,2) DEFAULT 0,
  friday_hours DECIMAL(4,2) DEFAULT 0,
  saturday_hours DECIMAL(4,2) DEFAULT 0,
  sunday_hours DECIMAL(4,2) DEFAULT 0,
  weekly_hours DECIMAL(5,2) NOT NULL,
  monthly_hours DECIMAL(6,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **3. Hours Ledger**
```sql
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
```

#### **4. Current Balances**
```sql
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
```

#### **5. Business Trips**
```sql
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
```

### 🔧 **Dati Iniziali**

#### **Contract Types**
```sql
INSERT INTO contract_types (name, description, annual_vacation_hours, annual_permission_hours, max_carryover_hours) VALUES
('full_time', 'Tempo pieno indeterminato', 208, 104, 104),
('part_time_horizontal', 'Part-time orizzontale', 104, 52, 52),
('part_time_vertical', 'Part-time verticale', 104, 52, 52),
('apprenticeship', 'Apprendistato', 208, 104, 104),
('cococo', 'Collaborazione coordinata e continuativa', 0, 0, 0),
('internship', 'Tirocinio', 0, 0, 0);
```

### 📝 **Passi da Seguire**

1. **Copia ogni comando SQL** nella sezione SQL Editor
2. **Esegui un comando alla volta** (clicca "Run")
3. **Verifica che ogni tabella sia stata creata** correttamente
4. **Inserisci i dati iniziali** per contract_types
5. **Testa il sistema** eseguendo: `node test-hours-system.js`

### ✅ **Verifica Creazione**

Dopo aver creato tutte le tabelle, puoi verificare che siano state create correttamente:

```sql
-- Verifica tabelle create
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contract_types', 'work_patterns', 'hours_ledger', 'current_balances', 'business_trips');
```

### 🚀 **Dopo la Creazione**

Una volta create le tabelle:

1. **Esegui la migrazione**: `node scripts/migrate-to-hours-system.js`
2. **Testa il sistema**: `node test-hours-system.js`
3. **Avvia il server**: `npm start`
4. **Testa il frontend**: http://localhost:3000

---

**💡 Nota**: Se hai problemi con la creazione delle tabelle, puoi anche usare l'interfaccia grafica di Supabase:
1. Vai su **Table Editor**
2. Clicca **"New Table"**
3. Crea ogni tabella con i campi specificati sopra
