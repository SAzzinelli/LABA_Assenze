-- Tabelle per dati di test (non vengono salvati nei dati reali)
CREATE TABLE IF NOT EXISTS test_attendance (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  actual_hours DECIMAL(5,2),
  expected_hours DECIMAL(5,2),
  balance_hours DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS test_leave_requests (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  hours DECIMAL(5,2),
  permission_type VARCHAR(50),
  exit_time TIME,
  entry_time TIME,
  doctor VARCHAR(255),
  medical_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_attendance_user_date ON test_attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_test_leave_requests_user ON test_leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_test_leave_requests_dates ON test_leave_requests(start_date, end_date);
