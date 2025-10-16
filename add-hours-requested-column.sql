-- Add missing hours_requested column to leave_requests table
-- This column is needed for the hours-based system

-- Check if column already exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'leave_requests' 
        AND column_name = 'hours_requested'
    ) THEN
        ALTER TABLE leave_requests 
        ADD COLUMN hours_requested DECIMAL(5,2);
        
        RAISE NOTICE 'Column hours_requested added successfully';
    ELSE
        RAISE NOTICE 'Column hours_requested already exists';
    END IF;
END $$;

-- Also add work_pattern_snapshot if missing (for storing the work pattern at time of request)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'leave_requests' 
        AND column_name = 'work_pattern_snapshot'
    ) THEN
        ALTER TABLE leave_requests 
        ADD COLUMN work_pattern_snapshot JSONB;
        
        RAISE NOTICE 'Column work_pattern_snapshot added successfully';
    ELSE
        RAISE NOTICE 'Column work_pattern_snapshot already exists';
    END IF;
END $$;

-- Show current structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leave_requests'
ORDER BY ordinal_position;


