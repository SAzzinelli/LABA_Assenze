-- Crea tabella attendance con struttura corretta per il sistema HR

-- Prima elimina la tabella esistente se c'è
DROP TABLE IF EXISTS attendance CASCADE;

-- Crea la tabella con la struttura corretta
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'present',
  expected_hours DECIMAL(4,2) DEFAULT 0,
  actual_hours DECIMAL(4,2) DEFAULT 0,
  balance_hours DECIMAL(4,2) DEFAULT 0,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  hours_worked DECIMAL(4,2),
  is_absent BOOLEAN DEFAULT FALSE,
  is_overtime BOOLEAN DEFAULT FALSE,
  is_early_departure BOOLEAN DEFAULT FALSE,
  is_late_arrival BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_is_absent ON attendance(is_absent);

-- Crea anche la tabella attendance_details
CREATE TABLE IF NOT EXISTS attendance_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  segment TEXT NOT NULL,
  start_time TIME,
  end_time TIME,
  status TEXT DEFAULT 'present' NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_attendance_segment UNIQUE (attendance_id, segment),
  CONSTRAINT valid_segment CHECK (segment IN ('morning', 'lunch_break', 'afternoon'))
);

-- Crea indici per attendance_details
CREATE INDEX IF NOT EXISTS idx_attendance_details_user_date ON attendance_details(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_details_attendance_id ON attendance_details(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_details_segment ON attendance_details(segment);
CREATE INDEX IF NOT EXISTS idx_attendance_details_status ON attendance_details(status);
