-- Tabella per richieste recupero ore (straordinari concordati per recuperare debito banca ore)
CREATE TABLE IF NOT EXISTS recovery_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Dati richiesta
  recovery_date DATE NOT NULL, -- Data in cui recupererà le ore
  start_time TIME NOT NULL, -- Orario inizio recupero
  end_time TIME NOT NULL, -- Orario fine recupero
  hours DECIMAL(5,2) NOT NULL, -- Ore di recupero richieste
  
  -- Stato richiesta
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed', 'cancelled'
  
  -- Gestione approvazione
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Dati recupero
  reason TEXT, -- Motivo della richiesta
  notes TEXT, -- Note aggiuntive
  
  -- Gestione completamento
  completed_at TIMESTAMP WITH TIME ZONE, -- Quando le ore sono state effettivamente recuperate (dopo data/orario)
  balance_added BOOLEAN DEFAULT FALSE, -- Se le ore sono state aggiunte al saldo
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_recovery_requests_user ON recovery_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_status ON recovery_requests(status);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_date ON recovery_requests(recovery_date);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_user_status ON recovery_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_approved_pending ON recovery_requests(status, recovery_date) WHERE status = 'approved' AND balance_added = FALSE;

-- Commenti
COMMENT ON TABLE recovery_requests IS 'Richieste di recupero ore per dipendenti con debito banca ore';
COMMENT ON COLUMN recovery_requests.recovery_date IS 'Data in cui il dipendente recupererà le ore';
COMMENT ON COLUMN recovery_requests.hours IS 'Ore di recupero richieste';
COMMENT ON COLUMN recovery_requests.balance_added IS 'Indica se le ore sono state già aggiunte al saldo (dopo che data/orario sono passati)';
COMMENT ON COLUMN recovery_requests.completed_at IS 'Timestamp quando le ore sono state effettivamente recuperate';

