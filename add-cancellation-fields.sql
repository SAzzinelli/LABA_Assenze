-- Aggiungi campi per supportare l'annullamento delle richieste
-- Solo per i permessi, solo dall'admin

-- Aggiungi campi per tracciare l'annullamento
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Aggiorna il constraint per includere 'cancelled' come status valido
-- Prima rimuovi il constraint esistente se c'è
DO $$ 
BEGIN
    -- Controlla se esiste un constraint CHECK per status
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'leave_requests' 
        AND constraint_type = 'CHECK' 
        AND constraint_name LIKE '%status%'
    ) THEN
        -- Rimuovi il constraint esistente
        ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
    END IF;
    
    -- Aggiungi il nuovo constraint con 'cancelled'
    ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));
END $$;

-- Aggiungi un trigger per aggiornare il saldo quando viene ripristinata una richiesta
CREATE OR REPLACE FUNCTION restore_hours_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo quando lo status cambia da 'approved' a 'cancelled'
    IF OLD.status = 'approved' AND NEW.status = 'cancelled' AND NEW.type = 'permission' THEN
        -- Aggiorna il saldo corrente aggiungendo le ore ripristinate
        UPDATE current_balances 
        SET 
            current_balance = current_balance + NEW.hours_requested,
            last_transaction_date = NOW(),
            updated_at = NOW()
        WHERE user_id = NEW.user_id 
        AND category = 'permission' 
        AND year = EXTRACT(YEAR FROM NEW.start_date);
        
        -- Se non esiste il record di saldo, crealo
        IF NOT FOUND THEN
            INSERT INTO current_balances (user_id, category, year, current_balance, last_transaction_date)
            VALUES (NEW.user_id, 'permission', EXTRACT(YEAR FROM NEW.start_date), NEW.hours_requested, NOW())
            ON CONFLICT (user_id, category, year) 
            DO UPDATE SET 
                current_balance = current_balances.current_balance + NEW.hours_requested,
                last_transaction_date = NOW(),
                updated_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea il trigger
DROP TRIGGER IF EXISTS restore_hours_trigger ON leave_requests;
CREATE TRIGGER restore_hours_trigger
    AFTER UPDATE ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION restore_hours_balance();

