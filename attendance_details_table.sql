-- Tabella per i dettagli delle presenze (mattina, pausa pranzo, pomeriggio)
CREATE TABLE IF NOT EXISTS attendance_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('mattina', 'pausa_pranzo', 'pomeriggio')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'break', 'missed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_attendance_details_user_date ON attendance_details(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_details_attendance_id ON attendance_details(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_details_period ON attendance_details(period);
CREATE INDEX IF NOT EXISTS idx_attendance_details_status ON attendance_details(status);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_attendance_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_attendance_details_updated_at
  BEFORE UPDATE ON attendance_details
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_details_updated_at();

-- Funzione per generare presenze automatiche
CREATE OR REPLACE FUNCTION generate_automatic_attendance(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_employee RECORD;
  v_current_date DATE;
  v_work_hours DECIMAL(4,2);
  v_attendance_id UUID;
  v_days_generated INTEGER := 0;
BEGIN
  -- Ottieni i dati del dipendente
  SELECT u.*, e.contract_type
  INTO v_employee
  FROM users u
  JOIN employees e ON u.id = e.user_id
  WHERE u.id = p_user_id AND u.is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Dipendente non trovato');
  END IF;

  -- Determina le ore di lavoro
  v_work_hours := CASE 
    WHEN v_employee.contract_type LIKE '%Full Time%' THEN 8
    WHEN v_employee.contract_type LIKE '%Part Time%' THEN 4
    ELSE 8
  END;

  -- Genera presenze per ogni giorno lavorativo
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    -- Solo giorni lavorativi (lunedì-venerdì)
    IF EXTRACT(DOW FROM v_current_date) BETWEEN 1 AND 5 THEN
      -- Verifica se esiste già una presenza
      IF NOT EXISTS (
        SELECT 1 FROM attendance 
        WHERE user_id = p_user_id AND date = v_current_date
      ) THEN
        -- Crea la presenza automatica
        INSERT INTO attendance (
          user_id, date, status, expected_hours, actual_hours, 
          balance_hours, clock_in, clock_out, is_absent, 
          notes, created_at, updated_at
        ) VALUES (
          p_user_id, v_current_date, 'present', v_work_hours, v_work_hours,
          0, v_current_date || ' 09:00:00', v_current_date || ' 18:00:00', 
          false, 'Presenza automatica generata dal sistema', NOW(), NOW()
        ) RETURNING id INTO v_attendance_id;

        -- Crea i dettagli della presenza
        INSERT INTO attendance_details (
          attendance_id, user_id, date, period, start_time, end_time, 
          hours, status, notes
        ) VALUES 
        (v_attendance_id, p_user_id, v_current_date, 'mattina', 
         v_current_date || ' 09:00:00', v_current_date || ' 13:00:00', 
         4, 'completed', 'Turno mattutino'),
        (v_attendance_id, p_user_id, v_current_date, 'pausa_pranzo', 
         v_current_date || ' 13:00:00', v_current_date || ' 14:00:00', 
         1, 'break', 'Pausa pranzo'),
        (v_attendance_id, p_user_id, v_current_date, 'pomeriggio', 
         v_current_date || ' 14:00:00', v_current_date || ' 18:00:00', 
         4, 'completed', 'Turno pomeridiano');

        v_days_generated := v_days_generated + 1;
      END IF;
    END IF;

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'days_generated', v_days_generated,
    'message', 'Presenze generate con successo'
  );
END;
$$ LANGUAGE plpgsql;

-- Funzione per aggiornare il saldo ore mensile
CREATE OR REPLACE FUNCTION update_monthly_hours_balance(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_total_hours DECIMAL(8,2);
  v_expected_hours DECIMAL(8,2);
  v_balance DECIMAL(8,2);
BEGIN
  -- Calcola ore effettive del mese
  SELECT COALESCE(SUM(actual_hours), 0)
  INTO v_total_hours
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month;

  -- Calcola ore attese del mese (giorni lavorativi * 8 ore)
  SELECT COUNT(*) * 8
  INTO v_expected_hours
  FROM generate_series(
    DATE(p_year || '-' || p_month || '-01'),
    (DATE(p_year || '-' || p_month || '-01') + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    '1 day'::INTERVAL
  ) AS day
  WHERE EXTRACT(DOW FROM day) BETWEEN 1 AND 5;

  v_balance := v_total_hours - v_expected_hours;

  -- Aggiorna o inserisci il saldo mensile
  INSERT INTO monthly_hours_balance (user_id, year, month, total_hours, expected_hours, balance_hours)
  VALUES (p_user_id, p_year, p_month, v_total_hours, v_expected_hours, v_balance)
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET
    total_hours = v_total_hours,
    expected_hours = v_expected_hours,
    balance_hours = v_balance,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Tabella per il saldo ore mensile
CREATE TABLE IF NOT EXISTS monthly_hours_balance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_hours DECIMAL(8,2) DEFAULT 0,
  expected_hours DECIMAL(8,2) DEFAULT 0,
  balance_hours DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_monthly_hours_balance_user ON monthly_hours_balance(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_hours_balance_year_month ON monthly_hours_balance(year, month);
